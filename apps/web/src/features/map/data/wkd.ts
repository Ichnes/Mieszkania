import type { MapCoordinate } from "../types";

// OpenStreetMap contributors (ODbL), retrieved 2026-09-10.
// Station order: https://wkd.com.pl/linia/reguly
export const wkdStations: Array<MapCoordinate & { osmNode: number }> = [
  {
    name: "Warszawa Śródmieście WKD",
    latitude: 52.2274779,
    longitude: 20.9993834,
    osmNode: 1718180086,
  },
  {
    name: "Warszawa Ochota WKD",
    latitude: 52.2254065,
    longitude: 20.9895212,
    osmNode: 3472100889,
  },
  {
    name: "Warszawa Zachodnia WKD",
    latitude: 52.2194559,
    longitude: 20.9655716,
    osmNode: 3472102372,
  },
  {
    name: "Warszawa Reduta Ordona",
    latitude: 52.2143854,
    longitude: 20.9478636,
    osmNode: 3390925140,
  },
  {
    name: "Warszawa Aleje Jerozolimskie",
    latitude: 52.2060562,
    longitude: 20.9408396,
    osmNode: 3241851873,
  },
  {
    name: "Warszawa Raków",
    latitude: 52.1944814,
    longitude: 20.9358485,
    osmNode: 3472122024,
  },
  {
    name: "Warszawa Salomea",
    latitude: 52.1864599,
    longitude: 20.9243847,
    osmNode: 3472126593,
  },
  {
    name: "Opacz",
    latitude: 52.1813883,
    longitude: 20.9046686,
    osmNode: 1573084505,
  },
  {
    name: "Michałowice",
    latitude: 52.175364,
    longitude: 20.88126,
    osmNode: 3472133199,
  },
  {
    name: "Reguły",
    latitude: 52.1703525,
    longitude: 20.8586538,
    osmNode: 1573144247,
  },
  {
    name: "Malichy",
    latitude: 52.1693938,
    longitude: 20.8411745,
    osmNode: 1718180081,
  },
  {
    name: "Tworki",
    latitude: 52.1689418,
    longitude: 20.8232513,
    osmNode: 3472158975,
  },
  {
    name: "Pruszków WKD",
    latitude: 52.1616122,
    longitude: 20.8165804,
    osmNode: 3472183839,
  },
  {
    name: "Komorów",
    latitude: 52.1481148,
    longitude: 20.8113718,
    osmNode: 3472193515,
  },
  {
    name: "Nowa Wieś Warszawska",
    latitude: 52.1404882,
    longitude: 20.7955766,
    osmNode: 1582819837,
  },
  {
    name: "Kanie Helenowskie",
    latitude: 52.1316542,
    longitude: 20.7743104,
    osmNode: 1582819822,
  },
  {
    name: "Otrębusy",
    latitude: 52.1263663,
    longitude: 20.7615282,
    osmNode: 1860122552,
  },
  {
    name: "Podkowa Leśna Wschodnia",
    latitude: 52.1237805,
    longitude: 20.7384237,
    osmNode: 1582819841,
  },
  {
    name: "Podkowa Leśna Główna",
    latitude: 52.1223685,
    longitude: 20.7251423,
    osmNode: 3472773035,
  },
  {
    name: "Podkowa Leśna Zachodnia",
    latitude: 52.1209282,
    longitude: 20.7123229,
    osmNode: 1582819846,
  },
  {
    name: "Kazimierówka",
    latitude: 52.1108786,
    longitude: 20.6980025,
    osmNode: 320994355,
  },
  {
    name: "Brzózki",
    latitude: 52.1050312,
    longitude: 20.6782971,
    osmNode: 3737196526,
  },
  {
    name: "Grodzisk Mazowiecki Okrężna",
    latitude: 52.1007055,
    longitude: 20.6595599,
    osmNode: 3737196525,
  },
  {
    name: "Grodzisk Mazowiecki Piaskowa",
    latitude: 52.1027598,
    longitude: 20.65107,
    osmNode: 3737196527,
  },
  {
    name: "Grodzisk Mazowiecki Jordanowice",
    latitude: 52.103324,
    longitude: 20.6367844,
    osmNode: 3737196528,
  },
  {
    name: "Grodzisk Mazowiecki Radońska",
    latitude: 52.1006418,
    longitude: 20.6284506,
    osmNode: 371098784,
  },
  {
    name: "Polesie",
    latitude: 52.1218524,
    longitude: 20.6972075,
    osmNode: 653450366,
  },
  {
    name: "Milanówek Grudów",
    latitude: 52.122236,
    longitude: 20.682483,
    osmNode: 340662725,
  },
];

export const wkdLines = [
  { name: "WKD", stations: wkdStations.slice(0, 26) },
  { name: "WKD – Milanówek", stations: [wkdStations[19]!, ...wkdStations.slice(26)] },
];
