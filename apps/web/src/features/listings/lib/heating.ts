export function getHeatingEvidence(description?: string) {
  const matches = new Map<string, string>();
  for (const original of (description ?? "").split(/[.!?;\n]+/)) {
    const text = original
      .toLocaleLowerCase("pl")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ł/g, "l");
    // Negated, prospective and uncertain statements cannot establish the heating source.
    if (/\b(nie|brak|bez|planowan\w*|mozliw\w*|prawdopodob\w*|docelow\w*)\b/.test(text)) continue;
    const rules: [string, RegExp][] = [
      [
        "Ogrzewanie miejskie",
        /ogrzewani\w*\s*[:–—-]?\s*(miejsk\w*|z sieci)|cieplo\s+(miejskie|z sieci)|(?:miejsk\w*|sieciow\w*)\s+ogrzewani\w*|podlacz\w*\s+do\s+(?:miejskiej\s+)?sieci cieplowniczej/,
      ],
      [
        "Kotłownia budynku / osiedla",
        /(?:wlasn\w*|lokaln\w*|osiedlow\w*|budynkow\w*)\s+kotlown\w*|kotlown\w*\s+(?:w budynku|budynku|osiedlow\w*)/,
      ],
      ["Ogrzewanie gazowe", /ogrzewani\w*\s*[:–—-]?\s*gazow\w*|(?:piec|kociol)\s+gazow\w*/],
      ["Ogrzewanie elektryczne", /ogrzewani\w*\s*[:–—-]?\s*elektryczn\w*/],
      ["Pompa ciepła", /pomp\w*\s+ciepla/],
    ];
    for (const [label, pattern] of rules)
      if (pattern.test(text)) matches.set(label, original.trim());
  }
  // A building boiler can itself be gas fired; preserve both facts as one source.
  if (matches.has("Kotłownia budynku / osiedla")) matches.delete("Ogrzewanie gazowe");
  return {
    label:
      matches.size === 1
        ? [...matches.keys()][0]
        : matches.size > 1
          ? "Różne źródła ogrzewania w opisie"
          : "Ogrzewanie nieustalone",
    evidence: [...new Set(matches.values())],
    uncertain: true,
  };
}
