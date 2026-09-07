export function isValidMapPoint(latitude?: number, longitude?: number) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return false;
  }

  return latitude >= 51.8 && latitude <= 52.5 && longitude >= 20.7 && longitude <= 21.3;
}

export function straightLineDistanceKm(
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
