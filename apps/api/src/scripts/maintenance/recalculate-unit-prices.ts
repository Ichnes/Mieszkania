import "../../config";
import { pool } from "../../db";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { storageRoot } from "../../config";
async function main() {
  const db = await pool.connect();
  try {
    await db.query("begin");
    const result = await db.query(
      `select id,price_amount::text,area_sqm::text,price_per_sqm::text,round(price_amount/area_sqm,2)::text as corrected from listings where price_amount>0 and area_sqm>0 and price_per_sqm is distinct from round(price_amount/area_sqm,2) for update`,
    );
    console.log(`Rekordy wymagające przeliczenia: ${result.rowCount}`);
    if (!process.argv.includes("--apply")) {
      await db.query("rollback");
      console.log("Podgląd; --apply zapisuje korektę i kopię poprzednich wartości.");
      return;
    }
    if (result.rowCount) {
      const directory = resolve(storageRoot, "maintenance");
      await mkdir(directory, { recursive: true });
      const file = resolve(directory, `unit-prices-before-${Date.now()}.ndjson`);
      await writeFile(file, result.rows.map((row) => JSON.stringify(row)).join("\n") + "\n", {
        flag: "wx",
        mode: 0o600,
      });
      await db.query(
        `update listings set price_per_sqm=round(price_amount/area_sqm,2) where id=any($1::uuid[])`,
        [result.rows.map((r) => r.id)],
      );
      console.log("Zapisano kopię w storage/maintenance i poprawiono ceny za m².");
    }
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    db.release();
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
