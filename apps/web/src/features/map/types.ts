export type MapCoordinate = {
  name: string;
  latitude: number;
  longitude: number;
  connectionOnly?: boolean;
};

export type MetroMapLine = {
  code: "M1" | "M2" | "M3" | "M4" | "M5";
  planned?: boolean;
  approximate?: boolean;
  statusLabel?: string;
  sourceUrl?: string;
  stations: MapCoordinate[];
};
