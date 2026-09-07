import "./config";
import { pool } from "./db";
import { initializeDatabase } from "./db/initialize";
import { createApp } from "./http/app";

const { app, automation } = createApp();
process.on("unhandledRejection", (error) =>
  app.log.error({ err: error }, "Background task failed"),
);

async function start() {
  try {
    await initializeDatabase();
    await automation.initialize();
    await app.listen({
      host: process.env.HOST ?? "0.0.0.0",
      port: Number(process.env.PORT ?? 3001),
    });
    if (process.env.AUTOMATION_ENABLED !== "false") automation.start();
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
