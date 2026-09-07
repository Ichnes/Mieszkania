import assert from "node:assert/strict";
import test from "node:test";
import { getDescriptionHighlightParts, getSunExposure } from "./listing-language";

test("detects east-west exposure from the actual two-sided apartment description", () => {
  const result = getSunExposure(
    "Mieszkanie dwustronne - od wschodu ulica Mickiewicza i widok na plac Wilsona; od zachodu widok na park.",
  );

  assert.equal(result.isDoubleSided, true);
  assert.deepEqual(new Set(result.directions), new Set(["E", "W"]));
});

test("does not treat a ring-road name as apartment exposure", () => {
  assert.deepEqual(getSunExposure("Szybki dojazd do Obwodnicy Południowej.").directions, []);
  assert.deepEqual(getSunExposure("Blisko Południowej Obwodnicy Warszawy.").directions, []);
});

test("treats compound window layouts as diagonal directions", () => {
  const result = getSunExposure("Ekspozycja północny - wschód i północny - zachód.");

  assert.deepEqual(result.directions, ["NE", "NW"]);
  assert.equal(result.sideCount, 2);
  assert.equal(result.isDoubleSided, true);
});

test("treats an east-south window layout as a south-east exposure", () => {
  const result = getSunExposure("Mieszkanie ze wschodnio-południowym układem okien.");

  assert.deepEqual(result.directions, ["SE"]);
});

test("recognizes the two diagonal sides and highlights their full inflected names", () => {
  const text = "Ekspozycja okien: północny - wschód/ południowy - zachód";
  const exposure = getSunExposure(text);
  const highlighted = getDescriptionHighlightParts(text)
    .filter((part) => part.tone === "neutral")
    .map((part) => part.text);

  assert.deepEqual(exposure.directions, ["NE", "SW"]);
  assert.equal(exposure.sideCount, 2);
  assert.equal(exposure.isDoubleSided, true);
  assert.deepEqual(highlighted, ["północny - wschód", "południowy - zachód"]);
});

test("recognizes windows facing three cardinal directions", () => {
  const result = getSunExposure("Okna wychodzą na północ, wschód i południe.");

  assert.deepEqual(new Set(result.directions), new Set(["N", "E", "S"]));
});

test("recognizes an unspecified three-sided exposure", () => {
  const result = getSunExposure("Mieszkanie ma okna na trzy strony świata.");

  assert.equal(result.sideCount, 3);
  assert.deepEqual(result.directions, []);
});

test("highlights whole bezczynszowe word without turning it into czynszowe", () => {
  const highlighted = getDescriptionHighlightParts("Mieszkanie bezczynszowe z tarasem.").filter(
    (part) => part.tone,
  );

  assert.deepEqual(
    highlighted.map((part) => [part.text, part.tone]),
    [
      ["bezczynszowe", "positive"],
      ["tarasem", "positive"],
    ],
  );
});

test("highlights useful apartment features in their common inflections", () => {
  const text =
    "Do lokalu przynależy piwnica, ogródek, 2 naziemne miejsca postojowe i drewniane podłogi.";
  const positiveText = getDescriptionHighlightParts(text)
    .filter((part) => part.tone === "positive")
    .map((part) => part.text.toLowerCase());
  const premiumText = getDescriptionHighlightParts(text)
    .filter((part) => part.tone === "premium")
    .map((part) => part.text.toLowerCase());

  assert.deepEqual(positiveText, ["piwnica", "ogródek", "2 naziemne miejsca postojowe"]);
  assert.deepEqual(premiumText, ["drewniane podłogi"]);
});

test("highlights the full administrative rent phrase", () => {
  const highlighted = getDescriptionHighlightParts(
    "Czynsz administracyjny: 900 zł miesięcznie.",
  ).filter((part) => part.tone);

  assert.equal(highlighted[0]?.text, "Czynsz administracyjny:");
  assert.equal(highlighted[0]?.tone, "neutral");
});

test("treats western exposure as direction but ignores time of day and sunsets", () => {
  const text =
    "Mieszkanie ma zachodnią ekspozycję, dzięki czemu popołudniami jest pięknie oświetlone, a z balkonu można podziwiać zachody słońca.";
  const result = getSunExposure(text);
  const highlighted = getDescriptionHighlightParts(text)
    .filter((part) => part.tone === "neutral")
    .map((part) => part.text);

  assert.deepEqual(result.directions, ["W"]);
  assert.deepEqual(highlighted, ["zachodnią"]);
});

test("understands colon-separated and window exposure descriptions", () => {
  assert.deepEqual(
    new Set(
      getSunExposure("Ekspozycja: południe (salon, kuchnia) i północ (dwie sypialnie).").directions,
    ),
    new Set(["S", "N"]),
  );
  assert.deepEqual(
    new Set(getSunExposure("Ekspozycja okien-wschód, zachód.").directions),
    new Set(["E", "W"]),
  );
});

test("understands abbreviated south and west window exposure", () => {
  assert.deepEqual(
    new Set(getSunExposure("Wystawa okien płd, przedpokój zach.").directions),
    new Set(["S", "W"]),
  );
});

test("does not turn no-renovation or obligatory parking into negative claims", () => {
  const noRenovation = getDescriptionHighlightParts(
    "Mieszkanie nie wymaga remontu ani odświeżania.",
  ).filter((part) => part.tone);
  const obligatoryParking = getDescriptionHighlightParts(
    "Zakup obligatoryjny - nie ma możliwości zakupu mieszkania bez miejsca postojowego.",
  ).filter((part) => part.tone);

  assert.deepEqual(
    noRenovation.map((part) => part.tone),
    ["positive"],
  );
  assert.deepEqual(
    obligatoryParking.map((part) => part.tone),
    ["neutral"],
  );
});

test("highlights compound floor, count and area expressions in full", () => {
  const highlighted = getDescriptionHighlightParts(
    "Piętro 5/6, lokal na 3 i 4 piętrze, dwa balkony, dwa miejsca postojowe i 8-metrowy taras.",
  )
    .filter((part) => part.tone)
    .map((part) => part.text.toLowerCase());

  assert.deepEqual(highlighted, [
    "piętro 5/6",
    "na 3 i 4 piętrze",
    "dwa balkony",
    "dwa miejsca postojowe",
    "8-metrowy",
    "taras",
  ]);
});

test("highlights premium materials, systems and design phrases", () => {
  const text =
    "Garażu podziemnym, klimatyzowany salon, ogrzewanie podłogowe i wnętrze zaaranżowane przez architekta. Podłogi wykonano z gresu i egzotycznego drewna merbau.";
  const positive = getDescriptionHighlightParts(text)
    .filter((part) => part.tone === "positive")
    .map((part) => part.text.toLowerCase());
  const premium = getDescriptionHighlightParts(text)
    .filter((part) => part.tone === "premium")
    .map((part) => part.text.toLowerCase());

  assert.deepEqual(positive, ["garażu podziemnym"]);
  assert.deepEqual(premium, [
    "klimatyzowany salon",
    "ogrzewanie podłogowe",
    "zaaranżowane przez architekta",
    "egzotycznego drewna merbau",
  ]);
});

test("treats smoked oak on floors as a premium wooden floor", () => {
  const highlighted = getDescriptionHighlightParts(
    "Na podłogach znajduje się dąb wędzony oraz wysokiej jakości gres.",
  ).filter((part) => part.tone);

  assert.deepEqual(
    highlighted.map((part) => [part.text, part.tone]),
    [["podłogach znajduje się dąb wędzony", "premium"]],
  );
});

test("highlights an oak floorboard as a premium material", () => {
  const highlighted = getDescriptionHighlightParts("W salonie położono dębową deskę.").filter(
    (part) => part.tone,
  );

  assert.deepEqual(
    highlighted.map((part) => [part.text, part.tone]),
    [["dębową deskę", "premium"]],
  );
});

test("does not treat blackout blinds and full blackout as a dark-apartment drawback", () => {
  const highlighted = getDescriptionHighlightParts(
    "Duże okno z żaluzją zaciemniającą zapewnia prywatność i możliwość pełnego zaciemnienia.",
  );

  assert.equal(
    highlighted.some((part) => part.tone === "negative"),
    false,
  );
});

test("does not treat darker floor panels as a dark-apartment drawback", () => {
  const highlighted = getDescriptionHighlightParts(
    "W części dziennej jasne panele, w sypialniach ciemniejsze panele.",
  );

  assert.equal(
    highlighted.some((part) => part.tone === "negative"),
    false,
  );
});

test("still treats a dark apartment or room as a drawback", () => {
  const highlighted = getDescriptionHighlightParts(
    "Mieszkanie jest ciemne, a pokój ciemniejszy niż na zdjęciach.",
  );

  assert.equal(highlighted.filter((part) => part.tone === "negative").length, 2);
});

test("highlights a direct offer from the owner", () => {
  const highlighted = getDescriptionHighlightParts("Bezpośrednio od właściciela.").filter(
    (part) => part.tone,
  );

  assert.deepEqual(
    highlighted.map((part) => [part.text, part.tone]),
    [["Bezpośrednio od właściciela", "positive"]],
  );
});

test("highlights developer standard descriptions as negative", () => {
  const variants = [
    "Nieruchomość w stanie deweloperskim.",
    "Nieruchomość jest oddana w stanie deweloperskim.",
  ];

  for (const variant of variants) {
    const highlighted = getDescriptionHighlightParts(variant).filter((part) => part.tone);
    assert.equal(highlighted.length, 1);
    assert.equal(highlighted[0]?.tone, "negative");
    assert.match(highlighted[0]?.text ?? "", /stanie deweloperskim/i);
  }
});

test("noise field names, moderately quiet ratings and speakers are not loudness drawbacks", () => {
  for (const text of [
    "Głośność: umiarkowanie ciche",
    "Głośność: ciche",
    "Wbudowane głośniki.",
    "Mieszkanie nie jest głośne.",
  ]) {
    assert.equal(
      getDescriptionHighlightParts(text).some((p) => p.tone === "negative"),
      false,
      text,
    );
  }
  assert.ok(
    getDescriptionHighlightParts("Mieszkanie jest głośne.").some((p) => p.tone === "negative"),
  );
});
