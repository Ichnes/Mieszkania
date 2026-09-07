const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  oacute: "ó",
  Oacute: "Ó",
  aacute: "á",
  Aacute: "Á",
  eacute: "é",
  Eacute: "É",
  uuml: "ü",
  Uuml: "Ü",
  ouml: "ö",
  Ouml: "Ö",
  auml: "ä",
  Auml: "Ä",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  bull: "•",
  middot: "·",
  sup2: "²",
  sup3: "³",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  times: "×",
  deg: "°",
};
/** Decode portal text as text, never as executable HTML. */
export function decodeListingText(value: string) {
  let text = value;
  for (let pass = 0; pass < 3; pass++) {
    const decoded = text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (entity, key: string) => {
      if (!key.startsWith("#")) return entities[key] ?? entity;
      const hex = key[1].toLowerCase() === "x";
      const code = parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : "�";
    });
    if (decoded === text) break;
    text = decoded;
  }
  return text;
}
