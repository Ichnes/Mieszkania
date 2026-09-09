import assert from "node:assert/strict";
import test from "node:test";
import { parseTramwayMap } from "./tramway-map";

test("tram routes retain geometry and connect route numbers to named stops", () => {
  const result = parseTramwayMap([
    { type: "node", id: 1, lat: 52.2, lon: 21, tags: { name: "Przystanek" } },
    {
      type: "way",
      id: 2,
      geometry: [
        { lat: 52.2, lon: 21 },
        { lat: 52.21, lon: 21.01 },
      ],
    },
    {
      type: "relation",
      id: 3,
      tags: { ref: "17" },
      members: [
        { type: "node", ref: 1, role: "stop" },
        { type: "way", ref: 2 },
      ],
    },
  ]);
  assert.deepEqual(result.routes[0].lines, [
    [
      [52.2, 21],
      [52.21, 21.01],
    ],
  ]);
  assert.deepEqual(result.stops[0].routes, ["17"]);
});

test("stops-only response cannot masquerade as usable tram routes", () => {
  assert.equal(
    parseTramwayMap([{ type: "node", id: 1, lat: 52.2, lon: 21, tags: { name: "Przystanek" } }])
      .routes.length,
    0,
  );
});
