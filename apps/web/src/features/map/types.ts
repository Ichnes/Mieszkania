export type MapCoordinate = { name: string; latitude: number; longitude: number };

export type MetroMapLine = {
  code: "M1" | "M2" | "M3" | "M4" | "M5";
  planned?: boolean;
  stations: MapCoordinate[];
};
