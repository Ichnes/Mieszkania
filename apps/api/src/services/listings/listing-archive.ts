import type { Pool, PoolClient } from "pg";
import type { FetchedListingDocument } from "../../collectors/types";
import { withDb } from "../../db";
import { ensureSource } from "../collecting/source-registry";
import { syncListingGroupPrice } from "../duplicates/group-prices";

export async function markListingArchived(input: {
  sourceKey: string;
  externalId?: string;
  canonicalUrl?: string;
  reason?: string;
}) {
  return withDb(async (pool) => {
    const db = await pool.connect();
    try {
      await db.query("begin");
      await db.query("select pg_advisory_xact_lock(735189241)");
      const result = await markListingArchivedWithDb(db, input);
      if (result) await syncListingGroupPrice(db, result.listingId);
      await db.query("commit");
      return result;
    } catch (error) {
      await db.query("rollback");
      throw error;
    } finally {
      db.release();
    }
  });
}

export function isUnavailableListingDocument(document: FetchedListingDocument) {
  if (document.statusCode === 404 || document.statusCode === 410) {
    return true;
  }

  // Bundled translations contain archive messages even on active ads (notably OLX).
  // Inspect page text, never scripts, styles, comments, URLs or HTML attributes.
  const normalizedHtml = document.html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .toLowerCase();
  return (
    normalizedHtml.includes("ogloszenie archiwalne") ||
    normalizedHtml.includes("ogłoszenie jest już nieaktualne") ||
    normalizedHtml.includes("ogloszenie jest juz nieaktualne") ||
    normalizedHtml.includes("oferta jest już nieaktualna") ||
    normalizedHtml.includes("oferta jest juz nieaktualna") ||
    normalizedHtml.includes("to ogloszenie nie jest juz dostepne") ||
    normalizedHtml.includes("oferta nie jest juz dostepna") ||
    normalizedHtml.includes("pod tym adresem nic nie ma") ||
    normalizedHtml.includes("nieruchomosc ma juz nowego wlasciciela") ||
    normalizedHtml.includes("this ad is no longer available") ||
    normalizedHtml.includes("ad is no longer available")
  );
}

export async function markListingArchivedWithDb(
  db: Pick<Pool | PoolClient, "query">,
  input: {
    sourceKey: string;
    externalId?: string;
    canonicalUrl?: string;
    reason?: string;
  },
) {
  if (!input.externalId && !input.canonicalUrl) {
    return null;
  }

  const sourceId = await ensureSource(db, input.sourceKey);
  const result = await db.query<{ id: string }>(
    `
      update listings
      set status = 'removed',
          removed_at = coalesce(removed_at, now()),
          updated_at = now()
      where source_id = $1
        and (
          ($2::text is not null and external_id = $2)
          or ($3::text is not null and canonical_url = $3)
        )
      returning id
    `,
    [sourceId, input.externalId ?? null, input.canonicalUrl ?? null],
  );

  const listingId = result.rows[0]?.id;
  if (!listingId) {
    return null;
  }

  await db.query(
    `
      insert into price_events (listing_id, event_type, previous_price_amount, new_price_amount)
      select $1, 'removed', l.price_amount, l.price_amount
      from listings l
      where l.id = $1
        and not exists (
          select 1
          from price_events pe
          where pe.listing_id = $1
            and pe.event_type = 'removed'
            and pe.changed_at >= now() - interval '12 hours'
        )
    `,
    [listingId],
  );

  return {
    listingId,
    action: "archived" as const,
    reason: input.reason,
  };
}
