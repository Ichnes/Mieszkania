import type { computeDreamEvaluation } from "@mieszkania/shared";

type ScoreRow = ReturnType<typeof computeDreamEvaluation>["rows"][number];

/** Explains the awarded branch; never recalculates points or guesses from a rounded percentage. */
export function getScoreBand(row: ScoreRow): string {
  if (row.dataStatus === "inactive") return "Kryterium wyłączone";
  const points = `${row.points > 0 ? "+" : ""}${row.points} pkt`;
  if (
    [
      "Piętro",
      "Cena zakupu",
      "Cena za m²",
      "Szacowana rata",
      "Dojazd do pracy",
      "Liczba pokoi",
    ].includes(row.label)
  )
    return `${row.dataStatus === "unknown" ? "Dane niepełne / niepotwierdzone; " : ""}${row.detail}: ${points}`;
  const bands: Record<string, Record<number, string>> = {
    Metraż: { 20: "W zakresie", 10: "Do 5 m² poza zakresem", [-3]: "Ponad 5 m² poza zakresem" },

    "Stan wykończenia": {
      16: "Gotowe do zamieszkania",
      5: "Do wykończenia, poniżej 17 tys. zł/m²",
      1: "Do wykończenia, 17–18 tys. zł/m²",
      [-4]: "Do wykończenia, powyżej 18–19 tys. zł/m²",
      [-8]: "Do wykończenia, powyżej 19–20 tys. zł/m²",
      [-12]: "Do wykończenia, powyżej 20–21 tys. zł/m²",
      [-18]: "Do wykończenia, powyżej 21 tys. zł/m²",
      [-10]: "Do wykończenia, brak ceny za m²",
    },
    "Rok budowy": {
      [-4]: "Do 1980",
      [-2]: "1981–1990",
      0: "1991–2000",
      4: "2001–2005",
      6: "2006–2010",
      8: "2011–2015",
      10: "2016–2020",
      12: "Po 2020",
      14: "Po 2020 i rok bieżący lub poprzedni (w tym +2)",
    },
    Metro: {
      13: "Poniżej 60% limitu",
      10: "Od 60% do 100% limitu",
      5: "Powyżej 100% do 150% limitu",
      [-3]: "Powyżej 150% limitu",
    },

    "Obniżka ceny": {
      0: "Brak obniżki",
      2: "Spadek powyżej 0 do 1%",
      4: "Spadek powyżej 1 do 2%",
      5: "Spadek powyżej 2 do 3%",
      6: "Spadek powyżej 3 do 4%",
      7: "Spadek powyżej 4%",
    },
    "Wiek oferty": { 2: "Do 20 dni", [-1]: "Powyżej 20 do 40 dni", [-2]: "Powyżej 40 dni" },
    "Sprzedający / prowizja": {
      [-15]: "Prowizja dla kupującego",
      10: "Oferta prywatna lub bezpośrednia bez oznaczenia prowizji",
      0: "Bez premii za sprzedaż bezpośrednią i bez oznaczenia prowizji",
    },
    Blat: { 7: "Granit, konglomerat lub spiek", 5: "Drewno" },
    "Remont / odświeżenie": { 4: "Remont", 3: "Odświeżenie" },
  };
  if (row.label === "Stan wykończenia" && row.points === -10)
    return `${bands[row.label][-10]}: ${points}`;
  if (row.dataStatus === "unknown")
    return `Dane niepełne / niepotwierdzone: ${points}${row.detail ? ` (${row.detail})` : ""}`;
  const band = bands[row.label]?.[row.points];
  if (band) return `${band}: ${points}`;
  if (row.label === "Garaż i winda razem")
    return `${row.points > 0 ? "Garaż i winda są dostępne" : "Brak kompletu obu udogodnień"}: ${points}`;
  return `${row.detail || (row.points > 0 ? "Potwierdzona cecha" : "Warunek premii niespełniony")}: ${points}`;
}
