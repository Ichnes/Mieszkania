# Lokalna sieć transportu Warszawy

Tramwaje oraz kolej korzystają z wersjonowanego pliku `packages/shared/src/data/warsaw-transport.json`.
Zestaw pochodzi z OpenStreetMap (© OpenStreetMap contributors, ODbL 1.0):
[licencja](https://www.openstreetmap.org/copyright), [składnia zapytań Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL).
Data zestawu jest zapisana w `updatedAt`. Tramwaje pochodzą z lokalnego eksportu pobranego 9 września 2026;
tory i stacje pobrano 10 września 2026. To zapis sieci, nie rozkład jazdy ani pozycje pojazdów.

Mapa główna i mapa oferty importują ten sam zestaw z pakietu shared. Nie odpytują
endpointów transportu ani Overpass. Zgodne wstecznie endpointy API także zwracają lokalne dane,
bez wygasania i odświeżania w tle. Kafelki mapy nadal pochodzą z internetu.
Kolej jest jedną warstwą rzeczywistych torów, bez osobnych przesunięć dla SKM/KM/PKP/WKD
i bez prostych łączących stacje. Przy dużym powiększeniu widoczne są równoległe tory.

Zakres: Warszawa i okolice, prostokąt 52.00–52.55 N, 20.55–21.50 E (obejmuje WKD do Grodziska i Milanówka).
Zapytanie kolejowe obejmuje tory `railway=rail|light_rail` bez `service`, należące
do relacji tras pasażerskich `train|light_rail`; stacje `station|halt` z wyłączeniem metra.
Nie rozdziela torów według przewoźnika ani numeru linii; pomija trasy wyłącznie towarowe.
Geometria jest przycinana do zakresu; odcinki nie są łączone przez pominięte punkty.
Identyczne przebiegi w obu kierunkach są deduplikowane. Kierunki tramwaju są grupowane według numeru.

## Aktualizacja zestawu przez programistę

Zapisz kompletną odpowiedź Overpass kolei i eksport tramwajów w `.local/`.
Zapytanie kolei:

```text
[out:json][timeout:50];
relation[type=route][route~"^(train|light_rail)$"](52.00,20.55,52.55,21.50)->.routes;
(
  way(r.routes)[railway~"^(rail|light_rail)$"][!service](52.00,20.55,52.55,21.50);
  node[railway~"^(station|halt)$"](52.00,20.55,52.55,21.50);
);
out body geom;
```

Tramwaje muszą zawierać `routes` z geometrią i `stops` (obsługiwany jest także dawny wrapper `data`).
Następnie uruchom w katalogu projektu:

```sh
node scripts/build-transport-snapshot.mjs .local/rail-osm.json .local/tramway.json
npm run build
```

Generator odrzuca błędy i zbyt małe zestawy przed zapisem. Sprawdź przebiegi i stacje na mapie,
zaktualizuj powyższe daty źródeł i dołącz wygenerowany JSON do zmiany kodu.
Aktualizacja aplikacji dostarcza nowy zestaw wszystkim instalacjom.
