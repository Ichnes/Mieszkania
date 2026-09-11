import { getSunExposure, type ExposureDirection } from "./sun-exposure.js";

export const exposureDirections: ExposureDirection[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export function normalizeExposureDirections(value: unknown): ExposureDirection[] {
  const items = typeof value === "string" ? value.split(",") : Array.isArray(value) ? value : [];
  return exposureDirections.filter((direction) => items.includes(direction));
}
export function hasExposureFilter(value: unknown): boolean {
  const count = normalizeExposureDirections(value).length;
  return count > 0 && count < 8;
}
export function matchesExposureFilter(
  description: string,
  selected: unknown,
  override?: ExposureDirection[] | null,
): boolean {
  const directions = normalizeExposureDirections(selected);
  if (!hasExposureFilter(directions)) return true;
  const actual = getSunExposure(description, override).directions;
  return actual.some((direction) => directions.includes(direction));
}
