import { warsawRailLines } from "../data/transit";
import { warsawRailwayMap } from "@mieszkania/shared/transport";
import type { MapCoordinate } from "../types";

// A partial/unavailable remote response must not remove WKD from a fresh installation.
export function mapRailStations(remote?: MapCoordinate[]) {
  if (!remote?.length) remote = warsawRailwayMap.stations;
  const stations = new Map(
    remote.map((station) => [station.name.trim().toLocaleLowerCase("pl-PL"), station]),
  );
  for (const station of warsawRailLines
    .filter((line) => line.name.startsWith("WKD"))
    .flatMap((line) => line.stations)) {
    const key = station.name.trim().toLocaleLowerCase("pl-PL");
    if (!stations.has(key)) stations.set(key, station);
  }
  return [...stations.values()];
}
