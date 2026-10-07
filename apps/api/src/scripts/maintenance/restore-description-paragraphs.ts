import { pool } from "../../db";
import { descriptionText } from "../../collectors/description-text";

// Only restore whitespace from the latest source snapshot when the words agree.
// A dry run is the default; --apply persists the verified formatting changes.
const apply = process.argv.includes("--apply");
const compact = (text: string) => text.replace(/\s/g, "");
function descriptions(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) =>
    key === "description" && typeof child === "string" ? [child] : descriptions(child),
  );
}

try {
  const rows = await pool.query<{ id: string; description: string; payload: unknown }>(`
    select l.id, l.description, s.payload as payload from listings l
    join lateral (select jsonb_build_object(
      'jsonLd', payload_raw->'jsonLd',
      'description', payload_raw#>'{nextData,props,pageProps,ad,description}'
    ) as payload from listing_snapshots where listing_id=l.id
      order by captured_at desc limit 1) s on true
    where l.description is not null
  `);
  let restored = 0;
  let targetRestored = false;
  for (const row of rows.rows) {
    for (const raw of descriptions(row.payload)) {
      const formatted = descriptionText(raw);
      if (!formatted?.includes("\n")) continue;
      const ownerSuffix = "Bezpośrednio od właściciela.";
      const candidate =
        compact(row.description) === compact(formatted + ownerSuffix)
          ? `${formatted}\n\n${ownerSuffix}`
          : formatted;
      if (candidate === row.description || compact(candidate) !== compact(row.description))
        continue;
      if (apply)
        await pool.query("update listings set description=$1 where id=$2 and description=$3", [
          candidate,
          row.id,
          row.description,
        ]);
      restored++;
      targetRestored ||= row.id === "3b458ce0-c5bb-42eb-95be-455b0dd0afb1";
      break;
    }
  }
  console.log(JSON.stringify({ apply, restored, targetRestored }));
} finally {
  await pool.end();
}
