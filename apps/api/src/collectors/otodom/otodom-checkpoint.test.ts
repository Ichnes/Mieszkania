import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultSearchContract } from "@mieszkania/shared";
import { checkpointKey } from "./otodom-checkpoint";

test("checkpoints belong to the actual portal query, irrespective of district order", () => {
  const contract = { ...createDefaultSearchContract(), districts: ["Mokotów", "Wola"] };
  const key = checkpointKey("Warszawa", contract);
  assert.equal(key, checkpointKey("warszawa", { ...contract, districts: ["Wola", "Mokotów"] }));
  assert.notEqual(key, checkpointKey("warszawa", { ...contract, minPrice: 123456 }));
  assert.notEqual(key, checkpointKey("warszawa", { ...contract, districts: ["Wola"] }));
});
