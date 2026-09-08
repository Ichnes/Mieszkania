export type ExposureDirection = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
function normalizeListingText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l");
}

export function getSunExposure(description?: string) {
  const text = normalizeListingText(description ?? "");
  const exposureText = text
    .replace(/\b(?:ne|nw|se|sw)\b/g, (bearing, offset: number) =>
      /\b(?:ekspozycj\w*|orientacj\w*|okn\w*|balkon\w*|taras\w*)\b/.test(
        text.slice(Math.max(0, offset - 70), offset + 70),
      )
        ? bearing.toUpperCase()
        : bearing,
    )
    // Treat adjectival compound bearings as one diagonal direction. Without
    // this normalization "południowo-zachodnia" can be split into S + W.
    .replace(/\bpoludniow\w*\s*[-â€“â€”]?\s*zachod\w*\b/g, " SW ")
    .replace(/\bpoludniow\w*\s*[-â€“â€”]?\s*wschod\w*\b/g, " SE ")
    .replace(/\bpolnocn\w*\s*[-â€“â€”]?\s*zachod\w*\b/g, " NW ")
    .replace(/\bpolnocn\w*\s*[-â€“â€”]?\s*wschod\w*\b/g, " NE ")
    .replace(/\bgaleri\w*\s+polnoc\w*/g, " ")
    .replace(/\b(?:prag\w*|pradz\w*)\s*[-–—]?\s*(?:poludni|polnoc)\w*/g, " ")
    .replace(/\bwarszaw(?:a|y|ie|e)\s+(?:wschod|zachod)\w*/g, " ")
    .replace(/\b(?:wschod|zachod)\w*\s+slonc\w*/g, " ")
    // Infrastructure names can contain a direction in either word order.
    .replace(
      /\b(?:obwodnic\w*|tras\w*|alej\w*|arteri\w*|drog\w*)\s+(?:poludni|polnoc|wschod|zachod)\w*/g,
      " ",
    )
    .replace(
      /\b(?:poludni|polnoc|wschod|zachod)\w*\s+(?:obwodnic\w*|tras\w*|alej\w*|arteri\w*|drog\w*)/g,
      " ",
    );
  const directions = new Set<ExposureDirection>();
  for (const match of (description ?? "").matchAll(/\b(N|S|E|W)\b/g)) {
    const context = text.slice(Math.max(0, match.index! - 60), match.index! + 60);
    if (/\b(?:ekspozycj\w*|orientacj\w*|okn\w*|stronn\w*)\b/.test(context))
      directions.add(match[1] as ExposureDirection);
  }
  (exposureText.match(/\b(?:NE|NW|SE|SW)\b/g) ?? []).forEach((direction) =>
    directions.add(direction as ExposureDirection),
  );
  // Compound exposure names are diagonal bearings. Two compound bearings,
  // such as north-east / south-west, describe two separate window sides.
  const pairDirections: Array<[RegExp, ExposureDirection]> = [
    [/\bpoludniow?(?:y|a|e|ego|ej|ym|ymi|ych|o)?\s*[-–—]?\s*wschod\w*/g, "SE"],
    [/\bwschodni\w*\s*[-–—]?\s*poludni\w*/g, "SE"],
    [/\bpoludniow?(?:y|a|e|ego|ej|ym|ymi|ych|o)?\s*[-–—]?\s*zachod\w*/g, "SW"],
    [/\bzachodni\w*\s*[-–—]?\s*poludni\w*/g, "SW"],
    [/\bpolnocn?(?:y|a|e|ego|ej|ym|ymi|ych|o)?\s*[-–—]?\s*wschod\w*/g, "NE"],
    [/\bwschodni\w*\s*[-–—]?\s*polnoc\w*/g, "NE"],
    [/\bpolnocn?(?:y|a|e|ego|ej|ym|ymi|ych|o)?\s*[-–—]?\s*zachod\w*/g, "NW"],
    [/\bzachodni\w*\s*[-–—]?\s*polnoc\w*/g, "NW"],
  ];
  let remaining = exposureText;
  const compoundExposures = pairDirections
    .flatMap(([pattern, direction]) =>
      Array.from(remaining.matchAll(pattern), (match) => ({
        direction,
        index: match.index ?? 0,
      })),
    )
    .sort((left, right) => left.index - right.index);
  compoundExposures.forEach(({ direction }) => directions.add(direction));
  for (const [pattern] of pairDirections) {
    remaining = remaining.replace(pattern, " ");
  }
  const diagonalCount = (exposureText.match(/\b(?:NE|NW|SE|SW)\b/g) ?? []).length;

  const cardinalDirections: Record<string, ExposureDirection> = {
    poludni: "S",
    pld: "S",
    polnoc: "N",
    wschod: "E",
    zachod: "W",
    zach: "W",
  };
  for (const match of remaining.matchAll(
    /\b(poludni\w*|pld|polnoc\w*|wschod\w*|zachod\w*|zach)\b/g,
  )) {
    const index = match.index ?? 0;
    const context = remaining.slice(Math.max(0, index - 70), index + match[0].length + 70);
    const hasExposureContext =
      /\b(?:ekspozycj\w*|orientacj\w*|wystaw\w*|okn\w*|balkon\w*|taras\w*|salon\w*|sypialn\w*|przedpokoj\w*|pokoj\w*|widok\w*|wychodz\w*|skierowan\w*|usytuowan\w*|(?:jedno|dwu|troj)stron\w*|od\s+strony|od)\b/.test(
        context,
      );
    if (!hasExposureContext) continue;
    const prefix = Object.keys(cardinalDirections).find((candidate) =>
      match[1].startsWith(candidate),
    );
    if (prefix) directions.add(cardinalDirections[prefix]);
  }

  const sideCount =
    /\b(?:trojstronn\w*|trzystronn\w*)\b|\b(?:trzy|3)\s+stron\w*(?:\s+swiat\w*)?\b/.test(text)
      ? 3
      : /\b(?:cztery|4)\s+stron\w*(?:\s+swiat\w*)?\b/.test(text)
        ? 4
        : /dwustron\w*|\b(?:dwie|dwoch|2)\s+stron\w*/.test(text)
          ? 2
          : /\b(?:jednostronn\w*|jedna strona|jednej stronie)\b/.test(text)
            ? 1
            : Math.max(compoundExposures.length, diagonalCount) >= 2
              ? Math.min(4, Math.max(compoundExposures.length, diagonalCount))
              : undefined;

  return { directions: [...directions], sideCount, isDoubleSided: sideCount === 2 };
}
