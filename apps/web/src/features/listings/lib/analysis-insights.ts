import type { ImmediateSurroundingsFinding } from "@mieszkania/shared";
import { normalizeListingText } from "./listing-language";

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

export function analyzeDescription(description: string, floor?: number) {
  const sentences = description
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((text) => text.trim())
    .filter(Boolean);
  const rules = [
    {
      key: "ownership",
      label: "Ograniczenia prawa do lokalu",
      match:
        /(?:nieuregulowan.{0,20}grunt|brak.{0,20}ksieg|bez.{0,15}ksieg.{0,15}wieczyst|sluzebn|dozywoci|udzial.{0,20}(?:lokalu|mieszkaniu))/,
      exclude: /(?:bez|brak)\s+(?:sluzebnosci|dozywocia)|nie\s+ma\s+(?:sluzebnosci|dozywocia)/,
      reason:
        "Opis wskazuje na stan prawny, który trzeba wyjaśnić przed rezerwacją i rozmową o finansowaniu.",
      question:
        "Poproś o dokument określający sprzedawane prawo oraz opis ograniczeń. Czy kupujesz cały lokal i co dokładnie pozostanie wpisane po sprzedaży?",
    },
    {
      key: "availability",
      label: "Lokal z najemcą",
      match:
        /\b(?:wynajet\w*|(?:z|obecn\w*|aktualn\w*)\s+(?:najemc\w*|lokator(?:zy|ow|ami|a|em|om|ach)?))\b/,
      exclude:
        /(?:bez|brak)\s+(?:najemc|lokator)|woln\w*\s+od\s+(?:najemc|lokator)|nie\s+jest\s+wynajet/,
      reason: "Termin zakupu i możliwość zamieszkania mogą się różnić, jeżeli trwa umowa najmu.",
      question:
        "Do kiedy obowiązuje umowa najmu? Czy sprzedający zobowiąże się do przekazania pustego lokalu w uzgodnionym terminie i wpisze to do umowy?",
    },
    {
      key: "extras",
      label: "Warunki zakupu dodatków",
      match: /(?:dodatkowo platn|obligatoryjn|obowiazkow.{0,25}zakup)/,
      reason:
        "Cena na karcie może nie obejmować wszystkich elementów sprzedawanych razem z mieszkaniem.",
      question:
        "Czy można kupić mieszkanie bez wskazanych dodatków? Poproś o zestawienie elementów obowiązkowych i opcjonalnych oraz jednej łącznej kwoty do umowy.",
    },
    {
      key: "commission",
      label: "Prowizja kupującego",
      match: /(?:prowizj|wynagrodzenie (?:biura|agencji))/,
      exclude:
        /(?:(?:bez|brak)\s+prowizji|0\s*%\s*prowizji|nie\s+(?:placi|pobieramy|pobiera)\s+prowizji)/,
      reason:
        "Wzmianka o prowizji nie określa sama w sobie, kto ją płaci ani kiedy powstaje obowiązek zapłaty.",
      question:
        "Czy kupujący podpisuje umowę z biurem? Poproś o kwotę brutto, termin zapłaty i warunki naliczenia prowizji przed umówieniem prezentacji.",
    },
    {
      key: "condition",
      label: "Zakres remontu",
      match: /(?:do remontu|wymaga remontu|do odswiezenia|do wymiany)/,
      exclude: /(?:nie wymaga|bez koniecznosci).{0,20}remont/,
      reason:
        "Określenie stanu nie mówi, czy wystarczą prace kosmetyczne, czy trzeba wymienić instalacje.",
      question:
        "Co konkretnie jest do wymiany: elektryka, hydraulika, okna czy tylko wykończenie? Poproś o daty ostatnich prac i sprawdź ten zakres podczas oglądania.",
    },
    {
      key: "finish",
      label: "Co obejmuje standard deweloperski",
      match: /stan.{0,15}dewelopersk|(?:opcj\w*|mozliwosc)\s+wykonczenia\s+pod\s+klucz/,
      reason: "Zakres wyposażenia decyduje o pracach potrzebnych przed przeprowadzką.",
      question:
        "Poproś o specyfikację odbioru: instalacje, ogrzewanie, tynki, wylewki i drzwi. Które z pokazanych zdjęć są wizualizacjami, a które przedstawiają sprzedawany lokal?",
    },
    {
      key: "access",
      label: "Codzienne wejście do mieszkania",
      match: /(?:bez windy|brak windy|nie ma windy)/,
      reason: "Brak windy warto ocenić na całej drodze od wejścia lub garażu do lokalu.",
      question:
        "Czy po drodze są dodatkowe schody i gdzie można zostawić wózek lub rower? Sprawdź tę trasę podczas oglądania, również od parkingu.",
    },
  ];
  return rules
    .flatMap((rule) => {
      if (rule.key === "access" && floor === 0) return [];
      const evidence = sentences.find((sentence) => {
        const text = normalizeListingText(sentence);
        return rule.match.test(text) && !rule.exclude?.test(text);
      });
      if (!evidence) return [];
      let question = rule.question;
      if (rule.key === "extras" && /obligatoryjn|obowiazkow/.test(normalizeListingText(evidence))) {
        question =
          "Poproś o jedną łączną cenę mieszkania i obowiązkowych dodatków oraz potwierdzenie, jakie prawo do parkingu lub komórki otrzymujesz. Czy każda opłata jest już uwzględniona?";
      }
      return [{ key: rule.key, label: rule.label, reason: rule.reason, question, evidence }];
    })
    .slice(0, 4);
}
