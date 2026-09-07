import "../config";
import { pool } from "../db";
import { sanitizeStoredListingAddresses } from "../services/listing-address-sanitizer";

try {
  const result = await sanitizeStoredListingAddresses({ dryRun: process.argv.includes("--dry-run") });
  console.log(JSON.stringify(result));
} finally {
  await pool.end();
}
