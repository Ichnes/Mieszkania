import "../../config";
import { pool } from "../../db";
import { ensureRuntimeSchema } from "../../db/schema-bootstrap";
import { resetApplicationData } from "../../services/maintenance/reset-application-data";

const preserveSettings = !process.argv.includes("--drop-settings");

async function main() {
  await ensureRuntimeSchema();
  await resetApplicationData({ preserveSettings });
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
