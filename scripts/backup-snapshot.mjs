// Executed inside the running API container. Read-only snapshot remains alive until stdin closes.
import pg from "pg";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const quote = (value) => `"${value.replaceAll('"', '""')}"`;
await client.connect();
await client.query("begin isolation level repeatable read read only");
const snapshot = (
  await client.query("select pg_export_snapshot() as id, transaction_timestamp() as captured_at")
).rows[0];
const tables = (
  await client.query("select tablename from pg_tables where schemaname='public' order by tablename")
).rows;
const counts = [];
for (const { tablename } of tables) {
  const result = await client.query(
    `select count(*)::text as count from public.${quote(tablename)}`,
  );
  counts.push({ table: tablename, count: result.rows[0].count });
}
console.log(JSON.stringify({ id: snapshot.id, capturedAt: snapshot.captured_at, counts }));
const release = async () => {
  await client.query("rollback");
  await client.end();
  process.exit(0);
};
process.stdin.resume();
process.stdin.once("end", release);
process.once("SIGTERM", release);
setTimeout(release, 30 * 60 * 1000).unref();
