// Match semantic gallery markers, never generated CSS class names or the chip alone.
export function extractOtodomFloorPlans(
  html: string,
  ad: Record<string, unknown> | null,
): string[] {
  const urls: string[] = [];
  const add = (value: unknown) => {
    if (typeof value !== "string") return;
    let url = value.replace(/&amp;/g, "&").trim();
    if (/^https:\/\/[^/]+\.olxcdn\.com\/.+\/image$/i.test(url)) url += ";s=2048x1536;q=80";
    if (/^https?:\/\//i.test(url)) urls.push(url);
  };
  // Otodom's initial page data keeps plans outside the ordinary images array.
  for (const plan of Array.isArray(ad?.floorPlans) ? ad.floorPlans : []) {
    if (typeof plan === "string") add(plan);
  }
  for (const picture of html.matchAll(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi)) {
    if (!/MosaicFloorPlanImage|alt=["']Rzut(?: tego lokalu)?["']/i.test(picture[0])) continue;
    const highResolution = picture[0].match(/\bsrcset=["']([^"']+)["']/i)?.[1]?.split(/\s+/)[0];
    add(highResolution ?? picture[0].match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1]);
  }
  for (const img of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/alt=["']Rzut(?: tego lokalu)?["']/i.test(img[0])) continue;
    const url = img[0].match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (url && !urls.some((existing) => imageIdentity(existing) === imageIdentity(url))) add(url);
  }
  const images = Array.isArray(ad?.images) ? ad.images : [];
  for (const value of images) {
    if (!value || typeof value !== "object") continue;
    const image = value as Record<string, unknown>;
    if (
      image.isFloorPlan === true ||
      /^(floor_?plan|rzut)$/i.test(String(image.type ?? image.category ?? ""))
    ) {
      add(image.large ?? image.original ?? image.url ?? image.medium);
    }
  }
  return [...new Map(urls.map((url) => [imageIdentity(url), url])).values()];
}

export function imageIdentity(url: string): string {
  return url.replace(/;s=[^;?]+(?:;q=\d+)?/, "");
}
