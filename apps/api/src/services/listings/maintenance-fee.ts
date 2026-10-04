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
  const match =
    structuredMatch ??
    description.match(
      new RegExp(
        `(?:czynsz(?:u)?(?!ow)|opłaty\\s+czynszowe)\\s*(?:(?:administracyjny|administracyjnego|miesięczny|nieruchomości|wynosi|to|około|ok\\.?|w wysokości|obecnie|aktualnie|niecałe|zaledwie|jedynie|do wspólnoty(?: mieszkaniowej)?|do spółdzielni|z funduszem remontowym|z zaliczkami|za mieszkanie|łącznie z miejscem postojowym|przy \\d+ osob(?:ie|ach)|[:–—*\\-])\\s*)*${amount}\\s*(?:zł|PLN)(?!\\s*(?:/\\s*(?:m[²2]|rok)|rocznie))`,
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
