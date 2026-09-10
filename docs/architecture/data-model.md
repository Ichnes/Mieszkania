# Model danych

Źródłem podstawowego schematu jest [schema.sql](../../apps/api/src/db/schema.sql).
Inicjalizacja pustej bazy odbywa się transakcyjnie w `db/initialize.ts`; istniejące bazy
uzupełnia `db/schema-bootstrap.ts`. Nie wymaga kontenera ani ręcznego uruchamiania SQL.

| Obszar                      | Główne tabele                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| Oferty                      | `sources`, `listings`, `listing_snapshots`, `price_events`                               |
| Pobieranie                  | `listing_import_queue`, `crawl_artifacts`                                                |
| Zdjęcia                     | `listing_images`, `listing_media_assets`                                                 |
| Ustawienia i praca z ofertą | `app_settings`, `listing_manual_overrides`, `listing_viewings`, `listing_contact_events` |
| Duplikaty                   | `listing_duplicate_group_members`, `listing_duplicate_reviews`                           |
| Transakcje                  | `transaction_rcn`                                                                        |
| Alerty                      | `alert_rules`, `alert_events`                                                            |
| Otoczenie                   | tabele kontekstu działki, planowania i sąsiedztwa                                        |

Identyfikator `listings.id` jest lokalnym UUID. Para źródło + `external_id` identyfikuje
ogłoszenie na portalu. Dla Otodom ID pochodzi wyłącznie z końcowego `-ID…` w ścieżce URL.
Podobne tytuły nie są identyfikatorem. Historyczne snapshoty i pliki archiwum nie są
nadpisywane podczas naprawy bieżących identyfikatorów.

Stare dane ocen mogą pozostać w `listing_scores`, mimo że funkcja została wycofana.
Nie czyścimy danych użytkownika przy starcie. Narzędzia resetu są jawne i oddzielone
od zwykłego uruchomienia.

## Cena portalowa i cena po rozmowie

`listings.source_price_amount` zachowuje cenę konkretnego portalu. `listings.price_amount`
jest ceną ogłoszeniową używaną w aplikacji: w grupie duplikatów jest to wspólne minimum
aktywnych, nieodrzuconych źródeł (przy braku aktywnych — minimum zapisanych źródeł).
Snapshoty zachowują ceny źródłowe. `price_events` zapisują zmiany ceny używanej w aplikacji;
`source_label` i `source_url` wskazują portal ustalający nową cenę grupy, a `changed_at`
oznacza moment wykrycia. Migracja inicjalizuje ceny źródłowe tylko raz. Przeliczenia grup
odbywają się w transakcji, pod wspólną blokadą doradczą z kolektorem.

`listing_manual_overrides.asking_price_override`
przechowuje aktualną cenę po rozmowie; dodatnia kwota ma pierwszeństwo w osobistych obliczeniach
i filtrach. `negotiated_price_amount` pozostaje celem negocjacji, zgodnie z dotychczasową logiką alertów.
API zwraca `priceSource` i `advertisedPriceLabel`, aby UI nie mieszał źródeł.
Cena za m² jest wyliczana z aktualnej ceny i powierzchni. Naprawa historycznie niespójnej
kolumny pochodnej ma osobny skrypt; nie zmienia kwot bazowych ani historii portalu.
