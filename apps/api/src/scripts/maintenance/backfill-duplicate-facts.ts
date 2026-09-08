import "../../config";
import { pool } from "../../db";
import { inheritStableDuplicateFacts } from "../../services/duplicates/listing-duplicates";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { storageRoot } from "../../config";

const apply = process.argv.includes("--apply");

async function main() {
  const groups = await pool.query<{ group_id: string; incomplete_listings: string }>(`
    select
      gm.group_id,
      count(*) filter (where
        l.year_built is null or l.rooms is null or l.floor is null or l.total_floors is null or
        l.area_sqm is null or nullif(trim(l.district), '') is null or
        nullif(trim(l.address_text), '') is null or l.latitude is null or l.longitude is null
      )::text as incomplete_listings
    from listing_duplicate_group_members gm
    join listings l on l.id = gm.listing_id
    group by gm.group_id
    having count(*) > 1
      and count(*) filter (where
        l.year_built is null or l.rooms is null or l.floor is null or l.total_floors is null or
        l.area_sqm is null or nullif(trim(l.district), '') is null or
        nullif(trim(l.address_text), '') is null or l.latitude is null or l.longitude is null
      ) > 0
    order by gm.group_id
  `);

  let recoverable = 0;
  let backup: string | undefined;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const before = await client.query(
      `select l.id,l.year_built,l.rooms,l.floor,l.total_floors,l.area_sqm,l.price_per_sqm,l.district,l.neighborhood,l.address_text,l.latitude,l.longitude
      from listings l join listing_duplicate_group_members gm on gm.listing_id=l.id where gm.group_id=any($1::uuid[]) order by l.id for update of l`,
      [groups.rows.map((g) => g.group_id)],
    );
    for (const group of groups.rows) {
      await inheritStableDuplicateFacts(client, group.group_id);
    }
    const after = await client.query(
      `select l.id,l.year_built,l.rooms,l.floor,l.total_floors,l.area_sqm,l.price_per_sqm,l.district,l.neighborhood,l.address_text,l.latitude,l.longitude
      from listings l where l.id=any($1::uuid[])`,
      [before.rows.map((r) => r.id)],
    );
    const afterById = new Map(after.rows.map((row) => [row.id, JSON.stringify(row)]));
    const changed = before.rows.filter((row) => JSON.stringify(row) !== afterById.get(row.id));
    recoverable = changed.length;
    if (apply && changed.length) {
      await mkdir(resolve(storageRoot, "maintenance"), { recursive: true });
      backup = resolve(storageRoot, "maintenance", `duplicate-facts-before-${Date.now()}.ndjson`);
      await writeFile(backup, changed.map((row) => JSON.stringify(row)).join("\n") + "\n", {
        flag: "wx",
      });
    }
    await client.query(apply ? "commit" : "rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        groups: groups.rowCount,
        recoverable,
        updated: apply ? recoverable : 0,
        backup,
        incompleteListings: groups.rows.reduce(
          (sum, row) => sum + Number(row.incomplete_listings),
          0,
        ),
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} finally {
  await pool.end();
}
