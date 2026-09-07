import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { extractOtodomExternalId } from "../../collectors/otodom/otodom-url";
import "../../config";
import { storageRoot } from "../../config";
import { pool } from "../../db";

type IdentityRow = { id: string; external_id: string; canonical_url: string; status: string };
const apply = process.argv.includes("--apply");
const mergeSameOffer = process.argv.includes("--merge-same-offer");

async function main() {
  const db = await pool.connect();
  try {
    await db.query("begin");
    if (apply) {
      await db.query("set local lock_timeout = '5s'");
      await db.query("lock table listings, listing_import_queue in share row exclusive mode");
    }
    const listings = await db.query<IdentityRow>(
      `select l.* from listings l join sources s on s.id = l.source_id where s.key = 'otodom'`,
    );
    const queue = await db.query<IdentityRow>(
      `select * from listing_import_queue where source_key = 'otodom'`,
    );
    const merges: Array<{
      table: "listings" | "listing_import_queue";
      keep: IdentityRow;
      remove: IdentityRow;
    }> = [];
    const historyBackup: Record<string, unknown[]> = {};
    const changes: Array<{
      table: "listings" | "listing_import_queue";
      before: IdentityRow;
      externalId: string;
    }> = [];
    for (const [table, rows] of [
      ["listings", listings.rows],
      ["listing_import_queue", queue.rows],
    ] as const) {
      const occupied = new Map(rows.map((row) => [row.external_id, row.id]));
      const planned = new Set<string>();
      for (const row of rows) {
        const externalId = extractOtodomExternalId(row.canonical_url);
        if (!externalId) throw new Error(`Invalid canonical URL in ${table}: ${row.id}`);
        if (externalId === row.external_id) continue;
        if (table === "listing_import_queue" && row.status === "processing")
          throw new Error(`Active queue item: ${row.id}; pause the collector first`);
        const collisionId = occupied.get(externalId);
        if (planned.has(externalId))
          throw new Error(`Multiple malformed rows map to ${externalId}`);
        if (collisionId && collisionId !== row.id) {
          if (!mergeSameOffer)
            throw new Error(
              `Identity conflict in ${table}: ${row.id} -> ${externalId}; use --merge-same-offer after review`,
            );
          const collision = rows.find((item) => item.id === collisionId)!;
          // Keep the existing listing UUID with its user associations; keep the correctly keyed queue job.
          merges.push(
            table === "listings"
              ? { table, keep: row, remove: collision }
              : { table, keep: collision, remove: row },
          );
          if (table === "listing_import_queue") continue;
        }
        planned.add(externalId);
        changes.push({ table, before: row, externalId });
      }
    }
    const movable = new Set([
      "listing_snapshots",
      "price_events",
      "listing_images",
      "crawl_artifacts",
    ]);
    const references = (
      await db.query<{ table_name: string; column_name: string }>(`
      select tc.table_name, kcu.column_name from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
      join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
      where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name = 'listings' and tc.table_schema = 'public'
    `)
    ).rows;
    for (const merge of merges.filter((item) => item.table === "listings")) {
      if ((merge.remove as IdentityRow & { is_shortlisted?: boolean }).is_shortlisted)
        throw new Error(`Target has a saved shortlist choice: ${merge.remove.id}`);
      for (const ref of references) {
        if (!/^[a-z_]+$/.test(ref.table_name) || !/^[a-z_]+$/.test(ref.column_name))
          throw new Error("Unexpected schema identifier");
        if (apply) await db.query(`lock table ${ref.table_name} in share row exclusive mode`);
        const rows = (
          await db.query(
            `select * from ${ref.table_name} where ${ref.column_name} = any($1::uuid[])`,
            [[merge.keep.id, merge.remove.id]],
          )
        ).rows;
        const backupKey = `${ref.table_name}.${ref.column_name}`;
        historyBackup[backupKey] = [...(historyBackup[backupKey] ?? []), ...rows];
        if (
          !movable.has(ref.table_name) &&
          rows.some((row) => row[ref.column_name] === merge.remove.id)
        ) {
          throw new Error(
            `Target has user data or relationships in ${ref.table_name}; manual reconciliation required`,
          );
        }
      }
    }
    let backupPath: string | undefined;
    if (apply && (changes.length || merges.length)) {
      const directory = join(storageRoot, "backups");
      await mkdir(directory, { recursive: true });
      backupPath = join(directory, `otodom-id-repair-${Date.now()}.json`);
      await writeFile(
        backupPath,
        JSON.stringify(
          { createdAt: new Date().toISOString(), changes, merges, historyBackup },
          null,
          2,
        ),
        { flag: "wx" },
      );
      for (const merge of merges) {
        if (merge.table === "listings") {
          const portalColumns = [
            "canonical_url",
            "title",
            "description",
            "offer_type",
            "market_type",
            "status",
            "price_amount",
            "price_per_sqm",
            "area_sqm",
            "rooms",
            "floor",
            "total_floors",
            "year_built",
            "latitude",
            "longitude",
            "address_text",
            "district",
            "neighborhood",
            "city",
            "published_at",
            "last_seen_at",
            "removed_at",
            "source_contact_phone",
            "content_checksum",
          ];
          await db.query(
            `update listings kept set (${portalColumns.join(", ")}) = (select ${portalColumns.join(", ")} from listings where id = $2) where kept.id = $1 and kept.last_seen_at < (select last_seen_at from listings where id = $2)`,
            [merge.keep.id, merge.remove.id],
          );
          // Offset positions to preserve every historical image row, including snapshot/asset links.
          const offset = Number(
            (
              await db.query(
                `select coalesce(max(position), 0) + 1 as offset from listing_images where listing_id = $1`,
                [merge.keep.id],
              )
            ).rows[0].offset,
          );
          await db.query(
            `update listing_images set listing_id = $1, position = position + $3 where listing_id = $2`,
            [merge.keep.id, merge.remove.id, offset],
          );
          for (const table of ["listing_snapshots", "price_events", "crawl_artifacts"]) {
            await db.query(`update ${table} set listing_id = $1 where listing_id = $2`, [
              merge.keep.id,
              merge.remove.id,
            ]);
          }
        }
        await db.query(`delete from ${merge.table} where id = $1`, [merge.remove.id]);
      }
      for (const change of changes) {
        // Only these two fixed table names can enter this plan. UUIDs and runtime data stay parameters.
        const result = await db.query(
          `update ${change.table} set external_id = $1 where id = $2 and external_id = $3`,
          [change.externalId, change.before.id, change.before.external_id],
        );
        if (result.rowCount !== 1)
          throw new Error(`Concurrent identity change: ${change.before.id}`);
      }
    }
    await db.query("commit");
    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          listings: changes.filter((c) => c.table === "listings").length,
          queue: changes.filter((c) => c.table === "listing_import_queue").length,
          backupPath,
          mergedListings: merges.filter((m) => m.table === "listings").length,
          mergedQueue: merges.filter((m) => m.table === "listing_import_queue").length,
          changes: changes.map((c) => ({
            table: c.table,
            id: c.before.id,
            oldId: c.before.external_id,
            newId: c.externalId,
          })),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    db.release();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
