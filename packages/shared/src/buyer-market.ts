export interface BuyerObservation {
  id: string;
  district: string;
  neighborhood: string;
  rooms: number;
  area: number;
  year: number | null;
  market: string;
  price: number;
  start: number;
  end: number | null;
  relisted: boolean;
  portals?: string[];
  floor?: number | null;
  finish?: string;
  // UTC day and recorded asking price, in chronological order.
  history: [number, number][];
}
