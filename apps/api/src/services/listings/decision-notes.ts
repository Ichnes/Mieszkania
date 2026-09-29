import type { DecisionNote, DecisionReminder } from "@mieszkania/shared";
import { pool } from "../../db";
import type { Pool } from "pg";
type Database = Pick<Pool, "query">;

export const DECISION_NOTES_SCHEMA = `
create table if not exists listing_decision_notes (
  listing_id uuid not null references listings(id) on delete cascade,
  key text not null,
  data jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (listing_id, key)
);`;

export async function getDecisionNotes(
  id: string,
  db: Database = pool,
): Promise<DecisionNote[] | null> {
  if (!(await db.query("select 1 from listings where id=$1", [id])).rowCount) return null;
  const result = await db.query<{ data: DecisionNote; version: number }>(
    "select data, version from listing_decision_notes where listing_id=$1 order by key",
    [id],
  );
  return result.rows.map(({ data, version }) => ({ ...data, version }));
}

export async function saveDecisionNote(id: string, note: DecisionNote, db: Database = pool) {
  const result = await db.query<{ data: DecisionNote; version: number }>(
    `
    insert into listing_decision_notes (listing_id,key,data,version)
    select id,$2,$3::jsonb,1 from listings where id=$1 and $4=0
    on conflict (listing_id,key) do nothing
    returning data,version`,
    [id, note.key, JSON.stringify(note), note.version],
  );
  if (result.rowCount) return { ...result.rows[0].data, version: result.rows[0].version };
  const update = await db.query<{ data: DecisionNote; version: number }>(
    `
    update listing_decision_notes set data=$3::jsonb, version=version+1, updated_at=now()
    where listing_id=$1 and key=$2 and version=$4 returning data,version`,
    [id, note.key, JSON.stringify(note), note.version],
  );
  return update.rowCount ? { ...update.rows[0].data, version: update.rows[0].version } : null;
}

export async function getDecisionReminders(db: Database = pool): Promise<DecisionReminder[]> {
  const result = await db.query<{
    data: DecisionNote;
    version: number;
    listing_id: string;
    title: string;
  }>(`
    select n.data,n.version,n.listing_id,l.title from listing_decision_notes n
    join listings l on l.id=n.listing_id
    where n.data->>'kind'='action' and n.data->>'done'='false' and n.data->>'dueAt'<>''
    order by (n.data->>'dueAt')::timestamptz, n.listing_id limit 100`);
  return result.rows.map(({ data, version, listing_id, title }) => ({
    ...data,
    version,
    listingId: listing_id,
    title,
  }));
}
