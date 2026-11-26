const register = String.raw`(?:k\.?\s*w\.?|ksi[eę]gi\s+wieczystej)`;
const registerAbsent = String.raw`(?:brak|bez|nie\s+(?:posiada(?:m|my)?|ma(?:m|my)?))\s+(?:(?:za[łl]o[żz]onej|odr[eę]bnej|w[łl]asnej)\s+)?${register}`;
const only = String.raw`(?:tylko|wy[łl][aą]cznie|jedynie)`;
const cash = String.raw`(?:za\s+)?got[oó]wk[aąęe]`;
const transaction = String.raw`(?:zakup|sprzeda[żz]|p[łl]atno[śs][ćc])`;
const cashOnly = [
  String.raw`${transaction}\s+(?:mo[żz]liw[ay]\s+)?(?:${only}\s+)?${cash}`,
  String.raw`${only}\s+(?:${transaction}\s+)?${cash}`,
  String.raw`(?:przyjmuj[eę]|akceptuj[eę])\s+(?:${only}\s+${cash}|${cash}\s+${only})`,
  String.raw`${cash}\s+${only}`,
].join("|");
const evidence = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(?:(?<register>${registerAbsent})|(?<cash>${cashOnly}))(?![\p{L}\p{N}])`,
  "giu",
);

export function saleConditions(text: string) {
  const matches: { index: number; text: string; badge: "Brak KW" | "Tylko gotówka" }[] = [];
  for (const match of text.matchAll(evidence)) {
    if (match.groups?.cash) {
      const before =
        text
          .slice(0, match.index)
          .split(/[.!?;\n]/u)
          .pop() ?? "";
      const after = text.slice(match.index + match[0].length).split(/[.!?;\n]/u)[0];
      if (
        /(?:\bnie|preferowan[ay]|preferuj[eę]|r[oó]wnie[żz]|tak[żz]e)\s*$/iu.test(before) ||
        /(?:lub|albo|b[aą]d[źz])\s+(?:(?:zakup|p[łl]atno[śs][ćc]|na|z|za)\s+)*(?:kredyt|finansowan)/iu.test(
          after,
        ) ||
        /kredyt\p{L}*\s+(?:lub|albo|b[aą]d[źz])\s*$/iu.test(before)
      )
        continue;
    }
    matches.push({
      index: match.index,
      text: match[0],
      badge: match.groups?.register ? "Brak KW" : "Tylko gotówka",
    });
  }
  return matches;
}
