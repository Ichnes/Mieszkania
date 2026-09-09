import { escapeHtml } from "../../../shared/lib/text";
import type { MapCoordinate, MetroMapLine } from "../types";

export function metroStationPopup(line: MetroMapLine, station: MapCoordinate) {
  const status = line.statusLabel ?? (line.planned ? "planowana" : "czynna");
  return `<strong>${line.code} · ${escapeHtml(status)}</strong><br/>${escapeHtml(station.name)}${line.approximate ? "<br/><small>Lokalizacja orientacyjna. Przebieg i wejścia mogą się zmienić.</small>" : ""}${line.sourceUrl ? `<br/><a href="${escapeHtml(line.sourceUrl)}" target="_blank" rel="noopener noreferrer">Plan i źródło lokalizacji</a>` : ""}`;
}
