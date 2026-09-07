import type { ListingSummary } from "@mieszkania/shared";

export function formatPlanningDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pl-PL");
}

export function formatViewingDate(value: string) {
  return new Date(value).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatListingDateLabel(
  listing: Pick<ListingSummary, "publishedAt" | "firstSeenAt">,
) {
  const value = listing.publishedAt ?? listing.firstSeenAt;
  if (!value) {
    return "Brak daty dodania";
  }

  const label = listing.publishedAt ? "Dodano" : "W bazie od";
  return `${label}: ${new Date(value).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function formatOptionalPln(value?: number) {
  return typeof value === "number" ? formatPln(value) : "brak";
}

export function formatDistance(distanceMeters: number) {
  return distanceMeters < 1_000
    ? `${distanceMeters} m`
    : `${(distanceMeters / 1_000).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} km`;
}

export function formatPln(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function parseNumericLabel(value?: string) {
  if (!value) {
    return undefined;
  }

  const match = value.match(/-?\d[\d\s.]*(?:,\d+)?/);
  if (!match?.[0]) {
    return undefined;
  }

  const numeric = Number(match[0].replace(/\s+/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function toDatetimeInputValue(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
