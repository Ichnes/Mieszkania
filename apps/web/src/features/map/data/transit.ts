import { wkdLines } from "./wkd";
import { plannedMetroLines } from "./planned-metro";
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
  ...plannedMetroLines,
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
  ...wkdLines,
];
