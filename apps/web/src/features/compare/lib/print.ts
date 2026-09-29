import type { ComparisonRow } from "./rows";
import type { ComparisonListing } from "./types";

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}
function sourceLink(url: string | undefined, label: string) {
  if (!url) return "Brak linku źródłowego";
  try {
    if (!["https:", "http:"].includes(new URL(url).protocol))
      return "Brak poprawnego linku źródłowego";
  } catch {
    return "Brak poprawnego linku źródłowego";
  }
  return `<a href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}
export function comparisonPrintHtml(
  listings: ComparisonListing[],
  rows: ComparisonRow[],
  includeNotes: boolean,
  date = new Date(),
) {
  const exported = rows.filter(
    (row) => includeNotes || !["notes", "contact", "decision", "negotiated"].includes(row.id),
  );
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Porównanie mieszkań</title><style>
@page { size: A4 landscape; margin: 12mm; } body { font: 11px Arial,sans-serif; color:#172333; } h1 { font-size:22px; } table { width:100%; border-collapse:collapse; table-layout:fixed; } th,td { border:1px solid #bbc4ce; padding:7px; vertical-align:top; overflow-wrap:anywhere; white-space:pre-wrap; } th { background:#eef2f7; } thead { display:table-header-group; } tr { break-inside:avoid; } a { color:#174d84; } .sources { margin-top:15px; } @media screen { body { max-width:1400px; margin:24px auto; padding:12px; } }
</style></head><body><h1>Porównanie mieszkań</h1><p>Stan zapisanych danych: ${escapeHtml(date.toLocaleString("pl-PL"))}. Brak danych oznacza niewiadomą. Cena z dodatkami obejmuje tylko rozpoznane koszty; pozostałe opłaty wymagają potwierdzenia.</p>
<table><thead><tr><th>Cecha</th>${listings.map((l) => `<th>${escapeHtml(l.title)}</th>`).join("")}</tr></thead><tbody>${exported.map((row) => `<tr><th>${escapeHtml(row.label)}</th>${row.values.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table>
<section class="sources"><h2>Źródła</h2>${listings.map((l) => `<p><strong>${escapeHtml(l.title)}</strong><br>${[sourceLink(l.canonicalUrl, l.sourceLabel || "Ogłoszenie"), ...(l.relatedListings ?? []).map((source) => sourceLink(source.canonicalUrl, source.sourceLabel || source.title))].join(" · ")}</p>`).join("")}</section></body></html>`;
}

export function printComparison(html: string) {
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.getElementById("comparison-print-frame")?.remove();
  const frame = document.createElement("iframe");
  frame.id = "comparison-print-frame";
  frame.title = "Wydruk porównania";
  frame.setAttribute("sandbox", "allow-same-origin allow-modals");
  frame.style.cssText = "position:fixed;width:1px;height:1px;left:-10000px;top:0;border:0";
  frame.onload = () => {
    frame.contentWindow?.addEventListener(
      "afterprint",
      () => {
        frame.remove();
        returnFocus?.focus();
      },
      { once: true },
    );
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  };
  frame.srcdoc = html;
  document.body.append(frame);
}
