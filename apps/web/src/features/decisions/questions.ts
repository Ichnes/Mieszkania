import type { DecisionNote, ListingDetail } from "@mieszkania/shared";

export function emptyNote(key: string, kind: DecisionNote["kind"], label: string): DecisionNote {
  return {
    key,
    kind,
    label,
    answer: "",
    evidence: "",
    checkedAt: "",
    dueAt: "",
    done: false,
    version: 0,
  };
}

export function viewingQuestions(listing: ListingDetail): DecisionNote[] {
  const questions = [
    ["heating", "Jakie jest źródło ogrzewania i czy jest potwierdzone dla tego budynku?"],
    ["renovations", "Jakie remonty budynku są planowane i jak będą finansowane?"],
    ["legal", "Jakie dokumenty potwierdzają stan prawny mieszkania i brak obciążeń?"],
  ];
  if (!listing.maintenanceFeeLabel)
    questions.push(["fees", "Jaki jest czynsz, fundusz remontowy i pozostałe opłaty?"]);
  if (listing.amenityEvidence?.garage !== false)
    questions.push([
      "parking",
      "Czy miejsce parkingowe jest dostępne, ile kosztuje i jaki ma status prawny?",
    ]);
  if (listing.amenityEvidence?.lift === undefined)
    questions.push(["lift", "Czy w budynku jest winda i do którego poziomu dojeżdża?"]);
  if (listing.amenityEvidence?.storage === undefined)
    questions.push([
      "storage",
      "Czy do mieszkania należy komórka lub piwnica i czy jest dodatkowo płatna?",
    ]);
  if (listing.yearBuilt === undefined) questions.push(["year", "W którym roku zbudowano budynek?"]);
  return questions.map(([key, label]) => emptyNote(`question-${key}`, "question", label));
}

export const factNotes = () => [
  emptyNote("fact-area", "fact", "Powierzchnia — poprawna wartość i źródło"),
  emptyNote("fact-rooms", "fact", "Liczba pokoi — poprawna wartość i źródło"),
  emptyNote("fact-floor", "fact", "Piętro — poprawna wartość i źródło"),
  emptyNote(
    "fact-history",
    "fact",
    "Historia / tożsamość mieszkania — rozstrzygnięcie rozbieżności",
  ),
];

export function mergeNotes(suggestions: DecisionNote[], saved: DecisionNote[]) {
  return [...new Map([...suggestions, ...saved].map((note) => [note.key, note])).values()];
}
