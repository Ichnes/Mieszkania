import type { ExposureDirection } from "@mieszkania/shared";
export { getSunExposure, type ExposureDirection } from "@mieszkania/shared";

export type DescriptionHighlightPart = {
  text: string;
  tone?: "positive" | "premium" | "negative" | "neutral";
};

export function normalizeListingText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .toLowerCase();
}

export function getDescriptionHighlightParts(value: string): DescriptionHighlightPart[] {
  const suffix = "[a-ząćęłńóśźżą-]*";
  const count = "(?:\\d+|jeden|jedno|jedna|dwa|dwie|trzy|cztery|pięć)";
  const contextualPositive = [
    `bezpośrednio\\s+od\\s+właściciel${suffix}`,
    `nie\\s+(?:wymaga|potrzebuje)\\s+(?:remont${suffix}|odśwież${suffix})(?:\\s+ani\\s+(?:remont${suffix}|odśwież${suffix}))?`,
    `(?:garaż${suffix}\\s+podziemn${suffix}|podziemn${suffix}\\s+garaż${suffix})`,
    `(?:miejsc${suffix}\\s+(?:parkingow${suffix}|postojow${suffix})[^.!?;]{0,35}?platform${suffix})`,
  ].join("|");
  const contextualPremium = [
    `(?:ogrzewan${suffix}\\s+podłogow${suffix}|podłogow${suffix}\\s+ogrzewan${suffix})`,
    `(?:(?:zaaranżowan${suffix}|zaprojektowan${suffix}|urządzon${suffix})\\s+przez\\s+(?:renomowan${suffix}\\s+)?architekt${suffix})`,
    `(?:klimatyzowan${suffix}\\s+(?:salon${suffix}|pokój${suffix}|pokoj${suffix}|sypialni${suffix}|pomieszczeni${suffix}))`,
    `(?:klimatyzacj${suffix}|klimatyzowan${suffix})`,
    `(?:drewnian${suffix}\\s+(?:podłog${suffix}|parkiet${suffix})|podłog${suffix}\\s+z\\s+(?:naturaln${suffix}\\s+)?drewn${suffix}|parkiet${suffix}|desk${suffix}\\s+podłogow${suffix})`,
    `(?:egzotyczn${suffix}\\s+drewn${suffix}(?:\\s+merbau${suffix})?|drewn${suffix}\\s+merbau${suffix})`,
    `(?:podłog${suffix}[^.!?;]{0,70}?dąb${suffix}\\s+wędzon${suffix}|dąb${suffix}\\s+wędzon${suffix}(?=[^.!?;]{0,70}?podłog${suffix}))`,
    `(?:dębow${suffix}\\s+desk${suffix})`,
  ].join("|");
  const contextualNeutral = [
    `głośność\\s*:\\s*(?:umiarkowanie\\s+)?cich${suffix}`,
    `(?<![\\p{L}])nie\\s+(?:(?:jest|są|bywa)\\s+)?głośn(?:y|a|e|o|ym|ych|ego|ej|ymi|ą)(?![\\p{L}])`,
    `zakup\\s+obligatoryjn${suffix}\\s*[-–—,:]?\\s*nie\\s+ma\\s+możliwoś${suffix}\\s+zakupu[^.!?;]{0,80}?bez\\s+(?:miejsc${suffix}\\s+(?:postojow${suffix}|parkingow${suffix}|garażow${suffix}))`,
    `(?:obowiązkow${suffix}|obligatoryjn${suffix})\\s+zakup[^.!?;]{0,80}?(?:miejsc${suffix}\\s+(?:postojow${suffix}|parkingow${suffix}|garażow${suffix}))`,
  ].join("|");
  const negative = [
    `(?:nieruchomoś${suffix}|mieszkan${suffix}|lokal${suffix}|apartament${suffix})?\\s*(?:(?:jest\\s+)?(?:oddan${suffix}|oferowan${suffix}|sprzedawan${suffix})\\s+)?(?:w\\s+)?stanie\\s+dewelopersk${suffix}`,
    `stan\\s+dewelopersk${suffix}`,
    `(?<![\\p{L}\\p{N}_])(?:nie\\s+ma|nie\\s+posiada|brak|bez)\\s+(?:wind${suffix}|garaż${suffix}|balkon${suffix}|taras${suffix}|ogr(?:ó|o)d(?:ek|ka|kiem|ku|ki|ków|kach)|parking${suffix}|komórk${suffix}|piwnic${suffix}|ogrzewani${suffix})`,
    `(?<![\\p{L}\\p{N}_])(?:nie\\s+ma|brak|bez)\\s+(?:własnego\\s+)?miejsc${suffix}\\s+(?:postojow${suffix}|parkingow${suffix})`,
    `(?:wymaga|do|przed)\\s+(?:(?:generaln${suffix}|kapitaln${suffix})\\s+)?remont${suffix}`,
    `stan\\s+do\\s+remont${suffix}`,
    `(?:do\\s+odświeżenia|do\\s+wymiany|okn${suffix}\\s+do\\s+wymiany|instalacj${suffix}\\s+do\\s+wymiany|dach${suffix}\\s+do\\s+wymiany)`,
    `brak\\s+księg${suffix}\\s+wieczyst${suffix}`,
    `(?:wysok${suffix}|ostatni${suffix})\\s+piętr${suffix}\\s+(?:bez|i\\s+nie\\s+ma)\\s+wind${suffix}`,
    `(?:ruchliw${suffix}\\s+ulic${suffix}|głośn(?:y|a|e|o|ym|ych|ego|ej|ymi|ą)(?![\\p{L}])|(?:(?:nieruchomoś${suffix}|mieszkan${suffix}|lokal${suffix}|apartament${suffix}|pokój${suffix}|pokoj${suffix}|wnętrz${suffix}|pomieszczeni${suffix})\\s+(?:jest\\s+|są\\s+)?ciemn${suffix}|ciemn${suffix}\\s+(?:nieruchomoś${suffix}|mieszkan${suffix}|lokal${suffix}|apartament${suffix}|pokój${suffix}|pokoj${suffix}|wnętrz${suffix}|pomieszczeni${suffix}))|zadłużon${suffix}|zawilgocon${suffix}|wilgoć|grzyb${suffix}|suterena|niski\\s+parter)`,
  ].join("|");
  const positive = [
    `\\bbezczynsz${suffix}`,
    `po\\s+(?:(?:generaln${suffix}|kapitaln${suffix})\\s+)?remoncie`,
    `(?:świeżo\\s+)?wyremontowan${suffix}`,
    `gotow${suffix}\\s+do\\s+wprowadzenia`,
    `stan\\s+(?:bardzo\\s+)?dobr${suffix}`,
    `(?:now${suffix}\\s+okn${suffix}|now${suffix}\\s+instalacj${suffix})`,
    `(?:${count}\\s+balkon${suffix})`,
    `(?:${count}\\s+(?:naziemn${suffix}\\s+)?miejsc${suffix}\\s+(?:postojow${suffix}|parkingow${suffix}|garażow${suffix}))`,
    `(?:balkon${suffix}|loggi${suffix}|taras${suffix}|ogr(?:ó|o)d(?:ek|ka|kiem|ku|ki|ków|kach)|piwnic${suffix}|garaż${suffix}|parking${suffix}|wind${suffix}|komórk${suffix}(?:\\s+lokatorsk${suffix})?|(?:naziemn${suffix}\\s+)?miejsc${suffix}\\s+(?:postojow${suffix}|parkingow${suffix}|garażow${suffix}))`,
  ].join("|");
  const neutral = [
    `czynsz${suffix}\\s+administracyjn${suffix}\\s*:?`,
    `(?:na\\s+)?\\d+\\.?\\s+(?:i|oraz|,)\\s+\\d+\\.?\\s*piętr${suffix}`,
    `piętr${suffix}\\s*:?\\s*\\d+\\s*[/z]\\s*\\d+`,
    `\\d+\\s*[-–]?\\s*piętrow${suffix}`,
    `(?:na\\s+)?\\d+\\.?\\s*piętr(?:ze|o|a|ach)(?![\\p{L}]|\\s*[:=]|\\s+\\d)`,
    `\\d+(?:[.,]\\d+)?\\s*[-–]?\\s*metrow${suffix}`,
    `(?:dwustronn${suffix}|(?:północn${suffix}|południow${suffix})\\s*[-–—]?\\s*(?:wsch(?:ó|o)d${suffix}|zach(?:ó|o)d${suffix}))`,
    `(?:(?:zachodni|wschodni|północn|południow)${suffix}(?=\\s+ekspozycj${suffix}))`,
    `(?:od\\s+(?:wschod${suffix}|zachod${suffix}|północ${suffix}|południ${suffix}))`,
    `(?:wschód|zachód|południe|północ)(?![a-ząćęłńóśźżą-])`,
    `\\bczynsz${suffix}`,
    `\\d[\\d\\s.,]*(?:zł|pln|m²|m2|mkw)`,
  ].join("|");
  const importantPattern = new RegExp(
    `(${contextualPremium}|${contextualPositive}|${contextualNeutral}|${negative}|${positive}|${neutral})`,
    "giu",
  );
  const negativePattern = new RegExp(`^(?:${negative})$`, "iu");
  const premiumPattern = new RegExp(`^(?:${contextualPremium})$`, "iu");
  const positivePattern = new RegExp(`^(?:${contextualPositive}|${positive})$`, "iu");
  const neutralPattern = new RegExp(`^(?:${contextualNeutral}|${neutral})$`, "iu");
  const hasExposureContext =
    /\b(?:ekspozycj\w*|orientacj\w*|okn\w*|dwustron\w*|od\s+(?:wschod|zachod|polnoc|poludni))\b/.test(
      normalizeListingText(value),
    );
  const standaloneDirectionPattern = /^(?:wschód|zachód|południe|północ)$/iu;
  const directionalAdjectivePattern =
    /^(?:zachodni|wschodni|północn|południow)[a-ząćęłńóśźżą-]*$/iu;

  return value
    .split(importantPattern)
    .filter(Boolean)
    .map((text) => ({
      text,
      tone: negativePattern.test(text)
        ? "negative"
        : premiumPattern.test(text)
          ? "premium"
          : positivePattern.test(text)
            ? "positive"
            : (neutralPattern.test(text) ||
                  (directionalAdjectivePattern.test(text) && hasExposureContext)) &&
                (!standaloneDirectionPattern.test(text) || hasExposureContext)
              ? "neutral"
              : undefined,
    }));
}
