import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { archiveStatusSql, mergedArchiveMemberSql } from "./archive-filter";
import { buildListingSearch } from "./listing-search";

test(
  "archive can include live representatives and search their archived text without duplicates",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await db.connect();
    try {
      await db.query(`begin;
      create temporary table listings (id int, status text, hidden_duplicate_of_id int,
        exclusion_reason text, title text, description text, address_text text, district text, neighborhood text);
      insert into listings(id,status,hidden_duplicate_of_id,exclusion_reason,title) values
        (1,'active',null,null,'Nowa oferta'),
        (2,'removed',1,null,'Historyczna fraza'),
        (3,'removed',1,null,'Druga kopia'),
        (4,'removed',null,null,'Osobne archiwum'),
        (5,'active',null,null,'Bez archiwum'),
        (6,'removed',5,'manual_rejected','Odrzucona'),
        (7,'removed',null,'manual_rejected','Odrzucona osobna');`);
      const ids = async (include: boolean) =>
        (
          await db.query(`select l.id from listings l
      where l.hidden_duplicate_of_id is null and ${archiveStatusSql(include)} order by l.id`)
        ).rows.map((r) => r.id);
      assert.deepEqual(await ids(false), [4]);
      assert.deepEqual(await ids(true), [1, 4]);
      const live = buildListingSearch("historyczna fraza", 1);
      const archived = buildListingSearch("historyczna fraza", 1, "archived_member");
      const matches = await db.query(
        `select l.id from listings l where l.hidden_duplicate_of_id is null
      and ${archiveStatusSql(true)} and (${live.clause} or exists (${mergedArchiveMemberSql} and ${archived.clause}))`,
        live.values,
      );
      assert.deepEqual(matches.rows, [{ id: 1 }]);
      await db.query("update listings set hidden_duplicate_of_id=null where id in (2,3)");
      assert.deepEqual(await ids(true), [2, 3, 4]);
    } finally {
      await db.query("rollback");
      await db.end();
    }
  },
);
