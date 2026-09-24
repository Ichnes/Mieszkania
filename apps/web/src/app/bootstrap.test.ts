import assert from "node:assert/strict";
import test from "node:test";
import { loadWorkspaceBootstrap } from "./bootstrap";

test("startup needs only settings and region, regardless of ranking, calendar or alerts availability", async () => {
  const paths: string[] = [];
  const result = await loadWorkspaceBootstrap(async (path) => {
    paths.push(path);
    if (path === "/api/settings/family") return Response.json({ workplaces: [] });
    if (path === "/api/region") return Response.json({ name: "Region" });
    throw new Error("Unrelated service is unavailable");
  });
  assert.deepEqual(paths.sort(), ["/api/region", "/api/settings/family"]);
  assert.equal(result.region.name, "Region");
  assert.deepEqual(result.settings.workplaces, []);
});

test("essential configuration failures are explicit and a later retry can recover", async () => {
  await assert.rejects(
    loadWorkspaceBootstrap(async (path) =>
      path.includes("settings") ? new Response(null, { status: 503 }) : Response.json({}),
    ),
    /ustawień.*503/,
  );
  await assert.rejects(loadWorkspaceBootstrap(async () => new Response("invalid JSON")));
  await assert.rejects(
    loadWorkspaceBootstrap(async () => {
      throw new Error("Offline");
    }),
    /Offline/,
  );
  assert.ok(await loadWorkspaceBootstrap(async () => Response.json({})));
});
