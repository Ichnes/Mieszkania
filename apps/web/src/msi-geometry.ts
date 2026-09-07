import type { ParcelGeometry } from '@mieszkania/shared';
export type MsiFeature = { id: number; properties: { name: string; district: string }; geometry: ParcelGeometry };
export type MsiCollection = { features: MsiFeature[]; updatedAt: string };
export const projectMsiPoint = ([lon, lat]: number[]) => [(lon - 20.76) / .56 * 1000, (52.42 - lat) / .36 * 1000];
export const geometryRings = (geometry: ParcelGeometry) => geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
export function geometryPath(geometry: ParcelGeometry) {
  return geometryRings(geometry).flatMap(polygon => polygon.map(ring => `M${ring.map(point => projectMsiPoint(point).join(',')).join('L')}Z`)).join('');
}
export function geometryBounds(geometries: ParcelGeometry[]) {
  const points = geometries.flatMap(g => geometryRings(g).flatMap(p => p[0].map(projectMsiPoint)));
  if (!points.length) return { x: 0, y: 0, width: 1000, height: 1000 };
  const x = Math.min(...points.map(p => p[0])), y = Math.min(...points.map(p => p[1]));
  const width = Math.max(...points.map(p => p[0])) - x, height = Math.max(...points.map(p => p[1])) - y;
  const padding = Math.max(width, height) * .07;
  return { x: x - padding, y: y - padding, width: width + padding * 2, height: height + padding * 2 };
}
function inside([x, y]: number[], ring: number[][]) {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) result = !result;
  }
  return result;
}
// Pick a point inside the largest polygon, away from its edges, not its bounding-box centre.
export function geometryLabel(geometry: ParcelGeometry) {
  const polygons = geometryRings(geometry).map(p => p.map(r => r.map(projectMsiPoint)));
  let best: number[] | undefined, distance = -1;
  for (const polygon of polygons) {
    const xs = polygon[0].map(p => p[0]), ys = polygon[0].map(p => p[1]);
    const minX = Math.min(...xs), minY = Math.min(...ys), width = Math.max(...xs) - minX, height = Math.max(...ys) - minY;
    for (let ix = 0; ix < 16; ix++) for (let iy = 0; iy < 16; iy++) {
      const point = [minX + width * (ix + .5) / 16, minY + height * (iy + .5) / 16];
      if (!inside(point, polygon[0]) || polygon.slice(1).some(r => inside(point, r))) continue;
      let clearance = Infinity;
      for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
        const a = ring[i - 1], b = ring[i], dx = b[0] - a[0], dy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
        clearance = Math.min(clearance, Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy));
      }
      if (clearance > distance) { best = point; distance = clearance; }
    }
  }
  return best;
}
