# Próbki regresji parserów

Minimalne fragmenty rzeczywistego archiwum HTML, odczytane 2026-09-08. Usunięto dane kontaktowe, identyfikatory użytkowników, opisy, adresy i zbędną część strony. Struktura elementów i wartości sprawdzanych parametrów pozostały takie jak w archiwum.

- `gratka-floor.html`: Gratka 48216311, nagłówek `basic-info__details`, piętro 3/7.
- `gratka-ground-floor.html`: Gratka 48607555, nagłówek z „parter/5” bez słowa „piętro”.
- `gratka-highlighted-floor.html`: Gratka 46264133, wyróżnione parametry `detailsHighlightedParametersLabel/Value`, wartość „parter z 4”.
- `gratka-floor-table.html`: Gratka 48849309, `informationTableLabel`/`itemValue`, piętro 4/6; rzeczywista deklaracja CSS klasy rekomendacji umieszczona przed treścią.
- `domiporta-geo.html`: Domiporta 156412478, mikroformat GeoCoordinates z przecinkami dziesiętnymi.
- `nieruchomosci-online-geo.html`: Nieruchomości-online 26749397, `mapInitData`; portal oznacza lokalizację jako przybliżoną. To punkt portalowy, nie potwierdzony punkt budynku.
- `olx-structured.html`: OLX ID1bx9K1, `ad.ad` w podwójnie kodowanym JSON, osobno cena ofertowa i cena/m², metraż, pokoje i mapa.
- `olx-floor.html`: OLX ID1bziob, `floor_select`, metraż z przecinkiem i kategoria „4 i więcej”. Tytuł i opis zastąpiono tekstem testowym.

Testy w `portal-archive-regression.test.ts` sprawdzają te fragmenty, brak parametrów i odrzucanie niepełnych współrzędnych. Dodatkowe warianty syntetyczne należy odróżniać od zapisanych próbek portalu.
