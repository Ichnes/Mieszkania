import { withDb } from "../../db";

const automationSettingsKey = "listing-import-automation";

export async function getListingAutomationPaused() {
  return withDb(async (db) => {
    const result = await db.query<{ paused: boolean }>(
      `select coalesce((value->>'paused')::boolean, false) as paused from app_settings where key = $1 limit 1`,
      [automationSettingsKey],
    );
    return result.rows[0]?.paused ?? false;
  });
}

export async function setListingAutomationPaused(paused: boolean) {
  await withDb((db) =>
    db.query(
      `
      insert into app_settings (key, value, updated_at)
      values ($1, jsonb_build_object('paused', $2::boolean), now())
      on conflict (key) do update set
        value = jsonb_build_object('paused', $2::boolean),
        updated_at = now()
    `,
      [automationSettingsKey, paused],
    ),
  );
  return paused;
}
