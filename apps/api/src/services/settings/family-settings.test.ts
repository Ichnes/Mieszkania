import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultFamilySettings } from "@mieszkania/shared";
import { mergeSettings, normalizeDreamProfile } from "./family-settings";
import { createDefaultDreamListingProfile } from "@mieszkania/shared";

test("legacy weights are discarded while current preferences survive normalization", () => {
  const defaults = createDefaultFamilySettings();
  const legacy = {
    ...defaults,
    financing: { downPayment: 500000 },
    weights: { user: { price: 7 } },
    maxWeightTotal: 80,
  };
  const cleaned = mergeSettings(legacy);
  assert.equal("weights" in cleaned, false);
  assert.equal("maxWeightTotal" in cleaned, false);
  assert.equal(cleaned.financing?.downPayment, 500000);
  assert.deepEqual(cleaned.dreamProfile, defaults.dreamProfile);
});
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

test("saved financing preserves zero and normalizes invalid down payments", () => {
  assert.equal(mergeSettings({ financing: { downPayment: 0 } }).financing?.downPayment, 0);
  assert.equal(
    mergeSettings({ financing: { downPayment: 250000.4 } }).financing?.downPayment,
    250000,
  );
  assert.equal(mergeSettings({ financing: { downPayment: -1 } }).financing?.downPayment, 0);
  assert.equal(
    mergeSettings({ financing: { downPayment: NaN } }).financing?.downPayment,
    mergeSettings().financing?.downPayment,
  );
});
