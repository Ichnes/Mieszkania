// Portal IDs verified against district search pages and location catalogs (2026-09-09).
export const nieruchomosciOnlineWarsawDistrictIds: Record<string, string> = {
  Bemowo: "77",
  Białołęka: "78",
  Bielany: "79",
  Mokotów: "80",
  Ochota: "81",
  "Praga-Północ": "12312",
  "Praga-Południe": "23578",
  Rembertów: "84",
  Śródmieście: "85",
  Targówek: "86",
  Ursus: "87",
  Ursynów: "88",
  Wawer: "23579",
  Wesoła: "90",
  Wilanów: "91",
  Włochy: "92",
  Wola: "93",
  Żoliborz: "94",
};

export const adresowoWarsawDistrictIds: Record<string, string> = {
  Bemowo: "430508",
  Białołęka: "430516",
  Bielany: "445655",
  Mokotów: "430510",
  Ochota: "445659",
  "Praga-Północ": "445658",
  "Praga-Południe": "445657",
  Śródmieście: "445650",
  Rembertów: "445653",
  Targówek: "445649",
  Ursus: "430509",
  Wawer: "445656",
  Ursynów: "430507",
  Wilanów: "445651",
  Wola: "430517",
  Włochy: "445654",
  Żoliborz: "430521",
};

export const olxWarsawDistrictIds: Record<string, string> = {
  Bemowo: "367",
  Białołęka: "365",
  Bielany: "369",
  Mokotów: "353",
  Ochota: "355",
  "Praga-Południe": "381",
  "Praga-Północ": "379",
  Rembertów: "361",
  Śródmieście: "351",
  Targówek: "377",
  Ursus: "371",
  Ursynów: "373",
  Wawer: "383",
  Wesoła: "533",
  Wilanów: "375",
  Włochy: "357",
  Wola: "359",
  Żoliborz: "363",
};

export const gratkaMorizonWarsawDistrictIds: Record<string, string> = {
  Bemowo: "116483",
  Białołęka: "119101",
  Bielany: "119857",
  Mokotów: "115279",
  Ochota: "119869",
  "Praga-Południe": "115289",
  "Praga-Północ": "124565",
  Rembertów: "116511",
  Śródmieście: "118401",
  Targówek: "118403",
  Ursus: "115299",
  Ursynów: "117923",
  Wawer: "121215",
  Wesoła: "122397",
  Wilanów: "118407",
  Włochy: "119131",
  Wola: "119133",
  Żoliborz: "122469",
};

export function splitLocationGroups(districts: string[] = [], size = 3): string[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error("Invalid location group size");
  const unique = [...new Set(districts)];
  if (!unique.length) return [[]];
  return Array.from({ length: Math.ceil(unique.length / size) }, (_, index) =>
    unique.slice(index * size, index * size + size),
  );
}
