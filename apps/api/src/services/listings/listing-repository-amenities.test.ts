import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAmenityBadges,
  extractFeatures,
  inferBuildingDetails,
  inferCommercialInfo,
  resolveListingAmenities,
} from "./listing-repository";

test("shared amenity resolution distinguishes unknown, absence and manual corrections", () => {
  assert.deepEqual(resolveListingAmenities([]), { lift: undefined, garage: undefined });
  const description = "Budynek bez windy. Mieszkanie bez garażu.";
  const features = extractFeatures({ description });
  assert.deepEqual(resolveListingAmenities(features, {}, description), {
    lift: false,
    garage: false,
  });
  assert.deepEqual(resolveListingAmenities(features, { lift: true, garage: true }, description), {
    lift: true,
    garage: true,
  });
  const positive = extractFeatures({ description: "Winda i garaż podziemny." });
  assert.deepEqual(resolveListingAmenities(positive, { lift: false, garage: false }), {
    lift: false,
    garage: false,
  });
});

test("outdoor parking does not satisfy the garage filter", () => {
  const description = "Miejsce postojowe na terenie osiedla.";
  assert.notEqual(
    resolveListingAmenities(extractFeatures({ description }), {}, description).garage,
    true,
  );
});

test("structured amenities take precedence over negative description text", () => {
  const description = "Budynek bez windy, bez garażu.";
  assert.deepEqual(
    resolveListingAmenities(
      [
        { key: "lift", label: "Winda", value: "tak", source: "payload" },
        { key: "garage", label: "Garaż", value: "tak", source: "payload" },
      ],
      {},
      description,
    ),
    { lift: true, garage: true },
  );
});

test("extracts description amenities but exposes only parking as an image badge", () => {
  const features = extractFeatures({
    description:
      "Do mieszkania należą 2 naziemne miejsca postojowe przed budynkiem, piwnica, taras, ogródek i drewniane podłogi.",
  });
  const keys = new Set(features.map((feature) => feature.key));
  const badges = buildAmenityBadges(features);

  assert.equal(keys.has("outdoor_parking"), true);
  assert.equal(keys.has("storage"), true);
  assert.equal(keys.has("terrace"), true);
  assert.equal(keys.has("garden"), true);
  assert.equal(keys.has("wooden_floor"), true);
  assert.equal(badges.includes("2 naziemne miejsca postojowe"), true);
  assert.equal(badges.includes("Piwnica"), false);
  assert.equal(badges.includes("Taras"), false);
  assert.equal(badges.includes("Ogródek"), false);
  assert.equal(badges.includes("Drewniane podłogi"), false);
});

test("keeps parking on the estate separate from an underground garage", () => {
  const features = extractFeatures({ description: "Miejsce postojowe na terenie osiedla." });
  const badges = buildAmenityBadges(features);

  assert.equal(
    features.some((feature) => feature.key === "garage"),
    false,
  );
  assert.equal(
    features.some((feature) => feature.key === "estate_parking"),
    true,
  );
  assert.equal(badges.includes("Miejsce postojowe na terenie osiedla"), true);
});

test("does not negate parking when its purchase is obligatory", () => {
  const features = extractFeatures({
    description:
      "Zakup obligatoryjny - nie ma możliwości zakupu mieszkania bez miejsca postojowego.",
  });

  assert.equal(
    features.some((feature) => feature.key === "outdoor_parking" || feature.key === "garage"),
    true,
  );
});

test("recognizes a parking platform and gives it a dedicated badge", () => {
  const features = extractFeatures({
    description: "Miejsce parkingowe znajduje się na platformie.",
  });

  assert.equal(
    features.some((feature) => feature.key === "garage" && feature.value === "platform"),
    true,
  );
  assert.equal(buildAmenityBadges(features).includes("Miejsce na platformie"), true);
});

test("keeps amenity counts and recognizes plain storage wording", () => {
  const features = extractFeatures({
    description: "Dwa balkony, dwa naziemne miejsca postojowe, miejsce garażowe i komórka.",
  });
  const badges = buildAmenityBadges(features);

  assert.equal(badges.includes("2 balkony"), false);
  assert.equal(badges.includes("2 naziemne miejsca postojowe"), true);
  assert.equal(badges.includes("Komórka lokatorska"), false);
});

test("extracts premium finish and equipment variants", () => {
  const features = extractFeatures({
    description:
      "Klimatyzowany salon, ogrzewanie podłogowe i wnętrze zaaranżowane przez architekta. Podłogi wykonano z gresu i egzotycznego drewna merbau.",
  });
  const keys = new Set(features.map((feature) => feature.key));

  assert.equal(keys.has("air_conditioning"), true);
  assert.equal(keys.has("underfloor_heating"), true);
  assert.equal(keys.has("architect_designed"), true);
  assert.equal(keys.has("wooden_floor"), true);
  assert.deepEqual(buildAmenityBadges(features), ["Brak miejsca postojowego"]);
});

test("recognizes smoked oak mentioned on floors as a wooden floor", () => {
  const features = extractFeatures({
    description: "Na podłogach znajduje się dąb wędzony oraz wysokiej jakości gres.",
  });

  assert.equal(
    features.some((feature) => feature.key === "wooden_floor"),
    true,
  );
});

test("recognizes an oak floorboard as a wooden floor", () => {
  const features = extractFeatures({ description: "W salonie położono dębową deskę." });

  assert.equal(
    features.some((feature) => feature.key === "wooden_floor"),
    true,
  );
});

test("infers floor, total floors and construction year from natural descriptions", () => {
  assert.deepEqual(
    inferBuildingDetails(
      "Mieszkanie na pierwszym piętrze w trzypiętrowym bloku. Rok budowy: 2007.",
    ),
    {
      floor: 1,
      totalFloors: 3,
      yearBuilt: 2007,
    },
  );
  assert.deepEqual(
    inferBuildingDetails("Nieruchomość położona na trzecim piętrze budynku z 2025 roku."),
    {
      floor: 3,
      totalFloors: undefined,
      yearBuilt: 2025,
    },
  );
  assert.deepEqual(inferBuildingDetails("Piętro 1/5, budynek z 2021 roku."), {
    floor: 1,
    totalFloors: 5,
    yearBuilt: 2021,
  });
  assert.equal(inferBuildingDetails("Budynek z 1996 roku.").yearBuilt, 1996);
});

test("counts private parking spaces separately from guest parking and recognizes a barrier lot", () => {
  const description =
    "Dużym atutem są dwa parkingi dla gości objęte ochroną: zadaszony oraz zewnętrzny. Do mieszkania przynależą dwa prywatne miejsca postojowe dla samochodów oraz miejsce na motocykl.";
  const features = extractFeatures({ description });
  const badges = buildAmenityBadges(features);

  assert.equal(
    features.some((feature) => feature.key === "owned_parking" && feature.value === "2"),
    true,
  );
  assert.equal(
    features.some((feature) => feature.key === "outdoor_parking"),
    true,
  );
  assert.equal(badges.includes("2 prywatne miejsca postojowe"), true);
  assert.equal(badges.includes("2 naziemne miejsca postojowe"), true);
  assert.equal(
    extractFeatures({ description: "Parking za szlabanem." }).some(
      (feature) => feature.key === "outdoor_parking",
    ),
    true,
  );
});

test("shows a lift image badge only when the listing explicitly has no lift", () => {
  const withLift = extractFeatures({ description: "W budynku znajduje się winda." });
  const withoutLift = extractFeatures({ description: "Czwarte piętro bez windy." });

  assert.equal(buildAmenityBadges(withLift).includes("Winda"), false);
  assert.equal(buildAmenityBadges(withoutLift).includes("Brak windy"), true);
});

test("treats the structured portal lift value as authoritative", () => {
  const withoutLift = extractFeatures({
    description: "W sąsiednim budynku znajduje się winda.",
    snapshotPayload: { portalFeatures: { lift: "nie" } },
  });
  const withLift = extractFeatures({
    description: "Stary opis wspomina lokal bez windy.",
    snapshotPayload: { portalFeatures: { lift: "tak" } },
  });

  assert.equal(
    withoutLift.some((feature) => feature.key === "no_lift"),
    true,
  );
  assert.equal(
    withoutLift.some((feature) => feature.key === "lift"),
    false,
  );
  assert.equal(
    withLift.some((feature) => feature.key === "lift"),
    true,
  );
  assert.equal(
    withLift.some((feature) => feature.key === "no_lift"),
    false,
  );
});

test("reads the Otodom lift value from an existing JSON-LD snapshot", () => {
  const features = extractFeatures({
    description: "",
    snapshotPayload: {
      jsonLd: {
        "@graph": [
          {
            "@type": "Product",
            additionalProperty: [{ "@type": "PropertyValue", name: "Winda", value: "nie" }],
          },
        ],
      },
    },
  });

  assert.equal(
    features.some((feature) => feature.key === "no_lift"),
    true,
  );
  assert.equal(
    features.some((feature) => feature.key === "lift"),
    false,
  );
});

test("labels an offer directly from its owner as direct", () => {
  const result = inferCommercialInfo("Bezpośrednio od właściciela.");

  assert.deepEqual(result.badges, ["Oferta bezpośrednia"]);
});

test("labels a broker offer as commission-free when the buyer pays no commission", () => {
  const result = inferCommercialInfo("Oferta biura nieruchomości. Zakup bez prowizji.");

  assert.deepEqual(result.badges, ["Bez prowizji", "Oferta pośrednika"]);
});

test("recognizes no brokerage and no commission statements", () => {
  const result = inferCommercialInfo(
    "Nie jesteśmy zainteresowani pośrednictwem oraz nie pobieramy prowizji.",
  );
  assert.deepEqual(result.badges, ["Bez prowizji", "Oferta bezpośrednia"]);
});

test("adds a dashboard badge for developer standard variants", () => {
  for (const description of [
    "Nieruchomość w stanie deweloperskim.",
    "Nieruchomość jest oddana w stanie deweloperskim.",
    "Bezpośrednio od dewelopera.",
    "Stan lokalu: do wykończenia / surowy dewelop.",
    "Lokal jest gotowy do wykończenia.",
  ]) {
    const features = extractFeatures({ description });

    assert.equal(
      features.some((feature) => feature.key === "developer_standard"),
      true,
    );
    assert.equal(buildAmenityBadges(features).includes("Stan deweloperski"), true);
  }
});

test("does not confuse a past developer stage with the current finish", () => {
  const features = extractFeatures({
    description:
      "STAN TECHNICZNY Mieszkanie zostało doprowadzone do stanu deweloperskiego i kompleksowo wyremontowane: wymienione okna, nowe wylewki, nowa instalacja elektryczna i dębowy parkiet. Obecnie wymaga jedynie kosmetycznego odświeżenia — można zamieszkać od razu.",
  });

  assert.equal(
    features.some((feature) => feature.key === "developer_standard"),
    false,
  );
  assert.equal(buildAmenityBadges(features).includes("Stan deweloperski"), false);
});

test("treats an air-conditioning installation option as no existing air conditioning", () => {
  const features = extractFeatures({
    description: "Dodatkowo istnieje opcja montażu klimatyzacji.",
  });

  assert.equal(
    features.some((feature) => feature.key === "air_conditioning"),
    false,
  );
});

test("recognizes an optional underground parking space as a garage", () => {
  const features = extractFeatures({ description: "Opcjonalnie miejsce w parkingu podziemnym." });

  assert.equal(
    features.some((feature) => feature.key === "garage"),
    true,
  );
  assert.equal(buildAmenityBadges(features).includes("Garaż"), true);
});

test("recognizes broker boilerplate from agency software and Hamilton May", () => {
  for (const description of [
    "Oferta biura nieruchomości.",
    "Oferta wysłana z programu dla biur nieruchomości.",
    "Zapraszamy do kontaktu z Hamilton May w celu umówienia prezentacji tej nieruchomości.",
  ]) {
    assert.equal(inferCommercialInfo(description).badges.includes("Oferta pośrednika"), true);
  }
});

test("recognizes ground-floor inflections without confusing building facilities", () => {
  for (const description of [
    "Usytuowane na parterze, w trzypiętrowym budynku.",
    "Mieszkanie na wysokim parterze.",
    "Piętro: parter",
    "Lokal parterowy.",
  ]) {
    assert.equal(inferBuildingDetails(description).floor, 0, description);
  }
  assert.equal(
    inferBuildingDetails("Usytuowane na parterze, w trzypiętrowym budynku.").totalFloors,
    3,
  );
  for (const description of [
    "Sklepy na parterze budynku.",
    "Na parterze znajduje się sklep.",
    "Mieszkanie nie znajduje się na parterze.",
  ]) {
    assert.equal(inferBuildingDetails(description).floor, undefined, description);
  }
  assert.equal(
    inferBuildingDetails("Mieszkanie na drugim piętrze. Na parterze recepcja.").floor,
    2,
  );
});

test("shows missing parking and does not turn private outdoor spaces into a garage", () => {
  assert.ok(
    buildAmenityBadges(extractFeatures({ description: "Jasne mieszkanie z balkonem." })).includes(
      "Brak miejsca postojowego",
    ),
  );
  const features = extractFeatures({
    description: "Do mieszkania przynależą dwa prywatne miejsca postojowe.",
  });
  assert.equal(
    features.some((feature) => feature.key === "garage"),
    false,
  );
  assert.equal(buildAmenityBadges(features).includes("Brak miejsca postojowego"), false);
});

test("parking under the block counts, guest-only parking and negations do not", () => {
  for (const description of [
    "Parking pod blokiem.",
    "Parking przed budynkiem.",
    "Parking naziemny.",
  ]) {
    assert.ok(
      buildAmenityBadges(extractFeatures({ description })).includes("Naziemne miejsce postojowe"),
      description,
    );
  }
  for (const description of [
    "Parking dla gości.",
    "Parking pod blokiem dla gości.",
    "Brak parkingu pod blokiem.",
    "Miejsce postojowe dla gości.",
  ]) {
    assert.ok(
      buildAmenityBadges(extractFeatures({ description })).includes("Brak miejsca postojowego"),
      description,
    );
  }
});
