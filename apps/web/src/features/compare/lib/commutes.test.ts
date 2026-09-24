import assert from "node:assert/strict";
import test from "node:test";
import { fetchComparisonCommutes } from "./commutes";

test("partial route failures preserve other offers and can be retried", async () => {
  const ids = ["ok", "http", "network", "malformed", "invalid"];
  const result = await fetchComparisonCommutes(ids, async (id) => {
    if (id === "http") return new Response(null, { status: 500 });
    if (id === "network") throw new Error("Offline");
    if (id === "malformed") return new Response("{");
    if (id === "invalid")
      return Response.json([{ key: "work", label: "Praca", durationMinutes: -1 }]);
    return Response.json([{ key: "work", label: "Praca", durationMinutes: 12 }]);
  });
  assert.deepEqual(result.ok, [{ key: "work", label: "Praca", durationMinutes: 12 }]);
  for (const id of ids.slice(1)) assert.equal(result[id], "error");
  const retry = await fetchComparisonCommutes(ids, async () => Response.json([]));
  assert.deepEqual(
    Object.values(retry),
    ids.map(() => []),
  );
});
