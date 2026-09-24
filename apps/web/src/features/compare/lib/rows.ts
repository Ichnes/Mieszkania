import { getSunExposure, type ExposureDirection, type FamilySettings } from "@mieszkania/shared";
import { formatPln } from "../../../shared/lib/format";
import { contactStatusDisplay, decisionStageDisplay } from "../../../shared/lib/contact-labels";
import type { ComparisonListing } from "./types";
import type { ComparisonCommutes } from "./commutes";

const missing = "Brak danych";
const yesNo = (value?: boolean) => (value === undefined ? missing : value ? "Tak" : "Nie");
const directionNames: Record<ExposureDirection, string> = {
  N: "Północ",
  NE: "Północny wschód",
  E: "Wschód",
  SE: "Południowy wschód",
  S: "Południe",
  SW: "Południowy zachód",
  W: "Zachód",
  NW: "Północny zachód",
};
function exposureLabel(listing: ComparisonListing) {
  const exposure = getSunExposure(
    listing.description,
    listing.exposureDirectionsOverride ?? listing.manual?.exposureDirectionsOverride,
  );
  const directions = (Object.keys(directionNames) as ExposureDirection[]).filter((direction) =>
    exposure.directions.includes(direction),
  );
  return directions.length
    ? directions.map((direction) => directionNames[direction]).join(" · ")
    : exposure.sideCount
      ? `${exposure.sideCount} strony; kierunki nieznane`
      : missing;
}

export type ComparisonRow = { id: string; label: string; values: string[]; different: boolean };
type Field = { id: string; label: string; value: (listing: ComparisonListing) => string };

const fields: Field[] = [
  {
    id: "active",
    label: "Status oferty",
    value: (l) => (l.isActive === undefined ? missing : l.isActive ? "Aktywna" : "Archiwalna"),
  },
  { id: "price", label: "Aktualna cena", value: (l) => l.priceLabel },
  {
    id: "price-source",
    label: "Źródło aktualnej ceny",
    value: (l) => (l.priceSource === "negotiated" ? "Cena po negocjacjach" : "Ogłoszenie"),
  },
  {
    id: "advertised-price",
    label: "Cena w ogłoszeniu",
    value: (l) =>
      l.advertisedPriceLabel ?? (l.priceSource === "negotiated" ? missing : l.priceLabel),
  },
  {
    id: "total-price",
    label: "Cena z dodatkami",
    value: (l) =>
      l.totalAcquisitionPrice === undefined ? missing : formatPln(l.totalAcquisitionPrice),
  },
  { id: "unit-price", label: "Cena za m²", value: (l) => l.pricePerSqmLabel ?? missing },
  { id: "area", label: "Powierzchnia", value: (l) => l.areaLabel },
  { id: "rooms", label: "Pokoje", value: (l) => l.roomsCount?.toString() ?? missing },
  {
    id: "floor",
    label: "Piętro",
    value: (l) =>
      l.floor === undefined
        ? missing
        : `${l.floor === 0 ? "Parter" : l.floor}${l.totalFloors !== undefined ? ` / ${l.totalFloors}` : ""}`,
  },
  { id: "year", label: "Rok budowy", value: (l) => l.yearBuilt?.toString() ?? missing },
  { id: "garage", label: "Garaż", value: (l) => yesNo(l.hasGarage) },
  { id: "parking", label: "Parking naziemny", value: (l) => yesNo(l.hasOutdoorParking) },
  { id: "lift", label: "Winda", value: (l) => yesNo(l.hasLift) },
  { id: "balcony", label: "Balkon", value: (l) => yesNo(l.hasBalcony) },
  { id: "storage", label: "Komórka lokatorska", value: (l) => yesNo(l.hasStorage) },
  { id: "exposure", label: "Ekspozycja", value: exposureLabel },
  {
    id: "score",
    label: "Dopasowanie do preferencji",
    value: (l) => (l.dreamScore === undefined ? missing : `${l.dreamScore}%`),
  },
  {
    id: "contact",
    label: "Status kontaktu",
    value: (l) => {
      const status = l.manual?.contactStatus ?? l.contactStatus;
      return status ? contactStatusDisplay(status) : missing;
    },
  },
  {
    id: "decision",
    label: "Etap decyzji",
    value: (l) => {
      const stage = l.manual?.decisionStage ?? l.decisionStage;
      return stage ? decisionStageDisplay(stage) : missing;
    },
  },
  {
    id: "negotiated",
    label: "Cena po negocjacjach",
    value: (l) =>
      l.manual?.negotiatedPriceAmount === undefined
        ? missing
        : formatPln(l.manual.negotiatedPriceAmount),
  },
  {
    id: "notes",
    label: "Notatki i ustalenia",
    value: (l) => l.manual?.notes?.trim() || "Brak notatek",
  },
];

export function buildComparisonRows(
  listings: ComparisonListing[],
  workplaces: FamilySettings["workplaces"] = [],
  commutes: ComparisonCommutes = {},
): ComparisonRow[] {
  const commuteFields: Field[] = workplaces.map((workplace) => ({
    id: `commute:${workplace.key}`,
    label: `Dojazd: ${workplace.label}`,
    value: (listing) => {
      if (workplace.latitude === undefined || workplace.longitude === undefined)
        return "Uzupełnij lokalizację celu w ustawieniach";
      if (listing.latitude === undefined || listing.longitude === undefined)
        return "Brak lokalizacji oferty";
      const result = commutes[listing.id];
      if (result === undefined) return "Jeszcze nie obliczono";
      if (result === "error") return "Nie udało się pobrać — ponów obliczenie";
      const commute = result.find(({ key }) => key === workplace.key);
      if (commute?.durationMinutes === undefined) return "Brak wyniku trasy — ponów obliczenie";
      return `około ${commute.durationMinutes} min${commute.distanceKm === undefined ? "" : ` · ${commute.distanceKm.toLocaleString("pl-PL")} km`}${listing.coordinateAccuracy === "approximate" ? " · przybliżona lokalizacja" : ""}`;
    },
  }));
  return [...fields, ...commuteFields].map(({ id, label, value }) => {
    const values = listings.map(value);
    return {
      id,
      label,
      values,
      different: new Set(values.map((text) => text.replace(/\s+/g, " ").trim())).size > 1,
    };
  });
}

export function visibleComparisonRows(
  rows: ComparisonRow[],
  onlyDifferences: boolean,
  listingCount: number,
) {
  return onlyDifferences && listingCount > 1 ? rows.filter((row) => row.different) : rows;
}
