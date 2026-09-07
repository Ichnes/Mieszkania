import assert from "node:assert/strict";
import test from "node:test";
import {
  parcelGeometryContainsPoint,
  parseUldkParcelResponse,
  parseWktGeometry,
} from "./listing-parcel-context";

test("parses the official ULDK pipe-delimited parcel response", () => {
  const result = parseUldkParcelResponse(
    [
      "0",
      "146510_8.0502.1/3|1/3|Warszawa (miasto)|5-05-02|powiatowy WFS|SRID=4326;POLYGON((21.01 52.22,21.02 52.22,21.01 52.22))",
    ].join("\n"),
  );

  assert.equal(result?.id, "146510_8.0502.1/3");
  assert.equal(result?.number, "1/3");
  assert.equal(result?.commune, "Warszawa (miasto)");
  assert.deepEqual(result?.geometry, {
    type: "Polygon",
    coordinates: [
      [
        [21.01, 52.22],
        [21.02, 52.22],
        [21.01, 52.22],
      ],
    ],
  });
});

test("parses multipolygon parcel geometry", () => {
  assert.deepEqual(
    parseWktGeometry("SRID=4326;MULTIPOLYGON(((21 52,22 52,21 52)),((23 53,24 53,23 53)))"),
    {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [21, 52],
            [22, 52],
            [21, 52],
          ],
        ],
        [
          [
            [23, 53],
            [24, 53],
            [23, 53],
          ],
        ],
      ],
    },
  );
});

test("returns null for an unsuccessful ULDK status", () => {
  assert.equal(parseUldkParcelResponse("1\n"), null);
});

test("reuses a cached parcel only when the listing point is inside its geometry", () => {
  const geometry = parseWktGeometry(
    "POLYGON((21.00 52.20,21.02 52.20,21.02 52.22,21.00 52.22,21.00 52.20))",
  );
  assert.equal(parcelGeometryContainsPoint(geometry, 52.21, 21.01), true);
  assert.equal(parcelGeometryContainsPoint(geometry, 52.23, 21.01), false);
});
