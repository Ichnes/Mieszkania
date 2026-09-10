import data from "./data/warsaw-transport.json" with { type: "json" };

export type TransportPoint = { name: string; latitude: number; longitude: number };
export type TransportLine = Array<[number, number]>;
export type TramwayMap = {
  stops: Array<TransportPoint & { routes: string[] }>;
  lines: TransportLine[];
  routes: Array<{ id: string; ref: string; name: string; lines: TransportLine[] }>;
};
export type RailwayMap = { stations: TransportPoint[]; lines: TransportLine[] };

// A versioned OSM snapshot ships with the app. Opening a map never contacts Overpass.
export const warsawTramwayMap = data.tramway as TramwayMap;
export const warsawRailwayMap = data.railway as RailwayMap;
export const transportSnapshotDate = data.updatedAt;
