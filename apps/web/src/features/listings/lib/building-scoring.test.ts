import assert from "node:assert/strict";
import test from "node:test";
import {
  computeDreamEvaluation,
  createDefaultFamilySettings,
  getBuildingYearPoints,
  getFloorPoints,
  getExposureEvaluation,
  type ListingSummary,
} from "@mieszkania/shared";
const settings = createDefaultFamilySettings();
const evaluate = (description: string) =>
  computeDreamEvaluation(
    {
      id: "building-test",
      city: "Warszawa",
      rcnDeltaLabel: "",
      summary: "",
      imageCount: 0,
      imageUrls: [],
      isShortlisted: false,
      title: "Mieszkanie",
      description,
      district: "",
      badges: [],
      areaLabel: "80",
      priceLabel: "1000000",
      priceChangePercent: 0,
    } satisfies ListingSummary,
    settings.dreamProfile,
    [],
  );

test("year and floor point thresholds include exact upper bounds", () => {
  for (const [year, points] of [
    [1970, -4],
    [1980, -4],
    [1981, -2],
    [1990, -2],
    [1991, 0],
    [2000, 0],
    [2001, 4],
    [2005, 4],
    [2006, 6],
    [2010, 6],
    [2011, 8],
    [2015, 8],
    [2016, 10],
    [2020, 10],
    [2021, 12],
    [2024, 12],
    [2025, 14],
    [2026, 14],
    [2027, 12],
  ])
    assert.equal(getBuildingYearPoints(year, 2026), points, String(year));
  for (const [floor, points] of [
    [-1, -4],
    [0, -4],
    [1, 1],
    [2, -2],
    [3, 3],
    [4, 4],
    [5, 5],
    [6, 7],
    [7, 8],
    [8, 9],
    [12, 9],
    [13, 12],
    [20, 12],
  ])
    assert.equal(getFloorPoints(floor), points, String(floor));
  assert.equal(getBuildingYearPoints(undefined, 2026), -3);
  assert.equal(getFloorPoints(undefined), 0);
  assert.equal(
    evaluate("Na parterze lokale usługowe.").rows.find((row) => row.label === "Piętro")!.points,
    0,
  );
  assert.equal(
    evaluate("Mieszkanie na parterze.").rows.find((row) => row.label === "Piętro")!.points,
    -4,
  );
  assert.equal(
    evaluate("").rows.some((row) => row.label === "Najwyższe piętro — premia"),
    false,
  );
});

test("exposure scores sides and combinations without treating one diagonal as two sides", () => {
  for (const [description, points] of [
    ["Brak informacji o oknach", 0],
    ["Mieszkanie jednostronne", -5],
    ["Jednostronne, okna na południe", 2],
    ["Jednostronne, okna na zachód", 4],
    ["Jednostronne, okna na północ", -15],
    ["Jednostronne, okna na wschód", 2],
    ["Mieszkanie dwustronne", 10],
    ["Dwustronne, okna na południe i zachód", 20],
    ["Dwustronne, okna na południe i wschód", 17],
    ["Dwustronne, okna na południe i północ", 14],
    ["Dwustronne, okna na północ i zachód", 12],
    ["Dwustronne, okna na północ i wschód", 11],
    ["Dwustronne, okna na wschód i zachód", 18],
    ["Trójstronne mieszkanie", 13],
    ["Trójstronne, okna na południe, wschód i zachód", 18],
    ["Trójstronne, okna na południe, zachód i północ", 17],
    ["Trójstronne, okna na południe, wschód i północ", 16],
    ["Trójstronne, okna na północ, zachód i wschód", 14],
    ["Ekspozycja południowo-zachodnia", -5],
    ["Dwustronne, ekspozycja południowy zachód", 20],
    ["Okna: S i W", 20],
    ["Blisko Pragi-Północ i południowej obwodnicy Warszawy.", 0],
  ] as const)
    assert.equal(getExposureEvaluation(description).points, points, description);
});

test("premium vocabulary covers inflections, reversed word order and negations", () => {
  for (const description of [
    "Blat ze spieku",
    "Blaty wykonane ze spieków kwarcowych",
    "Kuchnia z blatami ze spiekami kwarcowymi",
    "Kamienne blaty",
    "Blat z kamienia",
    "Granitowymi blatami wykończono kuchnię",
    "Blaty konglomeratowe",
  ])
    assert.equal(
      evaluate(description).rows.find((row) => row.label === "Blat")!.points,
      /granit/i.test(description) ? 8 : /spiek|konglomerat/i.test(description) ? 7 : 0,
      description,
    );
  for (const description of [
    "Ogrzewanie podłogowe",
    "Z ogrzewaniem podłogowym",
    "Podłogówka",
    "Podłogowe ogrzewanie",
  ])
    assert.equal(
      evaluate(description).rows.find((row) => row.label === "Ogrzewanie podłogowe")!.points,
      4,
      description,
    );
  for (const [description, label] of [
    ["Z dwiema łazienkami", "Dwie łazienki"],
    ["Dobrze doświetlone mieszkanie", "Jasne mieszkanie"],
    ["Osiedle ogrodzone", "Zamknięte osiedle"],
    ["Wysokim standardem wykończenia", "Wysoki standard"],
    ["Domowe biuro", "Gabinet"],
  ])
    assert.ok(
      evaluate(description).rows.find((row) => row.label === label)!.points > 0,
      description,
    );
  assert.equal(
    evaluate("Bez ogrzewania podłogowego").rows.find((row) => row.label === "Ogrzewanie podłogowe")!
      .points,
    0,
  );
});
