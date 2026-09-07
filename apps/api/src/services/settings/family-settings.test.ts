import { createDefaultDreamListingProfile } from "@mieszkania/shared";
import assert from "node:assert/strict";
import test from "node:test";
import { mergeSettings, normalizeDreamProfile } from "./family-settings";

test("keeps newly added preferred districts beyond the old twelve-item limit", () => {
  const preferredDistricts = [
    "Bemowo",
    "Białołęka",
    "Bielany",
    "Mokotów",
    "Praga-Południe",
    "Praga-Północ",
    "Śródmieście",
    "Ursus",
    "Ursynów",
    "Wawer",
    "Wilanów",
    "Wola",
    "Ochota",
  ];

  const normalized = normalizeDreamProfile({
    ...createDefaultDreamListingProfile(),
    preferredDistricts,
  });

  assert.equal(normalized.preferredDistricts.length, 13);
  assert.equal(normalized.preferredDistricts.at(-1), "Ochota");
});

test("removes duplicate preferred districts while preserving their order", () => {
  const normalized = normalizeDreamProfile({
    ...createDefaultDreamListingProfile(),
    preferredDistricts: ["Mokotów", "Ochota", "Mokotów", "Ochota"],
  });

  assert.deepEqual(normalized.preferredDistricts, ["Mokotów", "Ochota"]);
});

test("fresh installs have no personal addresses and merging keeps locally saved workplaces", () => {
  assert.deepEqual(mergeSettings().workplaces, []);
  const workplaces = [
    {
      key: "user-office",
      label: "Moje miejsce",
      address: "Adres testowy",
      latitude: 50,
      longitude: 19,
    },
  ];
  assert.deepEqual(mergeSettings({ workplaces }).workplaces, workplaces);
  assert.deepEqual(mergeSettings({ workplaces: [] }).workplaces, []);
});
