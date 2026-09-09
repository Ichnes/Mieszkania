# Dane metra na mapie

Sprawdzenie źródeł: 10 września 2026. Współrzędne są częścią repozytorium:
[planned-metro.ts](../../apps/web/src/features/map/data/planned-metro.ts).
Każda instalacja otrzymuje je z kodem frontendu. Python, PDF-y i internetowe
geokodowanie służyły wyłącznie do przygotowania danych; nie są wymagane przy
uruchamianiu aplikacji. Dane M1 i M3 pozostawiono bez zmian.

## M2

[Metro Warszawskie: odcinek zachodni](https://metro.waw.pl/metro-warszawskie/linia-m2/odcinek-3stp/)
potwierdza lokalizacje trzech budowanych stacji. Współrzędne środków stacji
pochodzą z nazwanych obiektów OpenStreetMap, oznaczonych jako budowane metro:

| Stacja   | Szerokość  | Długość    | Obiekt OSM                                                    |
| -------- | ---------- | ---------- | ------------------------------------------------------------- |
| Lazurowa | 52.2385408 | 20.8982835 | [12496159242](https://www.openstreetmap.org/node/12496159242) |
| Chrzanów | 52.2279949 | 20.8896758 | [12496159239](https://www.openstreetmap.org/node/12496159239) |
| Karolin  | 52.2170358 | 20.8862184 | [12496159238](https://www.openstreetmap.org/node/12496159238) |

[Odcinek do Ursusa](https://metro.waw.pl/metro-warszawskie/linia-m2/odcinek-3-na-ursus/):
plansze C51, C52 i C53 opublikowane przez Metro Warszawskie w kwietniu 2026.
Punkty odniesienia: Posag 7 Panien przy kolei (Ursus Północny), Posag 7 Panien
przy Gierdziejewskiego oraz Orląt Lwowskich przy Keniga. Te trzy lokalizacje
przeniesiono orientacyjnie na geometrię ulic OSM; nie są zatwierdzonymi wejściami.

## M4

[Oficjalne plany lokalizacji 23 stacji](https://metro.waw.pl/metro-warszawskie/linia-m4/m4-przebieg-i-lokalizacja-stacji/)
oraz [dokumentacja przedprojektowa, grudzień 2025](https://metro.waw.pl/wp-content/uploads/2025/12/M4_Prace_Przedprojektowe_prezentacja.pdf).
Wykorzystano geograficzne plansze G01–G23 i wskazane na nich ulice, nie schemat
przesiadek. Lokalizacje odniesiono do geometrii ulic i kolei OSM: skrzyżowań,
rzutów na osie ulic oraz orientacyjnego położenia korpusów stacji na planszach.
W szczególności poprawiono Myśliborską, Płochocińską, Rydygiera, Bitwy Warszawskiej,
Żwirki i Wigury, Służewiec i południowy odcinek przy alei Wilanowskiej.

To przybliżone centra, zaokrąglone do czterech miejsc dziesiętnych, a nie
oficjalny zbiór współrzędnych geodezyjnych. Liczba cyfr nie określa dokładności
lokalizacji. Metro Warszawskie zastrzega możliwość korekt na dalszym etapie prac.

## M5

[Miejskie plansze prasowe udostępnione w galerii Muratora](https://www.muratorplus.pl/galeria/tu-beda-stacje-5-linii-metra-m5-zobacz-lokalizacje-na-mapie-jaka-bedzie-trasa-v-linii-metra-warszawskiego/gg-9pz1-gF6n-8jph/gp-Q7Z3-F4Uv-7py6)
przedstawiają 20 lokalizacji, od Szamot do Gocławka. Zastąpiono wcześniejsze
11 punktów opisujących przypadkowe środki ulic i osiedli. Do geograficznego
osadzenia plansz wykorzystano skrzyżowania i stacje kolejowe OSM. M.in. Skorosze
odpowiadają skrzyżowaniu Ryżowej/Prystora, Filtry — Nowowiejskiej/Niepodległości,
Piękna — Ujazdowskich/Pięknej, Solec — Górnośląskiej/Rozbrat, Marsa — okolicy
Lotniczej. Stacja Ostrobramska zachowuje wspólne położenie z istniejącymi danymi M3.

M5 jest koncepcją. Punkty są orientacyjne, a połączenia między nimi schematyczne.
Nie przedstawiają wyznaczonej osi tuneli ani położenia wejść. Informacja o tym
oraz link do źródła są widoczne w dymkach mapy głównej i mapy oferty.

## Aktualizacja i źródła geograficzne

Geometria odniesienia: [OpenStreetMap](https://www.openstreetmap.org/copyright),
odczyt przez API mapy i Nominatim. Przy kolejnej aktualizacji należy porównać
nowe dokumenty Metra z położeniem korpusów, a nie geokodować samą nazwę stacji
lub ulicy. Planowanych stacji nie dodano do wspólnej listy czynnego metra
używanej do wyliczania odległości ofert.

Tramwaje pozostają warstwą pobieraną z Overpass: pierwsze pobranie wymaga sieci,
kolejne korzystają z cache na dysku (6 godzin, ostatnie poprawne dane w razie
awarii). Numery linii i geometria pochodzą z OSM, nie z rozkładu WTP w czasie
rzeczywistym. Serwery mogą mieć opóźnienie aktualizacji danych.

## Dane dostępne po instalacji i WKD

M1, czynna M2, planowana M3 oraz nowe odcinki metra są dołączone do kodu aplikacji. Import bazy ofert nie jest potrzebny do ich wyświetlania. WKD zawiera wszystkie 28 stacji i przystanków, z odgałęzieniem do Milanówka, w `apps/web/src/features/map/data/wkd.ts`. Współrzędne i identyfikatory węzłów pochodzą z OpenStreetMap (ODbL, odczyt 2026-09-10); kolejność sprawdzono z [wykazem WKD](https://wkd.com.pl/linia/reguly). Zapasowe połączenia kolejowe są schematycznymi odcinkami między stacjami. Częściowa odpowiedź zewnętrznej warstwy kolejowej nie usuwa stacji WKD.
