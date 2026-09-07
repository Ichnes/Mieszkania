export type SupportedRegion = {
  id: string;
  name: string;
  primaryCity: string;
  supportedCities: string[];
  rcnPowiatKeys: string[];
};

export const warsawMetropolitanRegion: SupportedRegion = {
  id: "warsaw-metropolitan",
  name: "Warszawa i okolica",
  primaryCity: "Warszawa",
  supportedCities: [
    "Warszawa",
    "Piaseczno",
    "Pruszkow",
    "Wolomin",
    "Legionowo",
    "Nowy Dwor Mazowiecki",
    "Otwock",
    "Minsk Mazowiecki",
    "Grodzisk Mazowiecki",
    "Blonie"
  ],
  rcnPowiatKeys: [
    "m-st-warszawa",
    "powiat-piaseczynski",
    "powiat-pruszkowski",
    "powiat-wolominski",
    "powiat-legionowski",
    "powiat-nowodworski",
    "powiat-warszawski-zachodni",
    "powiat-grodziski",
    "powiat-minski",
    "powiat-otwocki"
  ]
};
