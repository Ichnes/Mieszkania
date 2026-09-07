import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/mieszkania";

export const pool = new Pool({
  connectionString
});

export async function withDb<T>(action: (db: Pool) => Promise<T>) {
  return action(pool);
}
