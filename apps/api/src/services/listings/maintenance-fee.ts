import { cleanPortalDescription, decodeListingText } from "./listing-text";

export function readMonthlyFee(structured: string | undefined, description: string): number | null {
  // Only an unambiguous single amount: do not turn ranges, yearly or per-m² fees into monthly totals.
  const amount = "(\\d+(?:[ .\\u00a0]\\d{3})*(?:[,.]\\d{1,2})?)";
  const structuredMatch = structured
    ?.trim()
    .match(
      new RegExp(
        `^(?:ok\\.?\\s*)?${amount}\\s*(?:(?:zł|PLN)(?:\\s*[/ ]\\s*(?:mies(?:iąc|ięcznie|\\.)?|msc))?)?$`,
        "i",
      ),
    );
  if (/^(?:bezczynszow[ey]|bez czynszu)$/i.test(structured?.trim() ?? "")) return 0;
  const text = cleanPortalDescription(decodeListingText(description));
  const match =
    (structured?.trim() === "0" ? null : structuredMatch) ??
    text.match(
      new RegExp(
        `(?:czynsz(?:u)?(?!ow)|opłaty\\s+czynszowe)\\s*(?:(?:administracyjn(?:y|ego|ym)|adm\\.|spółdzielczy|miesięczny|nieruchomości|wynosi|to|oko[łl]o|ok\\.?|(?:w )?wysokości|na poziomie|obecnie|aktualnie|niecałe|zaledwie|jedynie|do wspólnoty(?: mieszkaniowej)?|do spółdzielni|do zarządcy nieruchomości|z funduszem remontowym|(?:wraz )?z zaliczkami(?: na media i funduszem remontowym)?|za mieszkanie(?: i miejsce postojowe)?|(?:łącznie|wraz) z miejscem postojowym|(?:przy|na|dla) \\d+ osob(?:ie|ach|y|ę|ób)|[):=,–—*\\-])\\s*)*${amount}\\s*(?:zł|PLN|(?=miesięcznie\\b|za \\d+ osob))(?!\\s*(?:/\\s*(?:m[²2]|rok)|rocznie|(?:[–—-]|do)\\s*\\d))`,
        "i",
      ),
    );
  if (!match) return null;
  const value = Number(
    match[1]
      .replace(/[ \u00a0]/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(value) && value >= 0 ? value : null;
}
