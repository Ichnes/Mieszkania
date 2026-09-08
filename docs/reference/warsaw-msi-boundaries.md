# Granice obszarów MSI w statystykach

Mapa korzysta z rzeczywistych geometrii 143 obszarów MSI w 18 dzielnicach, zamiast orientacyjnych podpisów rozstawionych wokół środka dzielnicy.

## Źródło i licencja

- Dane: OpenStreetMap, © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). Nie są przedstawiane jako urzędowy zbiór granic.
- Podział MSI opisuje [ZDM Warszawa](https://zdm.waw.pl/miejski-system-informacji/obszary-msi/). Dostępny miejski WFS `https://wms2.um.warszawa.pl/geoserver/wfs/wfs` nie wymienia tej warstwy; starszy WFS był niedostępny podczas sprawdzania.
- Snapshot OSM: 2026-09-06 22:33 UTC; pobranie: 7 września czasu polskiego. Plik: `apps/web/public/data/warsaw-msi.geojson`, ok. 410 kB, pobierany tylko przy otwarciu statystyk, poza pakietem JS.
- Geometria jest zachowana bez upraszczania, z otworami i częściami MultiPolygon. Układ współrzędnych WGS84, długość/szerokość geograficzna.

## Odtwarzanie danych

Zapytanie Overpass:

```overpass
[out:json][timeout:20];
relation["boundary"="administrative"]["admin_level"="10"]
  ["name:prefix"="obszar Miejskiego Systemu Informacji"]
  (52.0,20.7,52.5,21.4)->.msi;
.msi out body;
way(r.msi);out geom;
```

Dodatkowo Dąbrówka: relacja `11896729`, pobrana z `https://api.openstreetmap.org/api/0.6/relation/11896729/full.json` (ma informację o MSI w `note`, ale nie ma `name:prefix`). Złożyć węzły w drogi, drogi w zamknięte pierścienie przez `buildDistrictGeometry`. Przypisać dzielnicę po pełnej nazwie MSI. Wola Grzybowska → Wesoła; Ursynów Centrum i teren rezerwatu Las Kabacki → Ursynów. Skrypt wykorzystany do jednorazowej konwersji był lokalnym narzędziem, nie należy do repo. Przeniesienie odtwarzania danych do utrzymywanego polecenia jest w TODO.

Niektóre nazwy ogłoszeń oznaczają osiedla lub grupy obszarów, nie MSI. Nie dopasowywać ich do wielokątów przez podobieństwo ani nie dorabiać granic. Mapa pokazuje podział MSI, tabela zachowuje nazwy i statystyki ofert. Kolory odróżniają obszary — nie są skalą cen ani liczby ofert.

## Weryfikacja

Testy `msi-geometry.test.ts`: komplet dzielnic, unikalne identyfikatory, domknięcie pierścieni, współrzędne w Warszawie, skończone ścieżki i pozycje etykiet, zachowanie otworów, Wola Grzybowska w Wesołej. Test API `warsaw-neighborhoods.test.ts` sprawdza również pełne ciągi lokalizacji.

Historyczna kontrola UI (lokalne artefakty poza repo): oba motywy, 1440/1280/390 px, wybór mapą/listą/klawiaturą, bez poziomego przepełnienia.
