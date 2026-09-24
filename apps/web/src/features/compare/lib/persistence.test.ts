import assert from "node:assert/strict";
import test from "node:test";
import {
  comparisonStorageKey,
  fetchComparison,
  readComparisonIds,
  writeComparisonIds,
} from "./persistence";

const ids = Array.from(
  { length: 7 },
  (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
);

test("only selected IDs survive a reload; removal and clearing are persisted", (t) => {
  const saved = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => saved.get(key) ?? null,
        setItem: (key: string, value: string) => saved.set(key, value),
      },
    },
  });
  t.after(() => Reflect.deleteProperty(globalThis, "window"));
  assert.equal(writeComparisonIds(ids.slice(0, 3)), true);
  assert.deepEqual(readComparisonIds(), ids.slice(0, 3));
  assert.deepEqual(JSON.parse(saved.get(comparisonStorageKey)!), ids.slice(0, 3));
  writeComparisonIds([ids[1]]);
  assert.deepEqual(readComparisonIds(), [ids[1]]);
  writeComparisonIds([]);
  assert.deepEqual(readComparisonIds(), []);
  saved.set(
    comparisonStorageKey,
    JSON.stringify([null, "invalid", ids[0], ids[0], ...ids.slice(1)]),
  );
  assert.deepEqual(readComparisonIds(), ids.slice(0, 5));
  for (const broken of ["{", "null", "{}", '"text"']) {
    saved.set(comparisonStorageKey, broken);
    assert.deepEqual(readComparisonIds(), []);
  }
});

test("blocked storage keeps comparison usable and signals that persistence failed", (t) => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      get localStorage() {
        throw new Error("Blocked");
      },
    },
  });
  t.after(() => Reflect.deleteProperty(globalThis, "window"));
  assert.deepEqual(readComparisonIds(), []);
  assert.equal(writeComparisonIds([ids[0]]), false);
});

test("restoration fetches current prices in selection order and retains archived offers", async () => {
  const requested: string[] = [];
  const result = await fetchComparison([ids[1], ids[0]], async (id) => {
    requested.push(id);
    return Response.json({ id, priceLabel: "Updated price", isActive: id !== ids[0] });
  });
  assert.deepEqual(requested, [ids[1], ids[0]]);
  assert.deepEqual(
    result.listings.map((item) => item.id),
    requested,
  );
  assert.equal(result.listings[1].isActive, false);
  assert.equal(result.listings[0].priceLabel, "Updated price");
  assert.deepEqual(result.issues, []);
});

test("partial 404, HTTP 500, network and malformed responses are explicit; retry recovers", async () => {
  const selected = ids.slice(0, 5);
  const result = await fetchComparison(selected, async (id) => {
    const index = selected.indexOf(id);
    if (index === 0) return new Response(null, { status: 404 });
    if (index === 1) return new Response(null, { status: 500 });
    if (index === 2) throw new TypeError("Failed to fetch");
    if (index === 3) return new Response("invalid JSON");
    return Response.json({ id, priceLabel: "Current" });
  });
  assert.deepEqual(
    result.listings.map((item) => item.id),
    [ids[4]],
  );
  assert.deepEqual(
    result.issues.map((item) => item.reason),
    ["missing", "unavailable", "unavailable", "unavailable"],
  );
  assert.deepEqual(selected, ids.slice(0, 5));
  const retried = await fetchComparison(selected, async (id) => Response.json({ id }));
  assert.equal(retried.listings.length, 5);
  assert.deepEqual(retried.issues, []);
});
