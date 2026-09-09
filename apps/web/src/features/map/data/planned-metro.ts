import { warsawMetroStations } from "@mieszkania/shared";
import type { MapCoordinate, MetroMapLine } from "../types";

// Geographic references and digitisation method: docs/reference/metro-map-sources.md.
// These are approximate station centres, not surveyed entrances or tunnel alignments.
const stations = (rows: Array<[string, number, number]>): MapCoordinate[] =>
  rows.map(([name, latitude, longitude]) => ({ name, latitude, longitude }));
const karolin = { name: "Karolin", latitude: 52.2170358, longitude: 20.8862184 };

export const plannedMetroLines: MetroMapLine[] = [
  {
    code: "M2",
    planned: true,
    statusLabel: "w budowie",
    sourceUrl: "https://metro.waw.pl/metro-warszawskie/linia-m2/odcinek-3stp/",
    stations: [
      {
        ...warsawMetroStations.find((station) => station.name === "Bemowo")!,
        connectionOnly: true,
      },
      { name: "Lazurowa", latitude: 52.2385408, longitude: 20.8982835 },
      { name: "Chrzanów", latitude: 52.2279949, longitude: 20.8896758 },
      karolin,
    ],
  },
  {
    code: "M2",
    planned: true,
    approximate: true,
    statusLabel: "planowana",
    sourceUrl: "https://metro.waw.pl/metro-warszawskie/linia-m2/odcinek-3-na-ursus/",
    stations: [
      { ...karolin, connectionOnly: true },
      ...stations([
        ["Ursus Północny", 52.2064, 20.8867],
        ["Posag 7 Panien", 52.2024, 20.8745],
        ["Ursus-Niedźwiadek", 52.1916, 20.8685],
      ]),
    ],
  },
  {
    code: "M4",
    planned: true,
    approximate: true,
    statusLabel: "prace przedprojektowe",
    sourceUrl: "https://metro.waw.pl/metro-warszawskie/linia-m4/m4-przebieg-i-lokalizacja-stacji/",
    stations: stations([
      ["Myśliborska", 52.3174, 20.9625],
      ["Obrazkowa", 52.3147, 20.976],
      ["Płochocińska", 52.3077, 20.9834],
      ["Ruda", 52.2875, 20.9767],
      ["Marymont", 52.2716, 20.9719],
      ["Rydygiera", 52.2604, 20.9804],
      ["Rondo Radosława", 52.2543, 20.9829],
      ["Cmentarz Żydowski", 52.2466, 20.9775],
      ["Okopowa", 52.2391, 20.9797],
      ["Rondo Daszyńskiego", 52.2307, 20.983],
      ["Plac Zawiszy", 52.2241, 20.9877],
      ["Plac Narutowicza", 52.219, 20.985],
      ["Bitwy Warszawskiej 1920", 52.2109, 20.9767],
      ["Wiślicka", 52.2043, 20.9764],
      ["Żwirki i Wigury", 52.1932, 20.9819],
      ["Służewiec", 52.1811, 20.988],
      ["Rondo Unii Europejskiej", 52.178, 21.0018],
      ["Smoluchowskiego", 52.1801, 21.0128],
      ["Wilanowska", 52.1818, 21.0231],
      ["Dolina Służewiecka", 52.1748, 21.0461],
      ["Patkowskiego", 52.1723, 21.0557],
      ["Sobieskiego", 52.1697, 21.0679],
      ["Wilanów", 52.1664, 21.0857],
    ]),
  },
  {
    code: "M5",
    planned: true,
    approximate: true,
    statusLabel: "koncepcja",
    sourceUrl:
      "https://www.muratorplus.pl/galeria/tu-beda-stacje-5-linii-metra-m5-zobacz-lokalizacje-na-mapie-jaka-bedzie-trasa-v-linii-metra-warszawskiego/gg-9pz1-gF6n-8jph/gp-Q7Z3-F4Uv-7py6",
    stations: stations([
      ["Szamoty", 52.2022, 20.8738],
      ["Ursus", 52.1959, 20.8858],
      ["Plac Tysiąclecia", 52.1923, 20.8944],
      ["Skorosze", 52.1886, 20.9058],
      ["Wiktoryn", 52.1964, 20.9298],
      ["Aleje Jerozolimskie", 52.2056, 20.9425],
      ["Śmigłowca", 52.2098, 20.9492],
      ["Dworzec Zachodni", 52.2184, 20.967],
      ["Plac Narutowicza", 52.219, 20.985],
      ["Filtry", 52.2201, 21.005],
      ["Plac Konstytucji", 52.2219, 21.0168],
      ["Piękna", 52.2239, 21.0241],
      ["Solec", 52.225, 21.0346],
      ["Saska Kępa", 52.2284, 21.0625],
      ["Kanał Gocławski", 52.2325, 21.0739],
      ["Przyczółek Grochowski", 52.2355, 21.0804],
      ["Ostrobramska", 52.234885, 21.097483],
      ["Witolin", 52.2331, 21.1132],
      ["Marsa", 52.2345, 21.1243],
      ["Gocławek", 52.2385, 21.1316],
    ]),
  },
];
