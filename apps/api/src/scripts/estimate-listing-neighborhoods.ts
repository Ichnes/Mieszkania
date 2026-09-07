import { pool } from "../db";
import { backfillEstimatedWarsawNeighborhoods } from "../services/listing-neighborhood-estimator";

try {
  const result = await backfillEstimatedWarsawNeighborhoods({ dryRun: process.argv.includes("--dry-run") });
  console.log(JSON.stringify(result));
} finally {
  await pool.end();
}
