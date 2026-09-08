/** Portal coordinates may be approximate; never synthesize a pair from different nodes. */
export function parseCoordinatePair(latitude: unknown, longitude: unknown) {
  const parse = (value: unknown) =>
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.trim().replace(",", "."))
        : NaN;
  const lat = parse(latitude),
    lon = parse(longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180 ||
    (lat === 0 && lon === 0)
  )
    return undefined;
  return { latitude: lat, longitude: lon };
}

export function extractPortalCoordinates(product: Record<string, unknown>, html: string) {
  const geo = product.geo as Record<string, unknown> | undefined;
  const structured = geo && parseCoordinatePair(geo.latitude, geo.longitude);
  if (structured) return structured;
  // Domiporta microdata (including comma decimal separators).
  const block = html.match(
    /<span[^>]*itemtype=["']https?:\/\/schema.org\/GeoCoordinates["'][^>]*>([\s\S]*?)<\/span>/i,
  )?.[1];
  if (block) {
    const values: Record<string, string> = {};
    for (const match of block.matchAll(/<meta\b[^>]*>/gi)) {
      const name = match[0].match(/itemprop=["'](latitude|longitude)["']/i)?.[1];
      const value = match[0].match(/content=["']([^"']+)["']/i)?.[1];
      if (name && value) values[name.toLowerCase()] = value;
    }
    const point = parseCoordinatePair(values.latitude, values.longitude);
    if (point) return point;
  }
  // Nieruchomosci-online's own map, excluding recommendation widgets.
  const map = html.match(/\bvar\s+mapInitData\s*=\s*(\{[^;]+\});/i)?.[1];
  if (map)
    try {
      const value = JSON.parse(map);
      return parseCoordinatePair(value.latitude, value.longitude);
    } catch {
      /* Broken portal state is not a usable location. */
    }
  return undefined;
}
