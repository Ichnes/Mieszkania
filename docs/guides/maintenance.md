# Utrzymanie lokalnych danych

Zacznij od `storage/logs/import-failures.ndjson`, gdy import się nie udał. Log zawiera
źródło, ID, link, błąd, liczbę prób i kontekst. Zdjęcia i surowe odpowiedzi są w `storage/`.

| Polecenie                    | Działanie                                                   |
| ---------------------------- | ----------------------------------------------------------- |
| `npm run storage:report`     | Raport archiwum i zdjęć                                     |
| `npm run storage:db-report`  | Rozmiary tabel i payloadów                                  |
| `npm run storage:migrate`    | Plan migracji archiwum do gzip                              |
| `npm run media:deduplicate`  | Plan deduplikacji identycznych plików zdjęć                 |
| `npm run storage:db-compact` | Plan usunięcia redundantnego HTML po potwierdzeniu archiwum |
| `npm run storage:db-reclaim` | Plan odzyskania miejsca w PostgreSQL                        |
| `npm run ids:repair-otodom`  | Audyt ID ofert i kolejki Otodom                             |

Narzędzia opisane jako plan domyślnie nie zmieniają danych. Dodanie `-- --apply` uruchamia
zapis. `VACUUM FULL` wymaga przerwy w pracy bazy. Nie czyść `storage/` bez kopii danych.

## ID Otodom

Przy konfliktach uruchom najpierw `npm run ids:repair-otodom -- --merge-same-offer` i
przejrzyj plan. Wykonanie wymaga również `--apply`. Skrypt tworzy lokalny backup, działa
w transakcji i zachowuje historię oraz obrazy. Konflikt danych użytkownika przerywa zapis.
Wstrzymaj automatyzację przed naprawą i przywróć jej poprzedni stan po zakończeniu.

## Narzędzia historyczne

Pozostałe skrypty są w `apps/api/src/scripts/maintenance`, `database` i `storage`.
Służą do konkretnych napraw; nie uruchamiają się automatycznie podczas `npm run dev`.
Przed użyciem przeczytaj kod i zapisz lokalną kopię bazy.

## Niespójna cena za m²

`npm run prices:recalculate` pokazuje plan przeliczenia `listings.price_per_sqm` z
`price_amount / area_sqm`. `npm run prices:recalculate -- --apply` zapisuje wyłącznie
ten wynik, w transakcji, po utworzeniu backupu NDJSON w `storage/maintenance`.
Nie zmienia ceny, metrażu, dat ani historii. Cena po rozmowie jest nakładana przy odczycie,
więc nie jest zapisywana tym narzędziem do kolumny portalowej.

## Błędy wyszukiwarki Otodom

Wpisy `phase: discovery` wskazują konkretną stronę, pełny URL, status HTTP,
wariant adresu oraz `runId`. `maxPages` określa limit uruchomienia, np. 600 stron.
`responseStorageKey` prowadzi do pełnej odpowiedzi HTML zapisanej w gzipie pod
`storage/logs/otodom-responses/`. Zapisywane są również checksum, rozmiar odpowiedzi,
URL po przekierowaniu i wybrane nagłówki diagnostyczne (bez cookies).

Wpis `phase: discovery-run` podaje stronę przerwania oraz liczbę wcześniej
odczytanych stron, wykrytych ofert i pozycji dodanych do kolejki. Strony są pobierane
kolejno i zapisywane do kolejki osobno. Błąd dalszej strony nie odrzuca wcześniejszych
wyników paczki. Nie należy interpretować HTTP 405 jako pustego wyniku wyszukiwania.

Nagłówek `x-amzn-waf-action: captcha` potwierdza żądanie CAPTCHA przez zabezpieczenie
Otodomu. Aplikacja pokazuje wtedy komunikat „Otodom wymaga CAPTCHA” z numerem strony,
zapisuje odpowiedź i zatrzymuje skan bez próbowania kolejnego wariantu URL.
Wcześniejsze wyniki pozostają zachowane. Sam status 405 bez tego nagłówka nie wystarcza
do takiej diagnozy. Ponowienie skanu nie gwarantuje ustąpienia blokady portalu.

Na stronie **Aktualizacja** pojawia się przycisk **Wznów Otodom od strony …**. Zapis w bazie
przetrwa odświeżenie i restart aplikacji. Obejmuje pierwszą niepobraną stronę oraz
koniec pierwotnego zakresu: przerwanie na stronie 53 przy limicie 600 oznacza
wznowienie stron 53–600, bez ponownego skanowania pozostałych portali.
Postęp jest zapisywany po zakolejkowaniu każdej strony. Ukończenie usuwa zapis;
kolejny błąd pozostawia nowe miejsce przerwania. Zmienione filtry mają osobny zapis.
Można nadal użyć sprawdzania od początku — zastępuje ono postęp dla tych samych
filtrów. Warto robić to okresowo, ponieważ kolejność ofert na portalu się zmienia.
Przycisk wznowienia nie uruchamia automatycznych ponowień ani nie usuwa CAPTCHA.
