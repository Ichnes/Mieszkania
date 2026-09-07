import { warsawMetroStations } from "@mieszkania/shared";
import { MapCoordinate, MetroMapLine } from "../types";

export const metroLineColors = {
  M1: "#ca2839",
  M2: "#f0bd32",
  M3: "#2563b8",
  M4: "#167451",
  M5: "#8545ac",
};

export const warsawDistrictCoordinates: MapCoordinate[] = [
  { name: "Bemowo", latitude: 52.2382, longitude: 20.9134 },
  { name: "Białołęka", latitude: 52.3202, longitude: 21.0106 },
  { name: "Bielany", latitude: 52.2921, longitude: 20.9347 },
  { name: "Mokotów", latitude: 52.1937, longitude: 21.034 },
  { name: "Ochota", latitude: 52.2122, longitude: 20.9727 },
  { name: "Praga-Północ", latitude: 52.2601, longitude: 21.0292 },
  { name: "Praga-Południe", latitude: 52.238, longitude: 21.0838 },
  { name: "Śródmieście", latitude: 52.2319, longitude: 21.0067 },
  { name: "Targówek", latitude: 52.2751, longitude: 21.0587 },
  { name: "Ursus", latitude: 52.1952, longitude: 20.8842 },
  { name: "Ursynów", latitude: 52.141, longitude: 21.0323 },
  { name: "Wawer", latitude: 52.2084, longitude: 21.1604 },
  { name: "Wesoła", latitude: 52.254, longitude: 21.2241 },
  { name: "Wilanów", latitude: 52.1637, longitude: 21.0876 },
  { name: "Włochy", latitude: 52.1862, longitude: 20.9489 },
  { name: "Wola", latitude: 52.2326, longitude: 20.9521 },
  { name: "Żoliborz", latitude: 52.268, longitude: 20.9864 },
];

export const warsawMetroLines: MetroMapLine[] = [
  { code: "M1", stations: warsawMetroStations.slice(0, 21) },
  {
    code: "M2",
    stations: [
      ...warsawMetroStations.slice(21, 28),
      { name: "Świętokrzyska", latitude: 52.235, longitude: 21.0089 },
      ...warsawMetroStations.slice(28),
    ],
  },
  {
    code: "M3",
    planned: true,
    stations: [
      { name: "Stadion Narodowy", latitude: 52.2466, longitude: 21.0436 },
      { name: "Dworzec Wschodni", latitude: 52.2525501, longitude: 21.05125 },
      { name: "Mińska", latitude: 52.251368, longitude: 21.074192 },
      { name: "Rondo Wiatraczna", latitude: 52.2451407, longitude: 21.0857703 },
      { name: "Ostrobramska", latitude: 52.234885, longitude: 21.097483 },
      { name: "Jana Nowaka-Jeziorańskiego", latitude: 52.231057, longitude: 21.09558 },
      { name: "Gocław", latitude: 52.224858, longitude: 21.092423 },
    ],
  },
  {
    code: "M4",
    planned: true,
    stations: [
      { name: "Myśliborska", latitude: 52.3132324, longitude: 20.9643612 },
      { name: "Obrazkowa", latitude: 52.3130295, longitude: 20.967339 },
      { name: "Płochocińska", latitude: 52.3135506, longitude: 21.0018842 },
      { name: "Ruda", latitude: 52.2835019, longitude: 20.9767459 },
      { name: "Marymont", latitude: 52.2715768, longitude: 20.9719399 },
      { name: "Rydygiera", latitude: 52.2582766, longitude: 20.9704965 },
      { name: "Rondo Radosława", latitude: 52.2548555, longitude: 20.9832393 },
      { name: "Cmentarz Żydowski", latitude: 52.2478236, longitude: 20.9744027 },
      { name: "Okopowa", latitude: 52.239102, longitude: 20.9796764 },
      { name: "Rondo Daszyńskiego", latitude: 52.2300827, longitude: 20.9828946 },
      { name: "Plac Zawiszy", latitude: 52.2247888, longitude: 20.9886965 },
      { name: "Plac Narutowicza", latitude: 52.2190384, longitude: 20.985049 },
      { name: "Bitwy Warszawskiej 1920", latitude: 52.2160552, longitude: 20.9623309 },
      { name: "Wiślicka", latitude: 52.2035987, longitude: 20.9775282 },
      { name: "Żwirki i Wigury", latitude: 52.2155423, longitude: 20.9882034 },
      { name: "Służewiec", latitude: 52.1805647, longitude: 20.9937829 },
      { name: "Rondo Unii Europejskiej", latitude: 52.1781621, longitude: 21.001861 },
      { name: "Smoluchowskiego", latitude: 52.1791432, longitude: 21.0111472 },
      { name: "Wilanowska", latitude: 52.1818168, longitude: 21.0231452 },
      { name: "Dolina Służewiecka", latitude: 52.167642, longitude: 21.0357124 },
      { name: "Patkowskiego", latitude: 52.1726949, longitude: 21.0545545 },
      { name: "Sobieskiego", latitude: 52.1767, longitude: 21.0605 },
      { name: "Wilanów", latitude: 52.1661431, longitude: 21.0902262 },
    ],
  },
  {
    code: "M2",
    planned: true,
    stations: [
      { name: "Bemowo", latitude: 52.2372, longitude: 20.9131 },
      { name: "Lazurowa", latitude: 52.2270021, longitude: 20.8967806 },
      { name: "Chrzanów", latitude: 52.2166113, longitude: 20.8955248 },
      { name: "Karolin", latitude: 52.212901, longitude: 20.8862282 },
    ],
  },
  {
    code: "M2",
    planned: true,
    stations: [
      { name: "Karolin (kierunek Ursus)", latitude: 52.212901, longitude: 20.8862282 },
      { name: "Ursus Północny", latitude: 52.2057501, longitude: 20.889622 },
      { name: "Posag 7 Panien", latitude: 52.2062959, longitude: 20.8863659 },
      { name: "Ursus-Niedźwiadek", latitude: 52.1951289, longitude: 20.8698961 },
    ],
  },
  {
    code: "M5",
    planned: true,
    stations: [
      { name: "Ursus-Niedźwiadek (korytarz)", latitude: 52.1951289, longitude: 20.8698961 },
      { name: "Szamoty (korytarz)", latitude: 52.2020867, longitude: 20.8868026 },
      { name: "Skorosze (korytarz)", latitude: 52.192016, longitude: 20.899866 },
      { name: "Wiktoryn (korytarz)", latitude: 52.1964511, longitude: 20.9349821 },
      { name: "Aleje Jerozolimskie (korytarz)", latitude: 52.1879322, longitude: 20.9121723 },
      { name: "Śmigłowca (korytarz)", latitude: 52.209226, longitude: 20.9494832 },
      { name: "Plac Narutowicza (korytarz)", latitude: 52.2190384, longitude: 20.985049 },
      { name: "Plac Konstytucji (korytarz)", latitude: 52.2216901, longitude: 21.0164613 },
      { name: "Saska Kępa (korytarz)", latitude: 52.2329941, longitude: 21.0571754 },
      { name: "Ostrobramska (korytarz)", latitude: 52.2332018, longitude: 21.1125727 },
      { name: "Gocławek (korytarz)", latitude: 52.2383574, longitude: 21.1265486 },
    ],
  },
];

export const warsawRailLines: Array<{ name: string; stations: MapCoordinate[] }> = [
  {
    name: "PKP – linia średnicowa",
    stations: [
      { name: "Warszawa Zachodnia", latitude: 52.2206, longitude: 20.967 },
      { name: "Warszawa Ochota", latitude: 52.2207, longitude: 20.9822 },
      { name: "Warszawa Centralna", latitude: 52.2283, longitude: 21.0037 },
      { name: "Warszawa Śródmieście", latitude: 52.2282, longitude: 21.0067 },
      { name: "Warszawa Powiśle", latitude: 52.2354, longitude: 21.0265 },
      { name: "Warszawa Stadion", latitude: 52.247, longitude: 21.0475 },
      { name: "Warszawa Wschodnia", latitude: 52.2526, longitude: 21.0513 },
    ],
  },
  {
    name: "PKP/SKM – linia obwodowa",
    stations: [
      { name: "Warszawa Gdańska", latitude: 52.2575, longitude: 20.9945 },
      { name: "Warszawa Koło", latitude: 52.2398, longitude: 20.9455 },
      { name: "Warszawa Wola", latitude: 52.232, longitude: 20.9653 },
      { name: "Warszawa Zachodnia", latitude: 52.2206, longitude: 20.967 },
      { name: "Warszawa Rakowiec", latitude: 52.2018, longitude: 20.9731 },
      { name: "Warszawa Żwirki i Wigury", latitude: 52.19, longitude: 20.982 },
      { name: "Warszawa Służewiec", latitude: 52.1749, longitude: 20.997 },
    ],
  },
  {
    name: "WKD",
    stations: [
      { name: "Warszawa Śródmieście WKD", latitude: 52.2263, longitude: 21.0018 },
      { name: "Warszawa Ochota WKD", latitude: 52.2205, longitude: 20.9812 },
      { name: "Warszawa Reduta Ordona WKD", latitude: 52.213, longitude: 20.9612 },
      { name: "Warszawa Aleje Jerozolimskie WKD", latitude: 52.205, longitude: 20.946 },
      { name: "Warszawa Raków WKD", latitude: 52.1988, longitude: 20.932 },
      { name: "Warszawa Salomea WKD", latitude: 52.1913, longitude: 20.9143 },
      { name: "Opacz WKD", latitude: 52.1827, longitude: 20.893 },
      { name: "Michałowice WKD", latitude: 52.1687, longitude: 20.8822 },
    ],
  },
];
