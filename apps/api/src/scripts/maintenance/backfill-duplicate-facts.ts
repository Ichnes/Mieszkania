import "../../config";
import { pool } from "../../db";
import { inheritStableDuplicateFacts } from "../../services/duplicates/listing-duplicates";

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

  if (apply) {
    for (const group of groups.rows) {
      await inheritStableDuplicateFacts(pool, group.group_id);
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        groups: groups.rowCount,
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
