export function parsePortalFloor(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim().toLowerCase();
  if (["ground_floor", "ground floor", "parter"].includes(text)) return 0;
  if (["basement", "souterrain", "suterena"].includes(text)) return -1;
  const match = text.match(/^(?:floor[_ -]?)?(-?\d+)(?:\s*\/\s*\d+)?$/);
  const floor = match ? Number(match[1]) : NaN;
  return Number.isInteger(floor) && floor >= -5 && floor <= 200 ? floor : null;
}

export function getSavedPortalBuildingFacts(snapshot: unknown) {
  function atPath(value: unknown, keys: string[]): unknown {
    for (const key of keys) {
      if (!value || typeof value !== "object") return undefined;
      value = (value as Record<string, unknown>)[key];
    }
    return value;
  }
  const attributes = atPath(snapshot, ["nextData", "props", "pageProps", "ad", "attributes"]);
  const floor = parsePortalFloor(atPath(attributes, ["floor_no"]));
  const totalFloors = parsePortalFloor(atPath(attributes, ["building_floors_num"]));
  return {
    floor: floor ?? undefined,
    totalFloors: totalFloors !== null && totalFloors >= 0 ? totalFloors : undefined,
  };
}
