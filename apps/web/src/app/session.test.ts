import assert from "node:assert/strict";
import test from "node:test";
import {
  sanitizeListingFilters,
  createListingsQuery,
  readListingsSession,
  writeListingsSession,
  listingsPreferencesStorageKey,
  listingsSessionStorageKey,
} from "./session";

test("only dashboard filters survive a new browser session, including clearing them", (t) => {
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  const storage = (map: Map<string, string>) => ({
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, value),
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage(local), sessionStorage: storage(session) },
  });
  t.after(() => {
    Reflect.deleteProperty(globalThis, "window");
  });
  const value = {
    activeTab: "dashboard" as const,
    filters: { districts: ["Wola"], minPrice: 895000, shortlistedOnly: true },
    listingSort: "price_asc" as const,
    currentListingsPage: 4,
  };
  writeListingsSession(value);
  assert.deepEqual(Object.keys(JSON.parse(local.get(listingsPreferencesStorageKey)!)), ["filters"]);
  session.clear();
  const restored = readListingsSession();
  assert.deepEqual(restored.filters, value.filters);
  assert.equal(restored.listingSort, "newest");
  assert.equal(restored.currentListingsPage, 1);
  writeListingsSession({ ...value, filters: {} });
  session.clear();
  assert.deepEqual(readListingsSession().filters, {});
  local.set(listingsPreferencesStorageKey, "broken JSON");
  session.set(listingsSessionStorageKey, JSON.stringify(value));
  assert.deepEqual(readListingsSession().filters, value.filters);
  writeListingsSession(readListingsSession());
  assert.deepEqual(JSON.parse(local.get(listingsPreferencesStorageKey)!).filters, value.filters);
});

test("blocked browser storage falls back without breaking the dashboard", (t) => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      get localStorage() {
        throw new Error("blocked");
      },
      get sessionStorage() {
        throw new Error("blocked");
      },
    },
  });
  t.after(() => {
    Reflect.deleteProperty(globalThis, "window");
  });
  assert.deepEqual(readListingsSession().filters, {});
  assert.doesNotThrow(() => writeListingsSession(readListingsSession()));
});

test("district multi-selection survives session sanitizing and request serialization", () => {
  const filters = sanitizeListingFilters({
    district: "Wola",
    districts: ["Bemowo", "Ursus", "Bemowo", null, ""],
  });
  assert.deepEqual(filters.districts, ["Bemowo", "Ursus"]);
  assert.equal(filters.district, undefined);
  const query = new URLSearchParams(createListingsQuery(filters, 2, "newest"));
  assert.equal(query.get("districts"), "Bemowo,Ursus");
  assert.deepEqual(sanitizeListingFilters({ district: "Wola" }).district, "Wola");
  assert.deepEqual(sanitizeListingFilters({ district: "Wola", districts: [] }).districts, []);
});
