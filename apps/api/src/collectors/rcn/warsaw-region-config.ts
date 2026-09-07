import type { RcnPowiatConfig } from "./types";

export const warsawAreaRcnPowiatConfigs: RcnPowiatConfig[] = [
  {
    key: "m-st-warszawa",
    label: "m.st. Warszawa",
    cityFocus: "Warszawa",
    wfsCapabilitiesUrl:
      "https://mapy.geoportal.gov.pl/wss/service/rcn?service=WFS&request=GetCapabilities",
    terytPrefix: "1465",
    bbox2180: [470000, 630000, 510000, 670000],
  },
];
