export type RcnPowiatConfig = {
  key: string;
  label: string;
  cityFocus: string;
  wfsCapabilitiesUrl: string;
  /** Kod TERYT publikowany przez GUGiK w warstwie RCN. */
  terytPrefix: string;
  /** Granice zapytania w układzie EPSG:2180: minX,minY,maxX,maxY. */
  bbox2180: [number, number, number, number];
};

export type RcnImportRunResult = {
  scope: string;
  checkedPowiatCount: number;
  importedTransactions?: number;
  powiats: Array<{
    key: string;
    label: string;
    wfsCapabilitiesUrl: string;
    status: "planned" | "checked" | "imported" | "failed";
    featureTypes?: string[];
    importedCount?: number;
    error?: string;
  }>;
};
