/** Count explicitly attached to parking spaces, including declined Polish numerals. */
export function extractParkingSpaceCount(value: string): number | undefined {
  const text = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[łŁ]/g, "l")
    .toLowerCase();
  const numbers: Record<string, number> = {
    jedno: 1,
    jednego: 1,
    dwa: 2,
    dwie: 2,
    dwoch: 2,
    dwoma: 2,
    trzy: 3,
    trzech: 3,
    cztery: 4,
    czterech: 4,
    piec: 5,
    pieciu: 5,
  };
  const matches = [
    ...text.matchAll(
      /\b(\d{1,2}|jedno|jednego|dwa|dwie|dwoch|dwoma|trzy|trzech|cztery|czterech|piec|pieciu)\s*,?\s*(?:(?:odrebn|niezalezn|prywatn|wlasn|naziemn|zewnetrzn|podziemn)\w*\s+){0,3}(?:miejsc\w*|stanowisk\w*)\s+(?:postojow|parkingow|garazow)\w*/g,
    ),
  ];
  const token = matches.at(-1)?.[1];
  const count = token ? Number(token) || numbers[token] : undefined;
  return count && count <= 20 ? count : undefined;
}
