export function extractOtodomExternalId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "www.otodom.pl" && parsed.hostname !== "otodom.pl") return null;
    const match = parsed.pathname.match(/^\/pl\/oferta\/[^/]+-ID([a-zA-Z0-9]+)\/?$/);
    return match ? `otodom-${match[1]}` : null;
  } catch {
    return null;
  }
}
