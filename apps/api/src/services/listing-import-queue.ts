import { withDb } from "../db";
import { appendImportFailureLog } from "./import-failure-log";

export type ListingImportQueueItem = {
  id: string;
  source_key: string;
  external_id: string;
  canonical_url: string;
  city: string;
  attempts: number;
  payload_raw: Record<string, unknown>;
};

export async function getKnownListingExternalIds(input: { sourceKey: string; externalIds: string[] }) {
  if (input.externalIds.length === 0) {
    return new Set<string>();
  }

  return withDb(async (db) => {
    const result = await db.query<{ external_id: string }>(
      `
        select l.external_id
        from listings l
        join sources s on s.id = l.source_id
        where s.key = $1
          and l.external_id = any($2::text[])
      `,
      [input.sourceKey, input.externalIds]
    );
    return new Set(result.rows.map((row) => row.external_id));
  });
}

/**
 * A Gratka detail page rendered without its modal gallery exposes exactly the
 * three preview images. Keep these listings on a full refresh until we have
 * captured more than those previews.
 */
export async function getListingExternalIdsWithFewImages(input: {
  sourceKey: string;
  externalIds: string[];
  maximumImageCount: number;
  requiredImageUrlFragment?: string;
}) {
  if (input.externalIds.length === 0) {
    return new Set<string>();
  }

  return withDb(async (db) => {
    const result = await db.query<{ external_id: string }>(
      `
        select l.external_id
        from listings l
        join sources s on s.id = l.source_id
        left join listing_images li on li.listing_id = l.id
        left join listing_import_queue q on q.source_key = s.key and q.external_id = l.external_id
        where s.key = $1
          and l.external_id = any($2::text[])
        group by l.id, l.external_id
        having not coalesce(bool_or(q.payload_raw ? 'galleryVerifiedAt'), false)
          and (
            count(li.id) <= $3
            or (
              $4::text is not null
              and count(li.id) filter (where li.source_url like '%' || $4 || '%') < count(li.id)
            )
          )
      `,
      [input.sourceKey, input.externalIds, input.maximumImageCount, input.requiredImageUrlFragment ?? null]
    );
    return new Set(result.rows.map((row) => row.external_id));
  });
}

const staleProcessingMinutes = 30;
const completedRefreshAfterHours = 24;
const terminalListingStatusesSql = "('removed', 'sold')";

/** Dodaje przeterminowane oferty do widocznej kolejki aktualizacji cen. */
export async function enqueueStaleListingPriceUpdates() {
  return withDb(async (db) => {
    const dueResult = await db.query<{ count: string }>(`
      select count(*)::text as count from listings
      where status not in ${terminalListingStatusesSql}
        and last_seen_at < now() - interval '24 hours'
    `);
    const due = Number(dueResult.rows[0]?.count ?? 0);
    if (due === 0) return { due: 0, queued: 0 };

    const queued = await db.query<{ id: string }>(`
      insert into listing_import_queue (
        source_key, external_id, canonical_url, city, priority, payload_raw,
        status, next_attempt_at, started_at, last_error
      )
      select s.key, l.external_id, l.canonical_url, coalesce(l.city, ''), 90,
        jsonb_build_object('priceRefreshQueuedAt', now()), 'pending', now(), null, null
      from listings l join sources s on s.id = l.source_id
      where l.status not in ${terminalListingStatusesSql}
        and l.last_seen_at < now() - interval '24 hours'
      on conflict (source_key, external_id) do update set
        canonical_url = excluded.canonical_url,
        city = excluded.city,
        priority = greatest(listing_import_queue.priority, excluded.priority),
        payload_raw = listing_import_queue.payload_raw || excluded.payload_raw,
        status = case
          when listing_import_queue.status = 'processing' then 'processing'
          when listing_import_queue.status = 'failed' then 'failed'
          else 'pending'
        end,
        next_attempt_at = case
          when listing_import_queue.status = 'processing' then listing_import_queue.next_attempt_at
          when listing_import_queue.status in ('pending', 'failed') and listing_import_queue.next_attempt_at > now() then listing_import_queue.next_attempt_at
          else now()
        end,
        started_at = case when listing_import_queue.status = 'processing' then listing_import_queue.started_at else null end,
        last_error = case
          when listing_import_queue.status = 'processing' then listing_import_queue.last_error
          when listing_import_queue.status = 'failed' then listing_import_queue.last_error
          when listing_import_queue.status = 'pending' and listing_import_queue.next_attempt_at > now() then listing_import_queue.last_error
          else null
        end
      returning id
    `);
    return { due, queued: queued.rows.length };
  });
}

export async function enqueueListingImports(input: {
  sourceKey: string;
  city: string;
  priority?: number;
  items: Array<{ externalId: string; url: string }>;
  forceRefreshExternalIds?: ReadonlySet<string>;
}) {
  if (input.items.length === 0) {
    return { queued: 0 };
  }

  return withDb(async (db) => {
    let queued = 0;

    for (const item of input.items) {
      const result = await db.query<{ inserted: boolean; previous_status: string | null; status: string }>(
        `
          with existing as (
            select status, completed_at
            from listing_import_queue
            where source_key = $1 and external_id = $2
            limit 1
          ),
          upserted as (
            insert into listing_import_queue (
              source_key,
              external_id,
              canonical_url,
              city,
              priority,
              payload_raw
            )
            values ($1, $2, $3, $4, $5, $6::jsonb)
            on conflict (source_key, external_id)
            do update set
              canonical_url = excluded.canonical_url,
              city = excluded.city,
              priority = greatest(listing_import_queue.priority, excluded.priority),
              payload_raw = listing_import_queue.payload_raw || excluded.payload_raw || jsonb_build_object('rediscoveredAt', now()),
              next_attempt_at = case
                when listing_import_queue.status = 'processing' then listing_import_queue.next_attempt_at
                when $8 then now()
                when listing_import_queue.status in ('pending', 'failed') and listing_import_queue.next_attempt_at > now()
                  then listing_import_queue.next_attempt_at
                when listing_import_queue.status = 'completed'
                  and listing_import_queue.completed_at is not null
                  and listing_import_queue.completed_at > now() - make_interval(hours => $7)
                  then listing_import_queue.next_attempt_at
                else now()
              end,
              status = case
                when listing_import_queue.status = 'processing' then listing_import_queue.status
                when $8 then 'pending'
                when listing_import_queue.status = 'failed' then 'failed'
                when listing_import_queue.status = 'completed'
                  and listing_import_queue.completed_at is not null
                  and listing_import_queue.completed_at > now() - make_interval(hours => $7)
                  then listing_import_queue.status
                else 'pending'
              end,
              started_at = case
                when listing_import_queue.status = 'processing' then listing_import_queue.started_at
                else null
              end,
              last_error = case
                when listing_import_queue.status = 'processing' then listing_import_queue.last_error
                when listing_import_queue.status = 'failed' then listing_import_queue.last_error
                when listing_import_queue.status = 'pending' and listing_import_queue.next_attempt_at > now()
                  then listing_import_queue.last_error
                else null
              end
            returning (xmax = 0) as inserted, status
          )
          select
            upserted.inserted,
            (select existing.status from existing) as previous_status,
            upserted.status
          from upserted
        `,
        [
          input.sourceKey,
          item.externalId,
          item.url,
          input.city,
          input.priority ?? 100,
          JSON.stringify({ discoveredUrl: item.url }),
          completedRefreshAfterHours,
          input.forceRefreshExternalIds?.has(item.externalId) ?? false
        ]
      );

      const row = result.rows[0];
      if (row?.inserted || (row?.status === "pending" && row.previous_status !== "pending")) {
        queued += 1;
      }
    }

    return { queued };
  });
}

export async function claimListingImportBatch(input: {
  sourceKey: string;
  limit: number;
  queueKind?: "all" | "price_updates";
}) {
  return withDb(async (pool) => {
    const db = await pool.connect();
    try {
      await db.query("begin");
      await reviveStaleProcessingListingImportsWithDb(db, input.sourceKey);
      const rows = await db.query<ListingImportQueueItem>(
        `
          select q.id, q.source_key, q.external_id, q.canonical_url, q.city, q.attempts, q.payload_raw
          from listing_import_queue q
          where q.source_key = $1
            and q.status in ('pending', 'failed')
            and q.next_attempt_at <= now()
            and (
              $3::text = 'all'
              or exists (
                select 1
                from listings existing_listing
                join sources existing_source on existing_source.id = existing_listing.source_id
                where existing_source.key = q.source_key
                  and existing_listing.external_id = q.external_id
              )
            )
          order by
            exists (
              select 1
              from listings l
              join sources s on s.id = l.source_id
              where s.key = q.source_key and l.external_id = q.external_id
            ) asc,
            q.priority desc,
            q.discovered_at asc
          limit $2
          for update skip locked
        `,
        [input.sourceKey, input.limit, input.queueKind ?? "all"]
      );

      if (rows.rows.length === 0) {
        await db.query("commit");
        return [];
      }

      const ids = rows.rows.map((row) => row.id);
      await db.query(
        `
          update listing_import_queue
          set status = 'processing',
              attempts = attempts + 1,
              started_at = now(),
              last_error = null
          where id = any($1::uuid[])
        `,
        [ids]
      );

      await db.query("commit");
      return rows.rows;
    } catch (error) {
      await db.query("rollback");
      throw error;
    } finally {
      db.release();
    }
  });
}

export async function completeListingImport(id: string, metadata?: Record<string, unknown>) {
  return retryQueueWrite(() =>
    withDb((db) =>
      db.query(
      `
        update listing_import_queue
        set status = 'completed',
            completed_at = now(),
            next_attempt_at = now(),
            last_error = null,
            payload_raw = payload_raw || $2::jsonb
        where id = $1
          and status = 'processing'
      `,
      [id, JSON.stringify(metadata ?? {})]
      )
    )
  );
}

/**
 * Przesuwa chwilowo zablokowany import bez oznaczania go jako trwały błąd.
 * Używane m.in. przy 429, kiedy ponawianie kolejnych pozycji tylko pogarsza blokadę portalu.
 */
export async function deferListingImport(input: {
  id: string;
  reason: string;
  delayMinutes: number;
  metadata?: Record<string, unknown>;
}) {
  return retryQueueWrite(() => withDb((db) => db.query(
    `
      update listing_import_queue
      set status = 'pending',
          next_attempt_at = now() + make_interval(mins => $3),
          started_at = null,
          last_error = $2,
          payload_raw = payload_raw || $4::jsonb
      where id = $1
        and status = 'processing'
    `,
    [
      input.id,
      input.reason.slice(0, 1000),
      Math.max(1, Math.min(input.delayMinutes, 24 * 60)),
      JSON.stringify({ deferredAt: new Date().toISOString(), ...(input.metadata ?? {}) })
    ]
  )));
}

export async function failListingImport(input: {
  id: string;
  error: string;
  attempts: number;
  metadata?: Record<string, unknown>;
}) {
  const retryDelayMinutes = input.error.includes("RATE_LIMITED")
    ? 30
    : Math.min(120, Math.max(5, input.attempts * 10));

  return retryQueueWrite(() => withDb(async (db) => {
    const result = await db.query<{
      source_key: string;
      external_id: string;
      canonical_url: string;
      city: string;
      attempts: number;
    }>(
      `
        update listing_import_queue
        set status = 'failed',
            last_error = $2,
            payload_raw = payload_raw || $4::jsonb,
            next_attempt_at = now() + make_interval(mins => $3)
        where id = $1
          and status = 'processing'
        returning source_key, external_id, canonical_url, city, attempts
      `,
      [
        input.id,
        input.error.slice(0, 1000),
        retryDelayMinutes,
        JSON.stringify({
          lastFailureAt: new Date().toISOString(),
          ...(input.metadata ?? {})
        })
      ]
    );

    const row = result.rows[0];
    if (row) {
      try {
        await appendImportFailureLog({
          sourceKey: row.source_key,
          externalId: row.external_id,
          canonicalUrl: row.canonical_url,
          error: input.error,
          attempts: row.attempts,
          context: {
            queueItemId: input.id,
            city: row.city,
            ...(input.metadata ?? {})
          }
        });
      } catch (error) {
        console.warn("Nie udalo sie zapisac import failure log.", error);
      }
    }

    return result;
  }));
}

export async function retryFailedListingImportsNow(input: { sourceKey: string; limit?: number }) {
  return withDb(async (db) => {
    await reviveStaleProcessingListingImportsWithDb(db, input.sourceKey);
    const result = await db.query<{ id: string }>(
      `
        with picked as (
          select id
          from listing_import_queue
          where source_key = $1
            and status = 'failed'
          order by started_at desc nulls last, discovered_at desc
          limit $2
        )
        update listing_import_queue q
        set status = 'pending',
            next_attempt_at = now(),
            last_error = null
        from picked
        where q.id = picked.id
        returning q.id
      `,
      [input.sourceKey, Math.max(1, Math.min(5000, input.limit ?? 500))]
    );

    return {
      retried: result.rows.length
    };
  });
}

export async function releaseDelayedListingImportsNow(input: { sourceKey: string; limit?: number }) {
  return withDb(async (db) => {
    const result = await db.query<{ id: string }>(
      `with picked as (
        select id from listing_import_queue
        where source_key = $1 and status = 'pending' and next_attempt_at > now()
        order by priority desc, discovered_at asc limit $2
      )
      update listing_import_queue q
      set next_attempt_at = now(), last_error = null
      from picked where q.id = picked.id returning q.id`,
      [input.sourceKey, Math.max(1, Math.min(5000, input.limit ?? 500))]
    );
    return { released: result.rows.length };
  });
}

export async function resetProcessingListingImportsNow(input: { sourceKey: string; limit?: number }) {
  return withDb(async (db) => {
    const result = await db.query<{ id: string }>(
      `
        with picked as (
          select id
          from listing_import_queue
          where source_key = $1
            and status = 'processing'
          order by started_at asc nulls first, discovered_at asc
          limit $2
        )
        update listing_import_queue q
        set status = 'pending',
            next_attempt_at = now(),
            started_at = null,
            last_error = coalesce(nullif(last_error, ''), 'Manual reset from processing to pending')
        from picked
        where q.id = picked.id
        returning q.id
      `,
      [input.sourceKey, Math.max(1, Math.min(5000, input.limit ?? 500))]
    );

    return {
      reset: result.rows.length
    };
  });
}

export async function getListingImportQueueStatus(sourceKey: string) {
  return withDb(async (db) => {
    await reviveStaleProcessingListingImportsWithDb(db, sourceKey);
    const counts = await db.query<{ status: string; count: string }>(
      `
        select status, count(*)::text as count
        from listing_import_queue
        where source_key = $1
        group by status
      `,
      [sourceKey]
    );
    const pendingKinds = await db.query<{ pending_new: string; pending_price_updates: string }>(
      `
        select
          count(*) filter (where q.status = 'pending' and l.id is null)::text as pending_new,
          count(*) filter (where q.status = 'pending' and l.id is not null)::text as pending_price_updates
        from listing_import_queue q
        left join sources s on s.key = q.source_key
        left join listings l on l.source_id = s.id and l.external_id = q.external_id
        where q.source_key = $1
      `,
      [sourceKey]
    );
    const pendingAvailability = await db.query<{
      ready_pending: string;
      delayed_pending: string;
      next_attempt_at: string | null;
    }>(
      `
        select
          count(*) filter (where status = 'pending' and next_attempt_at <= now())::text as ready_pending,
          count(*) filter (where status = 'pending' and next_attempt_at > now())::text as delayed_pending,
          min(next_attempt_at) filter (where status = 'pending' and next_attempt_at > now())::text as next_attempt_at
        from listing_import_queue
        where source_key = $1
      `,
      [sourceKey]
    );
    const recentFailures = await db.query<{ external_id: string; canonical_url: string; last_error: string | null }>(
      `
        select
          external_id,
          canonical_url,
          coalesce(nullif(last_error, ''), 'Brak szczegółów błędu') as last_error
        from listing_import_queue
        where source_key = $1
          and status = 'failed'
        order by coalesce(started_at, discovered_at) desc
        limit 10
      `,
      [sourceKey]
    );

    return {
      sourceKey,
      counts: Object.fromEntries(
        ["pending", "processing", "completed", "failed"].map((status) => [
          status,
          Number(counts.rows.find((row) => row.status === status)?.count ?? "0")
        ])
      ),
      pendingNew: Number(pendingKinds.rows[0]?.pending_new ?? "0"),
      pendingPriceUpdates: Number(pendingKinds.rows[0]?.pending_price_updates ?? "0"),
      readyPending: Number(pendingAvailability.rows[0]?.ready_pending ?? "0"),
      delayedPending: Number(pendingAvailability.rows[0]?.delayed_pending ?? "0"),
      nextAttemptAt: pendingAvailability.rows[0]?.next_attempt_at ?? undefined,
      recentFailures: recentFailures.rows
    };
  });
}

async function reviveStaleProcessingListingImportsWithDb(
  db: Pick<import("pg").Pool, "query">,
  sourceKey: string
) {
  await db.query(
    `
      update listing_import_queue
      set status = 'pending',
          next_attempt_at = now(),
          last_error = coalesce(last_error, 'Recovered from stale processing state'),
          started_at = null
      where source_key = $1
        and status = 'processing'
        and started_at is not null
        and started_at < now() - make_interval(mins => $2)
    `,
    [sourceKey, staleProcessingMinutes]
  );
}

async function retryQueueWrite<T>(action: () => Promise<T>) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if ((code !== "40P01" && code !== "40001") || attempt === 4) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 75 * attempt + Math.floor(Math.random() * 75)));
    }
  }

  throw new Error("Queue write retry exhausted.");
}
