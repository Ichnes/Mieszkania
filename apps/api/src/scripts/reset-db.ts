import "../config";
import { ensureRuntimeSchema } from "../services/schema-bootstrap";
import { resetApplicationData } from "../services/reset-application-data";
import { pool } from "../db";

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
