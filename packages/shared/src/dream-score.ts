import {
  getBuildingYearPoints,
  getFloorPoints,
  getExposureEvaluation,
  hasApartmentGroundFloor,
} from "./dream-building.js";
import type { FamilySettings, ListingSummary } from "./index.js";
import { defaultDownPayment, findNearestWarsawMetroStation } from "./index.js";
import {
  getDreamDescriptionFacts,
  getUnfinishedPricePoints,
  hasPositiveDescriptionFact,
} from "./dream-description.js";

export function computeDreamScore(
  listing: ListingSummary,
  profile: FamilySettings["dreamProfile"],
  workplaces: FamilySettings["workplaces"],
  now = new Date(),
  financing?: FamilySettings["financing"],
) {
  return computeDreamEvaluation(listing, profile, workplaces, now, financing).score;
}

export function getPriceDropPoints(changePercent: number) {
  const drop = -changePercent;
  if (!Number.isFinite(drop) || drop <= 0) return 0;
  if (drop <= 1) return 2;
  if (drop <= 2) return 4;
  if (drop <= 3) return 5;
  if (drop <= 4) return 6;
  return 7;
}

export function getListingAgePoints(firstSeen: string | null | undefined, now = new Date()) {
  if (!firstSeen) return 0;
  const days = (now.getTime() - Date.parse(firstSeen)) / 86_400_000;
  if (!Number.isFinite(days) || days < 0) return 0;
  if (days > 40) return -2;
  if (days > 20) return -1;
  return 2;
}

function normalizePolish(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l");
}

export function computeDreamEvaluation(
  listing: ListingSummary,
  profile: FamilySettings["dreamProfile"],
  workplaces: FamilySettings["workplaces"],
  now = new Date(),
  financing?: FamilySettings["financing"],
) {
  const districtNeedle = normalizeLocationComparable(
    `${listing.district} ${listing.neighborhood ?? ""}`,
  );
  const preferredDistricts = profile.preferredDistricts
    .map((value) => normalizeLocationComparable(value))
    .filter(Boolean);
  const area = parseNumericLabel(listing.areaLabel);
  const price = parseNumericLabel(listing.priceLabel);
  const pricePerSqm = parseNumericLabel(listing.pricePerSqmLabel);
  const rooms = listing.roomsCount;
  let points = 0;
  let maxPoints = 0;
  const rows: Array<{
    label: string;
    points: number;
    maxPoints: number;
    rule: string;
    detail: string;
  }> = [];
  let previousPoints = 0;
  let previousMax = 0;
  const record = (label: string, rule: string, detail = "") => {
    rows.push({
      label,
      rule,
      detail,
      points: points - previousPoints,
      maxPoints: maxPoints - previousMax,
    });
    previousPoints = points;
    previousMax = maxPoints;
  };
  const text = normalizePolish(`${listing.title}. ${listing.description ?? ""}`).toLowerCase();
  const descriptionFacts = getDreamDescriptionFacts(text);
  const garageKnown =
    typeof listing.amenityEvidence?.garage === "boolean" || listing.hasGarage === true;
  const liftKnown = typeof listing.amenityEvidence?.lift === "boolean" || listing.hasLift === true;
  const storageKnown =
    typeof listing.amenityEvidence?.storage === "boolean" || listing.hasStorage === true;
  const mentions = (...phrases: string[]) =>
    phrases.some((phrase) => text.includes(normalizePolish(phrase).toLowerCase()));

  if (preferredDistricts.length > 0) {
    maxPoints += 20;
    if (
      districtNeedle &&
      preferredDistricts.some(
        (district) => districtNeedle.includes(district) || district.includes(districtNeedle),
      )
    ) {
      points += 20;
    }
  }

  record(
    "Lokalizacja",
    "Preferowana dzielnica/okolica +20; pozostałe 0.",
    `${listing.district} ${listing.neighborhood ?? ""}`,
  );

  if (profile.minArea > 0 || profile.maxArea > 0) {
    maxPoints += 20;
    if (typeof area === "number") {
      const fitsMin = profile.minArea <= 0 || area >= profile.minArea;
      const fitsMax = profile.maxArea <= 0 || area <= profile.maxArea;
      if (fitsMin && fitsMax) {
        points += 20;
      } else if (
        (profile.minArea <= 0 || area >= profile.minArea - 5) &&
        (profile.maxArea <= 0 || area <= profile.maxArea + 5)
      ) {
        points += 10;
      } else {
        points -= 3;
      }
    }
  }

  record(
    "Metraż",
    "W zakresie +20; do 5 m² poza zakresem +10; ponad 5 m² poza zakresem −3. Brak danych lub wyłączony limit: 0.",
    `${listing.areaLabel}; zakres ${profile.minArea}–${profile.maxArea} m²`,
  );

  if (profile.minRooms > 0) {
    maxPoints += 25;
    if (typeof rooms === "number" && rooms >= Math.max(3, profile.minRooms)) {
      if (rooms === 4) {
        points += 25;
      } else if (rooms > 4) {
        points += profile.minRooms > 4 ? 25 : 23;
      } else if (rooms >= profile.minRooms) {
        points += (descriptionFacts.bedroomArea ?? 0) > 12 ? 23 : 18;
      }
    }
  }

  record(
    "Liczba pokoi",
    "Minimum 3 i minimum profilu: 3 pokoje +18, z potwierdzoną sypialnią/pokojem dziecięcym ponad 12 m² +23; 4 pokoje +25; więcej +23 (lub +25 przy minimum profilu ponad 4). Salon nie daje premii. Poniżej minimum 0. Bez osobnej premii za ten sam układ.",
    `Liczba pokoi: ${rooms ?? "brak danych"}; minimum profilu: ${profile.minRooms}${rooms === 3 ? `; sypialnia/pokój dziecięcy: ${descriptionFacts.bedroomArea === undefined ? "metraż do sprawdzenia" : `${descriptionFacts.bedroomArea} m²`}` : ""}`,
  );

  if (profile.maxPrice > 0) {
    maxPoints += 15;
    if (typeof price === "number") {
      if (price <= profile.maxPrice) {
        points += 15;
      } else {
        points += Math.max(-15, Math.round(15 - 300 * (price / profile.maxPrice - 1)));
      }
    }
  }

  record(
    "Cena zakupu",
    "Cena samego mieszkania do limitu +15. Ponad limit: −3 pkt za każdy 1% przekroczenia, płynnie i po zaokrągleniu: 1% +12, 2% +9, 5% 0, 7% −6, od 10% −15. Brak ceny lub wyłączony limit: 0.",
    `${listing.priceLabel}; limit ${profile.maxPrice} zł`,
  );

  if (profile.maxPricePerSqm > 0) {
    maxPoints += 20;
    if (typeof pricePerSqm === "number") {
      if (pricePerSqm <= profile.maxPricePerSqm) {
        const discountRatio = Math.min(
          1,
          Math.max(0, (profile.maxPricePerSqm - pricePerSqm) / (profile.maxPricePerSqm * 0.25)),
        );
        points += Math.round(10 + discountRatio * 10);
      } else {
        points += Math.max(-10, Math.round(10 - 200 * (pricePerSqm / profile.maxPricePerSqm - 1)));
      }
    }
  }

  record(
    "Cena za m²",
    "Przy limicie +10; 12,5% poniżej +15; od 25% poniżej +20. Ponad limit: 5% daje 0, od 10% −10. Pomiędzy płynnie, po zaokrągleniu. Brak ceny lub wyłączony limit: 0.",
    `${listing.pricePerSqmLabel ?? "Brak danych"}; limit ${profile.maxPricePerSqm} zł/m²`,
  );

  maxPoints += 16;
  if (descriptionFacts.unfinished || listing.finishQuality === "to_finish") {
    points += getUnfinishedPricePoints(pricePerSqm);
  } else if (listing.finishQuality === "ready") {
    points += 16;
  }

  record(
    "Stan wykończenia",
    "Gotowe do zamieszkania: +16 pkt. Brak danych o stanie: 0 pkt. Wymaga wykończenia — punkty zależą od ceny za m²: poniżej 17 tys. +5; 17–18 tys. +1; powyżej 18–19 tys. −4; powyżej 19–20 tys. −8; powyżej 20–21 tys. −12; powyżej 21 tys. −18; brak ceny −10.",
    descriptionFacts.unfinished || listing.finishQuality === "to_finish"
      ? "Wymaga wykończenia"
      : listing.finishQuality === "ready"
        ? "Gotowe do zamieszkania"
        : "Brak danych o stanie wykończenia",
  );

  // These are deliberately asymmetric: their absence is a real drawback for the
  // family profile, not merely a missed small bonus.
  const garageBonus = 15;
  const garagePenalty = profile.requiresGarage ? 36 : 10;
  maxPoints += garageBonus;
  const parkingAbsent =
    listing.amenityEvidence?.garage === false && listing.amenityEvidence?.outdoorParking === false;
  points += listing.hasGarage
    ? garageBonus
    : listing.hasOutdoorParking
      ? 8
      : -garagePenalty / (parkingAbsent ? 1 : 2);
  if (
    listing.hasGarage &&
    listing.garageTenure === "rental" &&
    !descriptionFacts.rentedMultipleParking
  )
    points -= 2;
  record(
    "Garaż",
    "Garaż +15 albo parking zewnętrzny +8, bez sumowania. Potwierdzony brak obu: −36 przy wymaganym parkingu, inaczej −10. Niepełne dane: połowa kary (−18 / −5). Najem garażu −2, chyba że naliczono −5 za wiele wynajmowanych miejsc.",
    listing.hasGarage
      ? listing.garageTenure === "rental"
        ? "Najem"
        : listing.garageTenure === "purchase_option"
          ? "Możliwość zakupu"
          : "Jest"
      : listing.hasOutdoorParking
        ? "Parking zewnętrzny zamiast garażu — bez kary"
        : parkingAbsent
          ? "Potwierdzony brak"
          : "brak danych",
  );

  maxPoints += 9;
  if (listing.hasStorage) {
    points += listing.storageTenure === "rental" ? 8 : 9;
  }

  record(
    "Komórka",
    "Jest +9; najem +8 (−1 pkt); brak 0.",
    listing.hasStorage
      ? listing.storageTenure === "rental"
        ? "Najem"
        : "Jest"
      : storageKnown
        ? "Potwierdzony brak"
        : "brak danych",
  );

  const liftBonus = 21;
  const floor = listing.floor ?? (hasApartmentGroundFloor(text) ? 0 : undefined);
  maxPoints += liftBonus;
  points += listing.hasLift ? liftBonus : floor === 0 ? 0 : liftKnown ? -20 : -10;

  record(
    "Winda",
    "Jest +21; parter bez windy 0. Pozostałe piętra: potwierdzony brak −20, brak informacji −10.",
    listing.hasLift
      ? "Jest"
      : liftKnown
        ? "Potwierdzony brak"
        : floor === 0
          ? "Parter — bez kary; brak danych o windzie"
          : "brak danych",
  );

  // Having both makes day-to-day use with a family much easier, so it earns an
  // additional joint premium beyond the individual amenities.
  maxPoints += 12;
  if (listing.hasGarage && listing.hasLift) {
    points += 12;
  }

  record("Garaż i winda razem", "Oba udogodnienia +12; inaczej 0.");

  maxPoints += 14;
  points += getBuildingYearPoints(listing.yearBuilt, now.getFullYear());
  record(
    "Rok budowy",
    "Do 1980: −4; 1981–1990: −2; 1991–2000: 0; 2001–2005: +4; 2006–2010: +6; 2011–2015: +8; 2016–2020: +10; po 2020: +12. Rok bieżący lub poprzedni: dodatkowe +2. Brak roku: −3.",
    String(listing.yearBuilt ?? "Brak danych"),
  );

  const topFloor =
    (typeof floor === "number" &&
      typeof listing.totalFloors === "number" &&
      listing.totalFloors > 0 &&
      floor === listing.totalFloors) ||
    (listing.totalFloors === undefined && descriptionFacts.topFloor);
  maxPoints += 12;
  points += getFloorPoints(floor, listing.totalFloors, topFloor);
  record(
    "Piętro",
    "Parter i poniżej −4. Wyżej: zaokrąglone 9 × piętro / liczba pięter; ostatnie dodatkowe +3. Przykłady: 2/5 +4, 4/5 +7, 5/5 +12, 13/13 +12. Bez wysokości budynku 0, chyba że potwierdzono ostatnie piętro. Sprzeczne dane 0 — do sprawdzenia.",
    `Piętro: ${floor ?? "brak danych"} / ${listing.totalFloors ?? "?"}${topFloor ? "; ostatnie piętro" : ""}`,
  );

  const exposure = getExposureEvaluation(
    listing.description ?? "",
    listing.exposureDirectionsOverride,
  );
  points += exposure.points;
  maxPoints += exposure.maxPoints;
  record(
    "Ekspozycja",
    "Jedna strona: S/W +4, E +2, N −15; kierunek SW +6, SE +4, NW +1, NE 0. Dwie strony: S/W +20, S/E lub E/W +18, S/N +15, N/W +13, N/E +11. Trzy: S/E/W i S/W/N +20, S/E/N i N/E/W +18; cztery +20. Nieznane kierunki: jedna strona −5, dwie +10, trzy +13. Brak danych 0. S = południe, W = zachód, N = północ, E = wschód.",
    `Strony: ${exposure.sides ?? "brak danych"}; kierunki: ${exposure.directions.join(", ") || "brak danych"}`,
  );

  if (profile.prefersBalcony) {
    maxPoints += 10;
    if (listing.hasBalcony) {
      points += 10;
    } else {
      points -= listing.amenityEvidence?.balcony === false ? 8 : 4;
    }
  }

  record(
    "Balkon",
    "Przy włączonej preferencji: jest +10, potwierdzony brak −8, brak informacji −4; preferencja wyłączona 0.",
    listing.hasBalcony
      ? "Jest"
      : listing.amenityEvidence?.balcony === false
        ? "Potwierdzony brak"
        : "brak danych",
  );

  // Each group describes one amenity; synonyms cannot multiply its bonus.
  maxPoints += 7;
  if (descriptionFacts.countertopPoints > 0) {
    points += descriptionFacts.countertopPoints;
  }
  record(
    "Blat",
    "Granit, konglomerat lub spiek +7; drewno (w tym naturalny dąb) +5. Najwyższa potwierdzona premia, tylko raz.",
    descriptionFacts.countertopPoints
      ? `Materiał potwierdzony w opisie: +${descriptionFacts.countertopPoints}`
      : "brak danych",
  );
  for (const [present, bonus, label] of [
    [descriptionFacts.woodenFloor, 8, "Drewniana podłoga"],
    [descriptionFacts.customCarpentry, 5, "Stolarka na wymiar"],
    [descriptionFacts.multipleParking, 5, "Co najmniej 2 miejsca parkingowe"],
  ] as const) {
    maxPoints += bonus;
    if (present) {
      points += bonus;
    }
    record(
      label,
      `Potwierdzona cecha +${bonus}; brak 0.`,
      present ? "Rozpoznano w opisie" : "brak danych",
    );
  }
  if (descriptionFacts.rentedMultipleParking) points -= 5;
  record(
    "Wynajem miejsc parkingowych",
    "Co najmniej dwa miejsca wynajmowane lub z miesięczną opłatą: dodatkowe −5 pkt. Premia +5 za liczbę miejsc pozostaje.",
    descriptionFacts.rentedMultipleParking
      ? "Rozpoznano wynajem / opłatę miesięczną za miejsca"
      : "brak danych",
  );
  const premiumSignals: Array<[RegExp, number, number?]> = [
    [/\barchitekt\w*\b/, 5],
    [
      /\b(?:ogrzewan\w*\s+podlogow\w*|podlogow\w*\s+ogrzewan\w*|podlogowk\w*|ogrzewan\w*\s+podlog\w*)\b/,
      4,
    ],
    [
      /\b(?:po\s+(?:(?:generaln\w*|gruntown\w*|kapitaln\w*|kompleksow\w*)\s+)?remoncie|(?:swiezo\s+)?wyremontowan\w*|odswiezon\w*)\b/,
      /remoncie|wyremontowan/.test(text) ? 4 : 3,
      4,
    ],
    [/\bgarderob\w*\b/, 5],
    [/\b(?:dwie|dwiema|dwoch|dwoma|2)\s+(?:osobn\w*\s+)?lazien\w*\b/, 4],
    [
      /\b(?:wysok\w*\s+standard\w*|wysok\w*\s+jakosc\w*\s+(?:wykonczen\w*|material\w*)|luksusow\w*\s+wykonczen\w*)\b/,
      1,
    ],
    [/\b(?:(?:zamkniet\w*|ogrodzon\w*)\s+osiedl\w*|osiedl\w*\s+(?:zamkniet\w*|ogrodzon\w*))\b/, 3],
    [/\b(?:monitoring\w*|monitorowan\w*|nadzor\w*\s+kamer\w*)\b/, 2],
    [
      /\b(?:(?:jasn\w*|sloneczn\w*|(?:dobr\w*\s+)?(?:nasloneczn\w*|doswietl\w*))\s+(?:mieszkanie|wnetrz\w*|lokal|salon|pokoje)|(?:mieszkanie|wnetrz\w*|lokal|salon|pokoje)\s+(?:jest\s+)?(?:jasn\w*|sloneczn\w*|dobr\w*\s+(?:nasloneczn\w*|doswietl\w*))|duzo\s+(?:naturaln\w*\s+)?swiatla)\b/,
      5,
    ],
  ];
  const twoBathrooms = hasPositiveDescriptionFact(text, premiumSignals[4][0]);
  const utilityComfort = descriptionFacts.separateWc || descriptionFacts.laundry;
  if (utilityComfort && !twoBathrooms) premiumSignals[4] = [premiumSignals[4][0], 3, 4];
  maxPoints += 5;
  if (listing.hasAirConditioning) {
    points += 5;
  }
  record(
    "Klimatyzacja",
    "Jest +5; brak danych 0.",
    listing.hasAirConditioning ? "Jest" : "brak danych",
  );
  const premiumLabels = [
    "Architekt",
    "Ogrzewanie podłogowe",
    "Remont / odświeżenie",
    "Garderoba",
    "Łazienki / WC / pralnia",
    "Wysoki standard",
    "Zamknięte osiedle",
    "Monitoring",
    "Jasne mieszkanie",
  ];
  for (const [index, [pattern, value, maximum = value]] of premiumSignals.entries()) {
    const present =
      index === 0
        ? descriptionFacts.architect
        : index === 4
          ? twoBathrooms || utilityComfort
          : hasPositiveDescriptionFact(text, pattern);
    maxPoints += maximum;
    if (present) {
      points += value;
    }
    record(
      premiumLabels[index],
      index === 4
        ? "Dwie łazienki +4 albo osobne WC / pralnia +3. Tylko najwyższa premia, bez sumowania; brak danych 0."
        : `Rozpoznana cecha +${value}; brak 0.`,
      index === 4
        ? twoBathrooms
          ? "Dwie łazienki"
          : utilityComfort
            ? "Osobne WC lub pralnia"
            : "brak danych"
        : present
          ? "Rozpoznano w opisie"
          : "brak danych",
    );
  }

  maxPoints += 2;
  points += descriptionFacts.bathroomFittings ? 2 : 0;
  record(
    "Armatura łazienkowa",
    "Konkretna armatura termostatyczna/podtynkowa lub rozpoznana marka przy armaturze +2 łącznie; samo hasło o jakości 0.",
    descriptionFacts.bathroomFittings ? "Rozpoznano konkretną armaturę" : "brak danych",
  );

  maxPoints += 7;
  points += getPriceDropPoints(listing.priceChangePercent);
  record(
    "Obniżka ceny",
    "Spadek: 0% = 0; >0–1% +2; >1–2% +4; >2–3% +5; >3–4% +6; >4% +7.",
    `${listing.priceChangePercent}%`,
  );

  const firstSeen = listing.firstSeenAt ?? listing.publishedAt;
  const ageDays = firstSeen ? (now.getTime() - Date.parse(firstSeen)) / 86_400_000 : NaN;
  maxPoints += 2;
  points += getListingAgePoints(listing.firstSeenAt ?? listing.publishedAt, now);

  record(
    "Wiek oferty",
    "Do 20 dni +2; >20–40 dni −1; >40 dni −2; brak daty 0.",
    Number.isFinite(ageDays) && ageDays >= 0
      ? `${Math.floor(ageDays)} ${Math.floor(ageDays) === 1 ? "dzień" : "dni"}`
      : "brak danych",
  );

  if (profile.maxMetroDistanceMeters > 0) {
    maxPoints += 13;
    const nearestMetro = findNearestWarsawMetroStation(listing.latitude, listing.longitude);
    if (nearestMetro && nearestMetro.distanceMeters <= profile.maxMetroDistanceMeters) {
      points += 10;
      if (nearestMetro.distanceMeters < profile.maxMetroDistanceMeters * 0.6) points += 3;
    } else if (
      nearestMetro &&
      nearestMetro.distanceMeters <= profile.maxMetroDistanceMeters * 1.5
    ) {
      points += 5;
    } else if (nearestMetro) {
      points -= 3;
    }
  }

  record(
    "Metro",
    "Poniżej 60% limitu +13 (bonus +3); od 60% do limitu +10; powyżej limitu do 150% limitu +5; powyżej 150% limitu −3. Brak współrzędnych lub wyłączony limit: 0. Odległość w linii prostej.",
    `Limit: ${profile.maxMetroDistanceMeters} m`,
  );

  const commuters = workplaces.filter((workplace) => workplace.workMode !== "remote");
  const commuteMinutes = commuters
    .map(
      (workplace) =>
        listing.scoringCommutes?.find(
          (route) =>
            route.key === workplace.key &&
            route.destinationLatitude === workplace.latitude &&
            route.destinationLongitude === workplace.longitude,
        )?.durationMinutes,
    )
    .filter(
      (minutes): minutes is number =>
        typeof minutes === "number" && Number.isFinite(minutes) && minutes >= 0,
    );
  const completeCommutes = commuters.length > 0 && commuteMinutes.length === commuters.length;
  const averageMinutes = completeCommutes
    ? commuteMinutes.reduce((sum, minutes) => sum + minutes, 0) / commuteMinutes.length
    : undefined;
  if (commuters.length) {
    maxPoints += 12;
    points +=
      averageMinutes === undefined
        ? -3
        : averageMinutes <= 35
          ? 12
          : averageMinutes <= 55
            ? Math.round(12 - (averageMinutes - 35) * 0.4)
            : Math.max(-5, Math.round(4 - (averageMinutes - 55) * 0.6));
  }

  record(
    "Dojazd do pracy",
    "Trasa samochodem bez aktualnych korków. Tylko osoby dojeżdżające: jedna — jej czas, kilka — średnia. Do 35 min +12; 45 min +8; 55 min +4; od 70 min −5; pomiędzy płynnie. Niepełne trasy −3. Bez osób dojeżdżających kryterium wyłączone.",
    !commuters.length
      ? "Brak osób dojeżdżających"
      : averageMinutes === undefined
        ? "Brak kompletu tras — do sprawdzenia po obliczeniu dojazdów"
        : `${Math.round(averageMinutes)} min; samochodem, bez aktualnych korków; cele: ${commuteMinutes.join(", ")} min`,
  );

  // Commercial terms affect the real acquisition cost. A broker listing with
  // explicitly no commission stays neutral; only an actual commission is a penalty.
  maxPoints += 10;
  if (listing.badges.includes("Z prowizją")) {
    points -= 15;
  } else if (
    listing.badges.includes("Oferta prywatna") ||
    listing.badges.includes("Oferta bezpośrednia")
  ) {
    points += 10;
  }

  record(
    "Sprzedający / prowizja",
    "Prowizja dla kupującego: −15 pkt. Oferta prywatna lub bezpośrednia bez oznaczenia prowizji: +10 pkt. Jeśli oferta ma oznaczenie prowizji, nie dostaje jednocześnie premii za sprzedaż bezpośrednią. Pozostałe oferty: 0 pkt.",
    listing.badges.join(", "),
  );
  maxPoints += 3;
  if (descriptionFacts.shower) {
    points += 3;
  }
  record(
    "Prysznic",
    "Prysznic, kabina prysznicowa lub natrysk +3; brak 0.",
    descriptionFacts.shower ? "Rozpoznano w opisie" : "brak danych",
  );
  const hasMaintenanceFee =
    descriptionFacts.maintenanceFee ||
    Boolean(listing.maintenanceFeeLabel?.match(/\d|bezczynsz|bez czynszu/i));
  if (!hasMaintenanceFee) points -= 2;
  record(
    "Informacja o czynszu",
    "Brak kwoty czynszu w ogłoszeniu −2; podana kwota lub mieszkanie bezczynszowe 0.",
    hasMaintenanceFee ? (listing.maintenanceFeeLabel ?? "Informacja w opisie") : "Brak kwoty",
  );
  const mortgage = estimateDreamMortgage(listing, financing);
  maxPoints += 10;
  if (mortgage) {
    points += mortgage.points;
  }
  record(
    "Szacowana rata",
    `Limit raty ${mortgage?.limit ?? financing?.maxMonthlyPayment ?? 7500} zł. Do limitu: 10 × (1 − rata / limit), czyli 0–10 pkt. Powyżej płynnie do −10 przy przekroczeniu o 20%. Wynik zaokrąglany. Brak ceny 0. Rata obejmuje znane dopłaty do zakupu.`,
    mortgage
      ? `${Math.round(mortgage.payment)} zł; limit ${mortgage.limit} zł`
      : "Brak ceny do wyliczenia raty",
  );
  // Coverage describes evidence for the scoring rules, never the number of points earned.
  // Text-only bonuses stay unknown without a positive signal; silence is not a denial.
  const known: Record<string, boolean> = {
    Lokalizacja: Boolean(districtNeedle) && !/brak|nieznan/.test(districtNeedle),
    Metraż: area !== undefined,
    "Liczba pokoi": typeof rooms === "number",
    "Cena zakupu": price !== undefined,
    "Cena za m²": pricePerSqm !== undefined,
    "Stan wykończenia":
      descriptionFacts.unfinished || listing.finishQuality === "to_finish"
        ? pricePerSqm !== undefined
        : listing.finishQuality === "ready",
    Garaż: listing.hasGarage === true || parkingAbsent || listing.hasOutdoorParking === true,
    "Parking zewnętrzny": listing.hasGarage === true || listing.hasOutdoorParking === true,
    Komórka: storageKnown,
    Winda: liftKnown,
    "Garaż i winda razem":
      (garageKnown && liftKnown) ||
      listing.amenityEvidence?.garage === false ||
      listing.amenityEvidence?.lift === false,
    "Rok budowy": typeof listing.yearBuilt === "number",
    Piętro:
      topFloor ||
      (typeof floor === "number" &&
        (floor <= 0 || (typeof listing.totalFloors === "number" && listing.totalFloors >= floor))),
    Ekspozycja: exposure.directions.length > 0,
    Balkon: listing.hasBalcony === true || listing.amenityEvidence?.balcony === false,
    Blat: descriptionFacts.countertopPoints > 0,
    "Drewniana podłoga": descriptionFacts.woodenFloor,
    "Stolarka na wymiar": descriptionFacts.customCarpentry,
    "Co najmniej 2 miejsca parkingowe": descriptionFacts.multipleParking,
    "Wynajem miejsc parkingowych": descriptionFacts.rentedMultipleParking,
    Klimatyzacja: listing.hasAirConditioning === true,
    ...Object.fromEntries(
      premiumSignals.map(([pattern], index) => [
        premiumLabels[index],
        index === 0
          ? descriptionFacts.architect
          : index === 4
            ? twoBathrooms || utilityComfort
            : hasPositiveDescriptionFact(text, pattern),
      ]),
    ),
    "Armatura łazienkowa": descriptionFacts.bathroomFittings,
    "Obniżka ceny": Number.isFinite(listing.priceChangePercent),
    "Wiek oferty": Number.isFinite(ageDays) && ageDays >= 0,
    Metro: Boolean(findNearestWarsawMetroStation(listing.latitude, listing.longitude)),
    "Dojazd do pracy": completeCommutes,
    "Sprzedający / prowizja": listing.badges.some((badge) =>
      ["Z prowizją", "Oferta prywatna", "Oferta bezpośrednia", "Bez prowizji"].includes(badge),
    ),
    Prysznic: descriptionFacts.shower,
    "Informacja o czynszu": Boolean(hasMaintenanceFee),
    "Szacowana rata": Boolean(mortgage),
  };
  const evaluatedRows = rows.map((row) => ({
    ...row,
    dataStatus: (row.maxPoints === 0 &&
    !["Informacja o czynszu", "Wynajem miejsc parkingowych"].includes(row.label)
      ? "inactive"
      : known[row.label]
        ? "known"
        : "unknown") as "inactive" | "known" | "unknown",
  }));
  const activeRows = evaluatedRows.filter((row) => row.dataStatus !== "inactive");
  const knownCount = activeRows.filter((row) => row.dataStatus === "known").length;
  const coverage = {
    known: knownCount,
    total: activeRows.length,
    percent: activeRows.length ? Math.round((100 * knownCount) / activeRows.length) : 0,
    unknowns: activeRows
      .filter((row) => row.dataStatus === "unknown")
      .sort((a, b) => b.maxPoints - a.maxPoints)
      .slice(0, 3)
      .map((row) => row.label),
  };
  return {
    rows: evaluatedRows,
    coverage,
    mortgage,
    points,
    maxPoints,
    score: maxPoints > 0 ? Math.min(100, Math.max(0, Math.round((points / maxPoints) * 100))) : 0,
  };
}

function parseNumericLabel(value?: string) {
  if (!value) {
    return undefined;
  }

  const match = value.match(/-?\d[\d\s.]*(?:,\d+)?/);
  if (!match?.[0]) {
    return undefined;
  }

  const compact = match[0].replace(/\s+/g, "");
  const numeric = Number(
    compact.includes(",")
      ? compact.replace(/\./g, "").replace(",", ".")
      : /^-?\d{1,3}(?:\.\d{3})+$/.test(compact)
        ? compact.replace(/\./g, "")
        : compact,
  );
  return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizeLocationComparable(value: string) {
  const replacements: Array<[RegExp, string]> = [
    [/\bna\b/g, " "],
    [/\bw\b/g, " "],
    [/\bwe\b/g, " "],
    [/\bprzy\b/g, " "],
    [/\bpradze\b/g, "praga"],
    [/\bpoludniu\b/g, "poludnie"],
    [/\bpolnocy\b/g, "polnoc"],
    [/\bsrodmiesciu\b/g, "srodmiescie"],
    [/\bzoliborzu\b/g, "zoliborz"],
    [/\bmokotowie\b/g, "mokotow"],
    [/\bwoli\b/g, "wola"],
    [/\bbemowie\b/g, "bemowo"],
    [/\bbialolece\b/g, "bialoleka"],
    [/\bbielanach\b/g, "bielany"],
    [/\bochocie\b/g, "ochota"],
    [/\bursynowie\b/g, "ursynow"],
    [/\bursusie\b/g, "ursus"],
    [/\bwilanowie\b/g, "wilanow"],
    [/\bwawrze\b/g, "wawer"],
    [/\bwesolej\b/g, "wesola"],
    [/\bwlochach\b/g, "wlochy"],
    [/\bgoclawiu\b/g, "goclaw"],
    [/\bsaskiej kepie\b/g, "saska kepa"],
  ];

  let normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .replace(/-/g, " ");

  for (const [pattern, replacement] of replacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}

export function estimateDreamMortgage(
  listing: ListingSummary,
  financing?: FamilySettings["financing"],
) {
  const total = listing.totalAcquisitionPrice ?? parseNumericLabel(listing.priceLabel);
  if (total === undefined || !Number.isFinite(total) || total <= 0) return null;
  const suppliedDownPayment = financing?.downPayment ?? defaultDownPayment;
  const downPayment = Number.isFinite(suppliedDownPayment)
    ? Math.max(0, suppliedDownPayment)
    : defaultDownPayment;
  const principal = Math.max(0, total - downPayment);
  const monthlyRate = 5.8 / 1200;
  const payment = (principal * monthlyRate) / (1 - (1 + monthlyRate) ** -360);
  const suppliedLimit = financing?.maxMonthlyPayment;
  const limit =
    typeof suppliedLimit === "number" && Number.isFinite(suppliedLimit) && suppliedLimit > 0
      ? suppliedLimit
      : 7500;
  const points =
    Math.max(
      -10,
      Math.round(payment <= limit ? 10 * (1 - payment / limit) : -50 * (payment / limit - 1)),
    ) || 0;
  return { total, downPayment, principal, payment, points, limit };
}
