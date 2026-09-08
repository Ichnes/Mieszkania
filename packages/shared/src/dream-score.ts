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
  const text = normalizePolish(`${listing.title} ${listing.description ?? ""}`).toLowerCase();
  const descriptionFacts = getDreamDescriptionFacts(text);
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
      }
    }
  }

  record(
    "Metraż",
    "W zakresie +20; do 5 m² poza zakresem +10; dalej 0.",
    `${listing.areaLabel}; zakres ${profile.minArea}–${profile.maxArea} m²`,
  );

  if (profile.minRooms > 0) {
    maxPoints += 18;
    if (typeof rooms === "number" && rooms >= Math.max(3, profile.minRooms)) {
      if (rooms === 4) {
        points += 18;
      } else if (rooms > 4) {
        points += 14;
      } else if (rooms >= profile.minRooms) {
        points += 11;
      }
    }
  }

  record(
    "Liczba pokoi",
    "Minimum 3 i minimum profilu: 3 pokoje +11, 4 +18, więcej +14; poniżej minimum 0.",
    `Liczba pokoi: ${rooms ?? "brak danych"}; minimum profilu: ${profile.minRooms}`,
  );

  if (profile.maxPrice > 0) {
    maxPoints += 15;
    if (typeof price === "number") {
      if (price <= profile.maxPrice) {
        points += 15;
      } else if (price <= profile.maxPrice * 1.07) {
        points += 7;
      }
    }
  }

  record(
    "Cena zakupu",
    "Do limitu +15; przekroczenie do 7% +7; dalej 0.",
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
        points += Math.round(6 + discountRatio * 14);
      } else if (pricePerSqm <= profile.maxPricePerSqm * 1.07) {
        points += 3;
      }
    }
  }

  record(
    "Cena za m²",
    "Przy limicie +6, liniowo do +20 przy cenie 25% niższej; do 7% ponad limit +3; dalej 0.",
    `${listing.pricePerSqmLabel ?? "Brak danych"}; limit ${profile.maxPricePerSqm} zł/m²`,
  );

  maxPoints += 16;
  if (descriptionFacts.unfinished || listing.finishQuality === "to_finish") {
    points += getUnfinishedPricePoints(pricePerSqm);
  } else if (listing.finishQuality === "ready") {
    points += 16;
  } else if (listing.finishQuality === "unknown") {
    points += 7;
  } else {
    // Developer standard requires a separate finishing budget, not merely
    // cosmetic work.
    points -= 10;
  }

  record(
    "Stan wykończenia",
    "Gotowe +16; nieznane +7. Do wykończenia: <17 tys. +5; 17–18 tys. +1; >18–19 tys. −4; >19–20 tys. −8; >20–21 tys. −12; >21 tys. −18; brak ceny −10.",
    listing.finishQuality ?? "Brak danych",
  );

  // These are deliberately asymmetric: their absence is a real drawback for the
  // family profile, not merely a missed small bonus.
  const garageBonus = profile.requiresGarage ? 24 : 16;
  const garagePenalty = profile.requiresGarage ? 36 : 10;
  maxPoints += garageBonus;
  points += listing.hasGarage ? garageBonus : -garagePenalty;
  record(
    "Garaż",
    "Wymagany: +24 / brak −36. Niewymagany: +16 / brak −10.",
    listing.hasGarage ? "Jest" : "Brak potwierdzenia",
  );

  if (!listing.hasGarage && listing.hasOutdoorParking) {
    maxPoints += 8;
    points += 8;
  }

  record("Parking zewnętrzny", "Bez garażu, z parkingiem zewnętrznym +8.");

  maxPoints += 9;
  if (listing.hasStorage) {
    points += 9;
  }

  record("Komórka", "Jest +9; brak 0.", listing.hasStorage ? "Jest" : "Brak potwierdzenia");

  const liftBonus = 21;
  maxPoints += liftBonus;
  points += listing.hasLift ? liftBonus : -20;

  record("Winda", "Jest +21; brak −20.", listing.hasLift ? "Jest" : "Brak potwierdzenia");

  // Having both makes day-to-day use with a family much easier, so it earns an
  // additional joint premium beyond the individual amenities.
  maxPoints += 12;
  if (listing.hasGarage && listing.hasLift) {
    points += 12;
  }

  record("Garaż i winda razem", "Oba udogodnienia +12; inaczej 0.");

  if (typeof listing.yearBuilt === "number") maxPoints += 14;
  points += getBuildingYearPoints(listing.yearBuilt, now.getFullYear());
  record(
    "Rok budowy",
    "Do 1980: −4; 1981–1990: −2; 1991–2000: 0; 2001–2005: +4; 2006–2010: +6; 2011–2015: +8; 2016–2020: +10; po 2020: +12. Rok bieżący lub poprzedni: dodatkowe +2. Brak roku: −3.",
    String(listing.yearBuilt ?? "Brak danych"),
  );

  const floor = listing.floor ?? (hasApartmentGroundFloor(text) ? 0 : undefined);
  const topFloor =
    (typeof floor === "number" &&
      typeof listing.totalFloors === "number" &&
      listing.totalFloors > 0 &&
      floor >= listing.totalFloors) ||
    descriptionFacts.topFloor;
  if (typeof floor === "number") maxPoints += 12;
  points += getFloorPoints(floor);
  if (topFloor) {
    points += 5;
    maxPoints += 5;
  }
  record(
    "Piętro",
    "Parter i poniżej −4; 1: +1; 2: −2; 3: +3; 4: +4; 5: +5; 6: +7; 7: +8; 8–12: +9; powyżej 12: +12. Ostatnie piętro: dodatkowe +5, tylko raz.",
    `Piętro: ${floor ?? "brak danych"} / ${listing.totalFloors ?? "?"}${topFloor ? "; ostatnie piętro +5" : ""}`,
  );

  const exposure = getExposureEvaluation(listing.description ?? "");
  points += exposure.points;
  maxPoints += exposure.maxPoints;
  record(
    "Ekspozycja",
    "Brak danych 0; jednostronne −5, ale S +2, W +4, N −15, E +2; dwustronne +10 i bonus: S/W +10, S/E +7, S/N +4, N/W +2, N/E +1, E/W +8; trójstronne +13 i bonus: S/E/W +5, S/W/N +4, S/E/N +3, N/W/E +1.",
    `Strony: ${exposure.sides ?? "brak danych"}; kierunki: ${exposure.directions.join(", ") || "brak danych"}`,
  );

  if (profile.prefersBalcony) {
    maxPoints += 10;
    if (listing.hasBalcony) {
      points += 10;
    } else {
      points -= 8;
    }
  }

  record(
    "Balkon",
    "Przy włączonej preferencji: jest +10, brak −8; preferencja wyłączona 0.",
    listing.hasBalcony ? "Jest" : "Brak potwierdzenia",
  );

  // Each group describes one amenity; synonyms cannot multiply its bonus.
  for (const [present, bonus, label] of [
    [descriptionFacts.stoneCountertop, 8, "Kamienny blat"],
    [descriptionFacts.woodenFloor, 6, "Drewniana podłoga"],
    [descriptionFacts.customCarpentry, 5, "Stolarka na wymiar"],
    [descriptionFacts.multipleParking, 5, "Co najmniej 2 miejsca parkingowe"],
  ] as const) {
    if (present) {
      points += bonus;
      maxPoints += bonus;
    }
    record(
      label,
      `Potwierdzona cecha +${bonus}; brak 0.`,
      present ? "Rozpoznano w opisie" : "Brak potwierdzenia",
    );
  }
  if (descriptionFacts.rentedMultipleParking) points -= 5;
  record(
    "Wynajem miejsc parkingowych",
    "Co najmniej dwa miejsca wynajmowane lub z miesięczną opłatą: dodatkowe −5 pkt. Premia +5 za liczbę miejsc pozostaje.",
    descriptionFacts.rentedMultipleParking
      ? "Rozpoznano wynajem / opłatę miesięczną za miejsca"
      : "Brak potwierdzonego kosztu wynajmu co najmniej dwóch miejsc",
  );
  const premiumSignals: Array<[RegExp, number]> = [
    [/\barchitekt\w*\b/, 8],
    [
      /\b(?:ogrzewan\w*\s+podlogow\w*|podlogow\w*\s+ogrzewan\w*|podlogowk\w*|ogrzewan\w*\s+podlog\w*)\b/,
      4,
    ],
    [
      /\b(?:po\s+(?:(?:generaln\w*|gruntown\w*|kapitaln\w*|kompleksow\w*)\s+)?remoncie|(?:swiezo\s+)?wyremontowan\w*|odswiezon\w*)\b/,
      /remoncie|wyremontowan/.test(text) ? 4 : 3,
    ],
    [/\bgarderob\w*\b/, 5],
    [/\b(?:dwie|dwiema|dwoch|dwoma|2)\s+(?:osobn\w*\s+)?lazien\w*\b/, 4],
    [/\b(?:gabinet\w*|pokoj\w*\s+do\s+pracy|domow\w*\s+biur\w*|biur\w*\s+domow\w*)\b/, 5],
    [/\b(?:wysok\w*\s+standard\w*|wysok\w*\s+jakosc\w*|luksusow\w*\s+wykonczen\w*)\b/, 4],
    [/\b(?:(?:zamkniet\w*|ogrodzon\w*)\s+osiedl\w*|osiedl\w*\s+(?:zamkniet\w*|ogrodzon\w*))\b/, 3],
    [/\b(?:monitoring\w*|monitorowan\w*|nadzor\w*\s+kamer\w*)\b/, 2],
    [
      /\b(?:jasn\w*|dobr\w*\s+(?:nasloneczn\w*|doswietl\w*)|sloneczn\w*|duzo\s+(?:naturaln\w*\s+)?swiatla)\b/,
      5,
    ],
  ];
  if (listing.hasAirConditioning) {
    maxPoints += 5;
    points += 5;
  }
  record("Klimatyzacja", "Jest +5; brak 0.");
  const premiumLabels = [
    "Architekt",
    "Ogrzewanie podłogowe",
    "Remont / odświeżenie",
    "Garderoba",
    "Dwie łazienki",
    "Gabinet",
    "Wysoki standard",
    "Zamknięte osiedle",
    "Monitoring",
    "Jasne mieszkanie",
  ];
  for (const [index, [pattern, value]] of premiumSignals.entries()) {
    if (hasPositiveDescriptionFact(text, pattern)) {
      maxPoints += value;
      points += value;
    }
    record(
      premiumLabels[index],
      `Rozpoznana cecha +${value}; brak 0.`,
      hasPositiveDescriptionFact(text, pattern) ? "Rozpoznano w opisie" : "Brak potwierdzenia",
    );
  }

  // A fixed family-layout budget keeps three-room and four-room offers comparable.
  maxPoints += 8;
  if (rooms !== undefined && rooms >= Math.max(3, profile.minRooms)) {
    if (rooms === 4) points += 8;
    else if (rooms > 4) points += 6;
    else if (rooms === 3 && area !== undefined && area >= 75) points += 4;
  }

  record("Układ mieszkania", "3 pokoje od 75 m² +4; 4 pokoje +8; więcej +6. Poniżej minimum 0.");

  maxPoints += 7;
  points += getPriceDropPoints(listing.priceChangePercent);
  record(
    "Obniżka ceny",
    "Spadek: 0% = 0; >0–1% +2; >1–2% +4; >2–3% +5; >3–4% +6; >4% +7.",
    `${listing.priceChangePercent}%`,
  );

  maxPoints += 2;
  points += getListingAgePoints(listing.firstSeenAt ?? listing.publishedAt, now);

  record(
    "Wiek oferty",
    "Do 20 dni +2; >20–40 dni −1; >40 dni −2; brak daty 0.",
    listing.firstSeenAt ?? listing.publishedAt ?? "Brak daty",
  );

  if (profile.maxMetroDistanceMeters > 0) {
    maxPoints += 10;
    const nearestMetro = findNearestWarsawMetroStation(listing.latitude, listing.longitude);
    if (nearestMetro && nearestMetro.distanceMeters <= profile.maxMetroDistanceMeters) {
      points += 10;
    } else if (
      nearestMetro &&
      nearestMetro.distanceMeters <= profile.maxMetroDistanceMeters * 1.5
    ) {
      points += 5;
    }
  }

  record(
    "Metro",
    "Do limitu +10; do 150% limitu +5; dalej 0. Odległość w linii prostej.",
    `Limit: ${profile.maxMetroDistanceMeters} m`,
  );

  const commuteDistances = workplaces
    .map((workplace) =>
      straightLineDistanceKm(
        listing.latitude,
        listing.longitude,
        workplace.latitude,
        workplace.longitude,
      ),
    )
    .filter((distance): distance is number => typeof distance === "number");
  if (commuteDistances.length > 0) {
    maxPoints += 12;
    const averageDistance =
      commuteDistances.reduce((sum, distance) => sum + distance, 0) / commuteDistances.length;
    if (averageDistance <= 7) {
      points += 12;
    } else if (averageDistance <= 12) {
      points += 8;
    } else if (averageDistance <= 18) {
      points += 4;
    }
  }

  record(
    "Dojazd do pracy",
    "Średnia odległość w linii prostej: do 7 km +12, do 12 km +8, do 18 km +4; dalej/brak danych 0.",
    `${commuteDistances.length} miejsc pracy z koordynatami`,
  );

  // Commercial terms affect the real acquisition cost. A broker listing with
  // explicitly no commission stays neutral; only an actual commission is a penalty.
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
    "Oferta prywatna lub bezpośrednia +10; prowizja −15 (pierwszeństwo); inaczej 0.",
    listing.badges.join(", "),
  );
  if (descriptionFacts.shower) {
    points += 3;
    maxPoints += 3;
  }
  record(
    "Prysznic",
    "Prysznic, kabina prysznicowa lub natrysk +3; brak 0.",
    descriptionFacts.shower ? "Rozpoznano w opisie" : "Brak potwierdzenia",
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
  if (mortgage) {
    maxPoints += 10;
    points += mortgage.points;
  }
  record(
    "Szacowana rata",
    "Powyżej 7500 zł −10. Do 7500 zł: zaokrąglone 10 × (1 − rata / 7500), czyli 0–10 pkt. Brak ceny: 0.",
    mortgage
      ? `Rata ${Math.round(mortgage.payment)} zł; zakup ${Math.round(mortgage.total)} zł; wkład ${mortgage.downPayment} zł; 5,8% rocznie; 360 rat.`
      : "Brak ceny do wyliczenia raty",
  );
  return {
    rows,
    mortgage,
    points,
    maxPoints,
    score: maxPoints > 0 ? Math.min(100, Math.max(0, Math.round((points / maxPoints) * 100))) : 0,
  };
}

function straightLineDistanceKm(
  latitude?: number,
  longitude?: number,
  targetLatitude?: number,
  targetLongitude?: number,
) {
  if (
    [latitude, longitude, targetLatitude, targetLongitude].some(
      (value) => typeof value !== "number",
    )
  ) {
    return undefined;
  }

  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(targetLatitude! - latitude!);
  const longitudeDelta = toRadians(targetLongitude! - longitude!);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitude!)) *
      Math.cos(toRadians(targetLatitude!)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  const points = payment > 7500 ? -10 : Math.round(10 * (1 - payment / 7500));
  return { total, downPayment, principal, payment, points };
}
