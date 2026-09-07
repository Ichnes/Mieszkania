import { normalizePolish, normalizeStreetName } from "./address-normalization";

type WarsawNeighborhood = {
  name: string;
  district: string;
  aliases?: string[];
};

// Warsaw MSI areas plus a few established portal labels. Keeping this list
// explicit is intentional: an unknown label is safer to omit than to present a
// street name as a neighborhood.
const warsawNeighborhoods: WarsawNeighborhood[] = [
  ...inDistrict("Bemowo", [
    "Lotnisko",
    "Bemowo-Lotnisko",
    "Boernerowo",
    "Chrzanów",
    "Fort Bema",
    "Fort Radiowo",
    "Górce",
    "Groty",
    "Jelonki",
    "Jelonki Północne",
    "Jelonki Południowe",
  ]),
  ...inDistrict("Białołęka", [
    "Białołęka Dworska",
    "Brzeziny",
    "Choszczówka",
    "Dąbrówka Szlachecka",
    "Grodzisk",
    "Henryków",
    "Kobiałka",
    "Marcelin",
    "Nowodwory",
    "Płudy",
    "Szamocin",
    "Tarchomin",
    "Wiśniewo",
    "Żerań",
  ]),
  ...inDistrict("Bielany", [
    "Chomiczówka",
    "Huta",
    "Las Bielański",
    "Marymont-Kaskada",
    "Marymont-Ruda",
    "Młociny",
    "Piaski",
    "Placówka",
    "Radiowo",
    "Stare Bielany",
    "Słodowiec",
    "Wawrzyszew",
    "Wólka Węglowa",
    "Wrzeciono",
  ]),
  ...inDistrict("Mokotów", [
    "Augustówka",
    "Czerniaków",
    "Ksawerów",
    "Sadyba",
    "Siekierki",
    "Sielce",
    "Służew",
    "Służewiec",
    "Stary Mokotów",
    "Stegny",
    "Wierzbno",
    "Wyględów",
  ]),
  ...inDistrict("Ochota", ["Filtry", "Rakowiec", "Stara Ochota", "Szczęśliwice"]),
  ...inDistrict("Praga-Południe", [
    "Gocław",
    "Gocławek",
    "Grochów",
    "Kamionek",
    "Olszynka Grochowska",
    "Saska Kępa",
  ]),
  ...inDistrict("Praga-Północ", ["Nowa Praga", "Pelcowizna", "Stara Praga", "Szmulowizna"]),
  ...inDistrict("Rembertów", [
    "Kawęczyn-Wygoda",
    "Nowy Rembertów",
    "Pocisk",
    "Polanka",
    "Stary Rembertów",
  ]),
  ...inDistrict("Śródmieście", [
    "Muranów",
    "Nowe Miasto",
    "Powiśle",
    "Solec",
    "Stare Miasto",
    "Śródmieście Południowe",
    "Śródmieście Północne",
    "Ujazdów",
  ]),
  ...inDistrict("Targówek", [
    "Bródno",
    "Bródno-Podgrodzie",
    "Elsnerów",
    "Targówek Fabryczny",
    "Targówek Mieszkaniowy",
    "Utrata",
    "Zacisze",
  ]),
  ...inDistrict("Ursus", ["Czechowice", "Gołąbki", "Niedźwiadek", "Skorosze", "Szamoty"]),
  ...inDistrict("Ursynów", [
    "Dąbrówka",
    "Grabów",
    "Imielin",
    "Jeziorki Południowe",
    "Jeziorki Północne",
    "Kabaty",
    "Natolin",
    "Pyry",
    "Skarpa Powsińska",
    "Stary Imielin",
    "Stary Służew",
    "Stokłosy",
    "Ursynów-Centrum",
    "Ursynów Północny",
    "Wyczółki",
  ]),
  ...inDistrict("Wawer", [
    "Aleksandrów",
    "Anin",
    "Falenica",
    "Las",
    "Marysin Wawerski",
    "Miedzeszyn",
    "Międzylesie",
    "Nadwiśle",
    "Radość",
    "Sadul",
    "Wawer",
    "Zerzeń",
  ]),
  ...inDistrict("Wesoła", [
    "Groszówka",
    "Grzybowa",
    "Plac Wojska Polskiego",
    "Stara Miłosna",
    "Wesoła-Centrum",
    "Wola Grzybowska",
    "Zielona",
    "Zielona-Grzybowa",
  ]),
  ...inDistrict("Wilanów", [
    "Błonia Wilanowskie",
    "Kępa Zawadowska",
    "Miasteczko Wilanów",
    "Powsin",
    "Powsinek",
    "Wilanów Królewski",
    "Wilanów Niski",
    "Wilanów Wysoki",
    "Zawady",
  ]),
  ...inDistrict("Włochy", [
    "Nowe Włochy",
    "Okęcie",
    "Opacz Wielka",
    "Paluch",
    "Raków",
    "Salomea",
    "Stare Włochy",
    "Załuski",
  ]),
  ...inDistrict("Wola", [
    "Czyste",
    "Koło",
    "Młynów",
    "Mirów",
    "Nowolipki",
    "Odolany",
    "Powązki",
    "Ulrychów",
  ]),
  ...inDistrict("Żoliborz", [
    "Marymont-Potok",
    "Sady Żoliborskie",
    "Stary Żoliborz",
    "Żoliborz Artystyczny",
  ]),
  { name: "Gocław", district: "Praga-Południe", aliases: ["Gocławiu"] },
  { name: "Grochów", district: "Praga-Południe", aliases: ["Grochowie"] },
  { name: "Kamionek", district: "Praga-Południe", aliases: ["Kamionku"] },
  { name: "Saska Kępa", district: "Praga-Południe", aliases: ["Saskiej Kępie"] },
  { name: "Młociny", district: "Bielany", aliases: ["Młocinach"] },
  { name: "Powiśle", district: "Śródmieście", aliases: ["Powiślu"] },
  { name: "Muranów", district: "Śródmieście", aliases: ["Muranowie"] },
  { name: "Służewiec", district: "Mokotów", aliases: ["Służewcu"] },
  { name: "Siekierki", district: "Mokotów", aliases: ["Siekierkach"] },
  { name: "Stara Miłosna", district: "Wesoła", aliases: ["Starej Miłośnie"] },
  { name: "Miasteczko Wilanów", district: "Wilanów", aliases: ["Miasteczku Wilanów"] },
];

const byExactLabel = new Map<string, WarsawNeighborhood>();
for (const neighborhood of warsawNeighborhoods) {
  for (const label of [neighborhood.name, ...(neighborhood.aliases ?? [])]) {
    byExactLabel.set(normalizeLocation(label), neighborhood);
  }
}

const warsawDistrictNames = [
  "Bemowo",
  "Białołęka",
  "Bielany",
  "Mokotów",
  "Ochota",
  "Praga-Północ",
  "Praga-Południe",
  "Rembertów",
  "Śródmieście",
  "Targówek",
  "Ursus",
  "Ursynów",
  "Wawer",
  "Wesoła",
  "Wilanów",
  "Włochy",
  "Wola",
  "Żoliborz",
];

export function canonicalWarsawDistrict(value?: string | null) {
  const normalized = normalizeLocation(value ?? "");
  if (!normalized) return undefined;
  // A complete MSI name takes precedence over a district word inside it:
  // Wola Grzybowska is in Wesoła, not Wola.
  const exactNeighborhood = byExactLabel.get(normalized);
  if (exactNeighborhood) return exactNeighborhood.district;
  const padded = ` ${normalized} `;
  const directDistrict = warsawDistrictNames.find((district) =>
    padded.includes(` ${normalizeLocation(district)} `),
  );
  const neighborhood = [...byExactLabel.entries()]
    .filter(([label]) => padded.includes(` ${label} `))
    .sort(([left], [right]) => right.length - left.length)[0]?.[1];
  return neighborhood?.district ?? directDistrict;
}

export function isCanonicalWarsawDistrict(value?: string | null) {
  const normalized = normalizeLocation(value ?? "");
  return warsawDistrictNames.some((district) => normalizeLocation(district) === normalized);
}

export function canonicalWarsawNeighborhood(value?: string | null, district?: string | null) {
  const match = value ? byExactLabel.get(normalizeLocation(value)) : undefined;
  return match && districtMatches(match.district, district) ? match.name : undefined;
}

export function inferWarsawNeighborhood(text?: string | null, district?: string | null) {
  const normalizedText = ` ${normalizeLocation(text ?? "")} `;
  if (!normalizedText.trim()) return undefined;

  const matches = [...byExactLabel.entries()]
    .filter(
      ([label, neighborhood]) =>
        districtMatches(neighborhood.district, district) && normalizedText.includes(` ${label} `),
    )
    .sort(([left], [right]) => right.length - left.length);
  return matches[0]?.[1].name;
}

export function isWarsawNeighborhoodLabel(value?: string | null, district?: string | null) {
  return Boolean(canonicalWarsawNeighborhood(value, district));
}

export function sameStreetOrLocation(left?: string | null, right?: string | null) {
  const leftNormalized = normalizeStreetName(left);
  const rightNormalized = normalizeStreetName(right);
  if (!leftNormalized || !rightNormalized) return false;
  return (
    leftNormalized === rightNormalized ||
    leftNormalized.endsWith(` ${rightNormalized}`) ||
    rightNormalized.endsWith(` ${leftNormalized}`)
  );
}

function inDistrict(district: string, names: string[]): WarsawNeighborhood[] {
  return names.map((name) => ({ name, district }));
}

function districtMatches(expected: string, actual?: string | null) {
  return (
    !actual ||
    actual === "Bez dzielnicy" ||
    normalizeLocation(expected) === normalizeLocation(actual)
  );
}

function normalizeLocation(value: string) {
  return normalizePolish(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
