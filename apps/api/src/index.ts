import "./config";
import { pool } from "./db";
import { initializeDatabase } from "./db/initialize";
import { createApp } from "./http/app";
import { registerWarsawStreetNames } from "./services/geography/address-normalization";
import { getMarketStats } from "./services/market/market-stats";
import { pressureScope } from "./services/market/pressure-history";
import { getFamilySettings } from "./services/settings/family-settings";

const { app, automation } = createApp();
async function capturePressure() {
  const day = Math.floor(Date.now() / 86400000);
  const { searchContract } = await getFamilySettings();
  for (const days of [30, 60, 90, 180]) {
    const saved = await pool.query(
      "select 1 from market_pressure_daily where day=$1 and scope=$2",
      [day, pressureScope(searchContract, {}, days)],
    );
    if (!saved.rowCount) await getMarketStats({ buyer: "1", period: String(days) });
  }
}
process.on("unhandledRejection", (error) =>
  app.log.error({ err: error }, "Background task failed"),
);

async function start() {
  try {
    await initializeDatabase();
    const streets = await pool.query<{ name: string }>(
      "select distinct name from streets where city = 'Warszawa'",
    );
    registerWarsawStreetNames(streets.rows.map((street) => street.name));
    await automation.initialize();
    let timer: ReturnType<typeof setInterval> | undefined;
    app.addHook("onClose", async () => clearInterval(timer));
    await app.listen({
      host: process.env.HOST ?? "0.0.0.0",
      port: Number(process.env.PORT ?? 3001),
    });
    if (process.env.AUTOMATION_ENABLED !== "false") automation.start();
    const capture = () =>
      void capturePressure().catch((error) =>
        app.log.error({ err: error }, "Market pressure capture failed"),
      );
    capture();
    timer = setInterval(capture, 3600000);
    timer.unref();
  } catch (error) {
    app.log.error(error);
    await pool.end();
    process.exitCode = 1;
  }
}
async function shutdown() {
  await app.close();
  await pool.end();
}
process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});
void start();
