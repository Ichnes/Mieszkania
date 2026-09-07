import type { FamilySettings, ListingSummary } from "@mieszkania/shared";
import { findNearestWarsawMetroStation } from "@mieszkania/shared";
import { parseNumericLabel } from "../../../shared/lib/format";
import { normalizeLocationComparable } from "../../../shared/lib/text";
import { straightLineDistanceKm } from "../../map/lib/geometry";
import { normalizeListingText } from "./listing-language";

export function applyDreamProfile(listings: ListingSummary[], settings: FamilySettings) {
  return listings.map((listing) => {
    // For `dream_desc` the API already calculates and globally sorts the exact
    // score. Do not overwrite it here with the presentation fallback.
    const dreamScore =
      typeof listing.dreamScore === "number"
        ? listing.dreamScore
        : computeDreamScore(listing, settings.dreamProfile, settings.workplaces);

    return {
      ...listing,
      dreamScore,
    };
  });
}

export function computeDreamScore(
  listing: ListingSummary,
  profile: FamilySettings["dreamProfile"],
  workplaces: FamilySettings["workplaces"],
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

  if (preferredDistricts.length > 0) {
    maxPoints += 20;
    if (
      preferredDistricts.some(
        (district) => districtNeedle.includes(district) || district.includes(districtNeedle),
      )
    ) {
      points += 20;
    }
  }

  if (profile.minArea > 0 || profile.maxArea > 0) {
    maxPoints += 20;
    if (typeof area === "number") {
      const fitsMin = profile.minArea <= 0 || area >= profile.minArea;
      const fitsMax = profile.maxArea <= 0 || area <= profile.maxArea;
      if (fitsMin && fitsMax) {
        points += 20;
      } else if (
        (profile.minArea > 0 && area >= profile.minArea - 5) ||
        (profile.maxArea > 0 && area <= profile.maxArea + 5)
      ) {
        points += 10;
      }
    }
  }

  if (profile.minRooms > 0) {
    maxPoints += 18;
    if (typeof rooms === "number") {
      if (rooms === 4) {
        points += 18;
      } else if (rooms > 4) {
        points += 14;
      } else if (rooms >= profile.minRooms) {
        points += 11;
      }
    }
  }

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

  maxPoints += 12;
  if (listing.finishQuality === "ready") {
    points += 12;
  } else if (listing.finishQuality === "unknown") {
    points += 6;
  }

  const garageBonus = profile.requiresGarage ? 20 : 15;
  const garagePenalty = profile.requiresGarage ? 32 : 9;
  maxPoints += garageBonus;
  points += listing.hasGarage ? garageBonus : -garagePenalty;

  maxPoints += 6;
  if (listing.hasStorage) {
    points += 6;
  }

  const liftBonus = 18;
  maxPoints += liftBonus;
  points += listing.hasLift ? liftBonus : -12;

  maxPoints += 10;
  if (listing.hasGarage && listing.hasLift) {
    points += 10;
  }

  if (typeof listing.yearBuilt === "number") {
    maxPoints += 12;
    if (listing.yearBuilt >= 2000) {
      const progress = Math.min(
        1,
        (listing.yearBuilt - 2000) / Math.max(1, new Date().getFullYear() - 2000),
      );
      points += 2 + Math.round(progress * 10);
    }
  }

  if (typeof listing.floor === "number") {
    maxPoints += 5;
    if (listing.floor <= 0) {
      points -= 2;
    } else if (typeof listing.totalFloors === "number" && listing.totalFloors > 0) {
      points +=
        listing.floor >= listing.totalFloors
          ? 5
          : Math.max(1, Math.round((listing.floor / listing.totalFloors) * 4));
    } else {
      points += Math.min(5, Math.max(1, listing.floor));
    }
  }

  if (profile.prefersBalcony) {
    maxPoints += 5;
    if (listing.hasBalcony) {
      points += 5;
    }
  }

  const listingText = normalizeListingText(`${listing.title} ${listing.description ?? ""}`);
  if (
    /\b(?:drewnian\w*\s+(?:podlog\w*|parkiet\w*)|podlog\w*[^.!?;]{0,70}?(?:(?:egzotyczn\w*\s+)?drewn\w*|dab\w*\s+wedzon\w*)|egzotyczn\w*\s+drewn\w*|debow\w*\s+desk\w*|merbau\w*|parkiet\w*|desk\w*\s+podlogow\w*)\b/.test(
      listingText,
    )
  ) {
    maxPoints += 3;
    points += 3;
  }
  if (/\b(?:ogrzewan\w*\s+podlogow\w*|podlogow\w*\s+ogrzewan\w*)\b/.test(listingText)) {
    maxPoints += 3;
    points += 3;
  }
  if (
    /\b(?:(?:zaaranzowan\w*|zaprojektowan\w*|urzadzon\w*)\s+przez\s+(?:renomowan\w*\s+)?architekt\w*|projekt\w*\s+architekt\w*)\b/.test(
      listingText,
    )
  ) {
    maxPoints += 5;
    points += 5;
  }
  if (listing.hasAirConditioning) {
    maxPoints += 4;
    points += 4;
  }

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

  // Broker listing without commission is neutral. A commission reduces the
  // effective budget, while a private listing earns a small direct-deal bonus.
  if (listing.badges.includes("Z prowizją")) {
    points -= 12;
  } else if (
    listing.badges.includes("Oferta prywatna") ||
    listing.badges.includes("Oferta bezpośrednia")
  ) {
    points += 8;
  }

  return maxPoints > 0 ? Math.max(0, Math.round((points / maxPoints) * 100)) : 0;
}
