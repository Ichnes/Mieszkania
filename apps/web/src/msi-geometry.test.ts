import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { geometryBounds, geometryLabel, geometryPath, geometryRings, type MsiCollection } from './msi-geometry';
const data: MsiCollection = JSON.parse(readFileSync(new URL('../public/data/warsaw-msi.geojson', import.meta.url), 'utf8'));
test('MSI snapshot has real closed polygons in Warsaw and all 18 districts', () => {
  assert.ok(data.features.length >= 142);
  assert.equal(new Set(data.features.map(f => f.properties.district)).size, 18);
  assert.equal(new Set(data.features.map(f => f.id)).size, data.features.length);
  for (const f of data.features) for (const polygon of geometryRings(f.geometry)) for (const ring of polygon) {
    assert.ok(ring.length >= 4, f.properties.name);
    assert.deepEqual(ring[0], ring.at(-1));
    assert.ok(ring.every(([x, y]) => x > 20.7 && x < 21.4 && y > 52 && y < 52.5));
  }
});
test('Wola Grzybowska belongs to Wesoła, not Wola', () => {
  assert.equal(data.features.find(f => f.properties.name === 'Wola Grzybowska')?.properties.district, 'Wesoła');
});
test('all actual geometries have finite paths, labels and bounds', () => {
  for (const feature of data.features) {
    assert.doesNotMatch(geometryPath(feature.geometry), /NaN|undefined|Infinity/);
    assert.ok(geometryLabel(feature.geometry)?.every(Number.isFinite), feature.properties.name);
    const bounds = geometryBounds([feature.geometry]);
    assert.ok(bounds.width > 0 && bounds.height > 0);
  }
});
test('SVG retains holes and separate parts of a multipolygon', () => {
  const ring: [number, number][] = [[21,52.2],[21.1,52.2],[21.1,52.3],[21,52.2]];
  assert.equal((geometryPath({type:'MultiPolygon',coordinates:[[ring,ring],[ring]]}).match(/Z/g) ?? []).length, 3);
});
