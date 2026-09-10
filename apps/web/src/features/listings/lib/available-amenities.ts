import type { AmenityAnalysis, NearbyAmenitySummary } from "@mieszkania/shared";

export function availableAmenities(amenities: NearbyAmenitySummary[], analysis?: AmenityAnalysis) {
  if (analysis?.status === "available" && !analysis.partial) return amenities;
  return amenities.filter(
    (amenity) =>
      amenity.count > 0 ||
      amenity.nearestDistanceMeters != null ||
      Boolean(amenity.nearestPlaces?.length) ||
      amenity.within500m != null ||
      amenity.within1000m != null,
  );
}
