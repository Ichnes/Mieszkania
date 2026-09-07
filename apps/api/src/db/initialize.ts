import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { projectRoot } from "../config";
import { pool } from "./index";
import { ensureRuntimeSchema } from "./schema-bootstrap";

export async function ensureLocalDatabaseExists() {
  try {
    await pool.query("select 1");
    return;
  } catch (error) {
    if ((error as { code?: string }).code !== "3D000") throw error;
  }
  const url = new URL(
    process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/mieszkania",
  );
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Utwórz bazę na zdalnym serwerze i ponów uruchomienie.");
  }
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!name) throw new Error("DATABASE_URL nie zawiera nazwy bazy.");
  url.pathname = "/postgres";
  const admin = new Pool({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
  try {
    if (!(await admin.query("select 1 from pg_database where datname = $1", [name])).rowCount) {
      await admin.query(`create database "${name.replaceAll('"', '""')}"`);
      console.log("Utworzono lokalną bazę aplikacji.");
    }
  } finally {
    await admin.end();
  }
}

export async function initializeDatabase() {
  const db = await pool.connect();
  try {
    await db.query("begin");
    await db.query("select pg_advisory_xact_lock(74219381)");
    const existing = await db.query("select to_regclass('public.sources') as table_name");
    if (!existing.rows[0]?.table_name) {
      const schema = await readFile(resolve(projectRoot, "apps/api/src/db/schema.sql"), "utf8");
      await db.query(schema);
    }
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    db.release();
  }
  await ensureRuntimeSchema();
}
