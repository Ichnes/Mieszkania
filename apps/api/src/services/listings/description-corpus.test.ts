import assert from "node:assert/strict";
import test from "node:test";
import { getDreamDescriptionFacts } from "@mieszkania/shared";
import { normalizePolish } from "../geography/address-normalization";
import { extractFeatures } from "./listing-repository";

test("material examples distinguish wood, veneer and imitation across features and ranking", () => {
  const cases: Array<[string, boolean]> = [
    ["Drewniana podłoga z litego drewna.", true],
    ["Podłoga z egzotycznego drewna merbau.", true],
    ["Podłoga z paneli laminowanych imitujących drewno.", false],
    ["Podłoga fornirowana drewnem dębowym.", false],
    ["Panele winylowe imitujące parkiet.", false],
    ["Brak drewnianej podłogi.", false],
    ["Meble fornirowane. Podłoga z litego drewna.", true],
  ];
  for (const [description, expected] of cases) {
    assert.equal(
      getDreamDescriptionFacts(normalizePolish(description)).woodenFloor,
      expected,
      description,
    );
    assert.equal(
      extractFeatures({ description }).some((feature) => feature.key === "wooden_floor"),
      expected,
      description,
    );
  }
});

test("normalization cache preserves exact output through eviction and large inputs", () => {
  const original = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[łŁ]/g, "l")
      .toLowerCase();
  for (let i = 0; i < 2300; i++) {
    const value = `${i} ŁÓDŹ Żółć ${"Ą".repeat(i % 200)}`;
    assert.equal(normalizePolish(value), original(value));
    assert.equal(normalizePolish(value), original(value));
  }
  assert.equal(normalizePolish("Ł".repeat(120000)), original("Ł".repeat(120000)));
});
