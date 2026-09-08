import type { ImmediateSurroundingsFinding } from "@mieszkania/shared";

const surroundingsCategories: Record<ImmediateSurroundingsFinding["category"], string> = {
  railway: "Komunikacja",
  major_road: "Komunikacja",
  fuel: "Komunikacja",
  waste: "Odpady i ścieki",
  industry: "Przemysł i budowy",
  construction: "Przemysł i budowy",
  power: "Energetyka",
  nightlife: "Lokale nocne",
  civic: "Urzędy i służby",
};

export function groupSurroundings(findings: ImmediateSurroundingsFinding[]) {
  const unique = [...new Map(findings.map((finding) => [finding.osmKey, finding])).values()];
  const groups = new Map<
    string,
    { label: string; findings: ImmediateSurroundingsFinding[]; nearest: number }
  >();
  for (const finding of unique) {
    const label = surroundingsCategories[finding.category] ?? "Pozostałe";
    const group = groups.get(label) ?? { label, findings: [], nearest: Infinity };
    group.findings.push(finding);
    group.nearest = Math.min(group.nearest, finding.distanceMeters);
    groups.set(label, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.nearest - b.nearest)
    .map((group) => ({
      ...group,
      items: [...new Set(group.findings.map((finding) => finding.category))].map((category) => {
        const members = group.findings
          .filter((finding) => finding.category === category)
          .sort((a, b) => a.distanceMeters - b.distanceMeters);
        return { category, label: members[0].label, nearest: members[0].distanceMeters, members };
      }),
    }));
}
