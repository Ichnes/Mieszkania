import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { findWarsawStreet } from "./geocoding";

test(
  "PostgreSQL: identical street names require the requested district",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const db = await pool.connect();
    try {
      await db.query("begin");
      await db.query(`create temporary table streets(city text,normalized_name text,district text,center_lat numeric,center_lng numeric) on commit drop;
      insert into streets values ('Warszawa','jana karola chodkiewicza','Wesoła',52.25,21.23),('Warszawa','jana karola chodkiewicza','Mokotów',52.20,20.99);`);
      const result = await findWarsawStreet("Jana Karola Chodkiewicza", "Mokotów", db);
      assert.equal(result?.latitude, 52.2);
      assert.equal(result?.longitude, 20.99);
      assert.equal(await findWarsawStreet("Jana Karola Chodkiewicza", undefined, db), null);
    } finally {
      await db.query("rollback");
      db.release();
      await pool.end();
    }
  },
);
