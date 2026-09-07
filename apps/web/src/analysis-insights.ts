import type { ImmediateSurroundingsFinding } from "@mieszkania/shared";
import { normalizeListingText } from "./listing-language";

const surroundingsCategories: Record<ImmediateSurroundingsFinding["category"], string> = {
  railway: "Komunikacja", major_road: "Komunikacja", fuel: "Komunikacja",
  waste: "Odpady i ścieki", industry: "Przemysł i budowy", construction: "Przemysł i budowy",
  power: "Energetyka", nightlife: "Lokale nocne", civic: "Urzędy i służby"
};

export function groupSurroundings(findings: ImmediateSurroundingsFinding[]) {
  const unique = [...new Map(findings.map((finding) => [finding.osmKey, finding])).values()];
  const groups = new Map<string, { label: string; findings: ImmediateSurroundingsFinding[]; nearest: number }>();
  for (const finding of unique) {
    const label = surroundingsCategories[finding.category] ?? "Pozostałe";
    const group = groups.get(label) ?? { label, findings: [], nearest: Infinity };
    group.findings.push(finding);
    group.nearest = Math.min(group.nearest, finding.distanceMeters);
    groups.set(label, group);
  }
  return [...groups.values()].sort((a, b) => a.nearest - b.nearest).map((group) => ({ ...group,
    items: [...new Set(group.findings.map((finding) => finding.category))].map((category) => {
      const members = group.findings.filter((finding) => finding.category === category).sort((a, b) => a.distanceMeters - b.distanceMeters);
      return { category, label: members[0].label, nearest: members[0].distanceMeters, members };
    })
  }));
}

export function analyzeDescription(description: string) {
  const sentences = description.split(/(?<=[.!?;])\s+|\n+/).map((text) => text.trim()).filter(Boolean);
  const rules = [
    { key: "extras", label: "Dodatkowe koszty", match: /(?:dodatkowo platn|obligatoryjn|obowiazkow.{0,25}zakup|prowizj|czynsz.{0,25}\d)/, question: "Jaka jest pełna cena z parkingiem, komórką i prowizją oraz miesięczne opłaty?" },
    { key: "condition", label: "Stan i nakłady", match: /(?:do remontu|wymaga remontu|do odswiezenia|stan.{0,15}dewelopersk|do wymiany)/, question: "Jaki zakres prac i budżet są potrzebne przed zamieszkaniem?", exclude: /(?:nie wymaga|bez koniecznosci).{0,20}remont/ },
    { key: "ownership", label: "Dokumenty do sprawdzenia", match: /(?:ksieg.{0,15}wieczyst|spoldzielcz|uregulowan.{0,15}grunt|udzial.{0,15}nieruchom|sluzebn|dozywoci)/, question: "Poproś o dokument potwierdzający prawo do lokalu i informacje o obciążeniach." },
    { key: "availability", label: "Termin i przekazanie", match: /(?:wynajet|najemc|lokator|dostepn.{0,15}od|wolne od|termin.{0,15}(?:wydania|przekazania))/, question: "Kiedy lokal zostanie przekazany i czy będzie wolny od najemców?", exclude: /(?:bez|brak)\s+(?:najemc|lokator)/ },
    { key: "access", label: "Dostępność budynku", match: /(?:bez windy|brak windy|nie ma windy|schod.{0,15}wejsc)/, question: "Sprawdź dojście, schody i możliwość wniesienia wózka podczas wizyty." }
  ];
  return rules.flatMap((rule) => {
    const evidence = sentences.find((sentence) => {
      const text = normalizeListingText(sentence);
      return rule.match.test(text) && !rule.exclude?.test(text);
    });
    return evidence ? [{ key: rule.key, label: rule.label, question: rule.question, evidence }] : [];
  });
}
