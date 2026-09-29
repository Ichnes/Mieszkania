import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import type { DecisionNote } from "@mieszkania/shared";
import {
  DECISION_NOTES_SCHEMA,
  getDecisionNotes,
  getDecisionReminders,
  saveDecisionNote,
} from "./decision-notes";
import { validDecisionNote } from "../../http/routes/decision-notes";

const note: DecisionNote = {
  key: "fact-floor",
  kind: "fact",
  label: "Piętro",
  answer: "3",
  evidence: "Rzut od właściciela",
  checkedAt: "2026-09-29T12:00:00.000Z",
  dueAt: "",
  done: true,
  version: 0,
};
test("confirmed facts require evidence and date; actions require a real date and task", () => {
  assert.ok(validDecisionNote(note));
  for (const patch of [
    { evidence: " " },
    { checkedAt: "" },
    { answer: "" },
    { version: -1 },
    { kind: "invalid" },
    { extra: true },
    { key: "../x" },
    { done: "yes" },
    { checkedAt: "tomorrow" },
  ])
    assert.equal(validDecisionNote({ ...note, ...patch }), false);
  assert.ok(validDecisionNote({ ...note, done: false, answer: "", evidence: "", checkedAt: "" }));
  assert.equal(validDecisionNote({ ...note, kind: "action" }), false);
  assert.ok(validDecisionNote({ ...note, kind: "action", dueAt: "2026-09-30T10:00:00.000Z" }));
});

test(
  "PostgreSQL: notes survive reads, stale edits cannot overwrite, reminders complete, deletion cascades",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await db.connect();
    try {
      await db.query("begin");
      await db.query(
        "create temporary table listings (id uuid primary key, title text) on commit drop",
      );
      await db.query(
        DECISION_NOTES_SCHEMA.replace("create table if not exists", "create temporary table"),
      );
      const id = "00000000-0000-4000-8000-000000000001";
      await db.query("insert into listings values ($1,'Test')", [id]);
      const first = await saveDecisionNote(id, note, db);
      assert.equal(first?.version, 1);
      assert.equal(await saveDecisionNote(id, { ...note, answer: "stale" }, db), null);
      assert.equal((await getDecisionNotes(id, db))?.[0].answer, "3");
      const next = await saveDecisionNote(id, { ...first!, answer: "4" }, db);
      assert.equal(next?.version, 2);
      assert.equal(await saveDecisionNote(id, first!, db), null);
      const action = await saveDecisionNote(
        id,
        {
          ...note,
          key: "next-contact",
          kind: "action",
          done: false,
          dueAt: "2026-09-30T10:00:00.000Z",
        },
        db,
      );
      assert.equal((await getDecisionReminders(db)).length, 1);
      await saveDecisionNote(id, { ...action!, done: true }, db);
      assert.equal((await getDecisionReminders(db)).length, 0);
      await db.query("delete from listings where id=$1", [id]);
      assert.equal(await getDecisionNotes(id, db), null);
      assert.equal((await db.query("select * from listing_decision_notes")).rowCount, 0);
    } finally {
      await db.query("rollback");
      await db.end();
    }
  },
);
