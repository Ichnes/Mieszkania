import assert from "node:assert/strict";
import test from "node:test";
import { cleanPortalDescription } from "./listing-text";
import { transactionBadges } from "./transaction-badges";

test("transaction badges describe the apartment rather than an optional assignment", () => {
  assert.deepEqual(transactionBadges("", "Grunty pod budynkiem mają status nieuregulowany."), [
    "Nieuregulowany grunt",
  ]);
  assert.deepEqual(
    transactionBadges(
      "",
      "Grunty pod budynkiem są nieuregulowane. Sprzedaż w formie cesji umowy deweloperskiej.",
    ),
    ["Nieuregulowany grunt", "Cesja mieszkania"],
  );
  for (const description of [
    "Grunty uregulowane. Opcja cesji praw za odstępnym do garażu.",
    "Możliwość cesji umowy internetu.",
    "Brak możliwości cesji umowy deweloperskiej.",
  ])
    assert.deepEqual(transactionBadges("", description), []);
});
import { extractFeatures, inferFinishQuality } from "./listing-repository";

test("portal recommendations cannot add features or costs to the saved listing text", () => {
  const main = "Mieszkanie z loggią.";
  assert.equal(
    cleanPortalDescription(
      main +
        " Rozwiń Statystyki ogłoszenia: #toolbar { display: none; } Polecamy: garaż i komórka 925 000 zł",
    ),
    main,
  );
});

test("external and shared amenities are distinguished from apartment amenities", () => {
  const keys = (description: string) => extractFeatures({ description }).map((f) => f.key);
  const nearby = keys(
    "W pobliżu Galeria Złote Tarasy i ogródki działkowe. Taras dostępny dla mieszkańców.",
  );
  assert.ok(!nearby.includes("terrace") && !nearby.includes("garden"));
  assert.ok(keys("Mieszkanie z tarasem. W pobliżu Złote Tarasy.").includes("terrace"));
  assert.ok(keys("Cena zawiera komórkę lokatorską.").includes("storage"));
  assert.equal(
    inferFinishQuality("Wysoki standard budynku. Lokal sprzedawany w stanie deweloperskim."),
    "to_finish",
  );
});
