export function cashPurchaseEvidence(description = "") {
  const phrase =
    /(?:tylko|wyłącznie|jedynie)\s+(?:(?:zakup|sprzedaż|płatność)\s+)?(?:za\s+)?gotówk[ęą]|(?:zakup|sprzedaż|płatność)\s+(?:(?:tylko|wyłącznie)\s+)?(?:za\s+gotówkę|gotówką)/iu;
  for (const sentence of description.split(/[.!?;\n]/u)) {
    if (
      /nie tylko|(?:lub|albo|bądź)\s+(?:za\s+|na\s+|z\s+)?(?:kredyt|gotów)|preferowan[ay]|możliwość zakupu/iu.test(
        sentence,
      )
    )
      continue;
    const evidence = sentence.match(phrase)?.[0];
    if (evidence) return evidence;
  }
}

const addonTerms = {
  garage: /miejsc|parking|garaż/iu,
  storage: /komórk|piwnic/iu,
  garden: /ogród|ogródk/iu,
  garageAndStorage:
    /(?:miejsc|parking|garaż).*(?:komórk|piwnic)|(?:komórk|piwnic).*(?:miejsc|parking|garaż)/iu,
};

export function mandatoryAddons(
  description: string | undefined,
  costs: { garage?: number; storage?: number; garden?: number; garageAndStorage?: number },
) {
  const statements = (description ?? "")
    .split(/[.!?;\n]/u)
    .filter(
      (sentence) =>
        /(?:obowiązkow|obligatoryjn|konieczność\s+(?:zakupu|dokupienia))/iu.test(sentence) &&
        !/(?:nie\s+(?:jest|są)\s+|nie)(?:obowiązkow|obligatoryjn)|opcjonaln/iu.test(sentence),
    );
  const priced = (Object.keys(addonTerms) as (keyof typeof addonTerms)[]).filter(
    (key) => (costs[key] ?? 0) > 0,
  );
  return (
    priced.length > 0 &&
    priced.every((key) => statements.some((sentence) => addonTerms[key].test(sentence)))
  );
}
