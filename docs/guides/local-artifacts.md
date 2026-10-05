# Porządek w `.local`

`.local/` zawiera prywatne materiały robocze, a nie kod wymagany do działania aplikacji.
Jest wykluczony z Git i kontekstu budowania Dockera. Nie należy jednak usuwać całego
katalogu: narzędzia zapisują tu także kopie zapasowe i wyniki oceny zdjęć.

## Przegląd z 5 października 2026

Zinwentaryzowano 21 987 plików, 570,5 MiB. W głównym katalogu leżą 2294 pliki
(225,2 MiB), w tym 669 logów, 849 JSON-ów i 390 skryptów. Rozmiary poniżej są
zaokrąglone; przegląd nie usuwał ani nie przenosił materiałów.

| Materiały                                                                         |   Rozmiar | Zalecenie                                                                                                                                                                             |
| --------------------------------------------------------------------------------- | --------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fresh-start/node_modules/` — 18 161 plików                                       | 165,8 MiB | Usunąć po sprawdzeniu, że stary test nie działa. Zależności można odtworzyć z lockfile.                                                                                               |
| Pozostała część `fresh-start/`                                                    |  17,7 MiB | Stara kopia projektu do testu instalacji z 7 września. Przed usunięciem sprawdzić różnice kodu; zawiera też lokalny `.env` i `storage/`.                                              |
| Logi luzem — 669 plików                                                           |  13,2 MiB | Stare wyniki zakończonych testów/buildów można usunąć. Zachować wyniki bieżącego zadania i nierozwiązanych błędów.                                                                    |
| `review-ui/`, `final-visual/`, `batch-ui/`, `decision-ui/`, `ai-ui/` — 196 plików |  45,2 MiB | Archiwalne materiały kontroli UI; można usunąć po zamknięciu odpowiadających im zadań.                                                                                                |
| Obrazy luzem — 288 PNG i 32 JPG                                                   | 114,8 MiB | Przejrzeć i rozdzielić: zrzuty UI są odtwarzalne, ale są tu też mapy i materiały źródłowe.                                                                                            |
| `python/` i `skill-validation/`                                                   |  53,8 MiB | Lokalne biblioteki do jednorazowych prac. Kandydat do usunięcia, jeżeli nie wracamy do ekstrakcji PDF/walidacji skilli. Skrypt `read-metro.py` nadal odwołuje się do `.local/python`. |
| `playwright/olx-profile/`                                                         |  59,5 MiB | Osobno ocenić przydatność sesji przeglądarki. Usunięcie całego profilu kasuje także cookies i stan sesji, nie tylko cache.                                                            |
| `ai-review/`                                                                      |   3,4 MiB | Zachować: zdjęcia, kolaże, manifest i `reviews.json` z wstrzymanego eksperymentu AI.                                                                                                  |
| `backups/`, `certs/`, `qa/`                                                       |     0 MiB | Obecnie puste. `backups/` jest docelowym katalogiem narzędzia kopii zapasowych.                                                                                                       |

### Zachować

- `oferty-do-sprawdzenia-2026-10-04.md`: decyzje użytkownika dotyczące opisów ofert.
- `pietra-do-sprawdzenia-2026-10-04.md`: 357 historycznych rekordów do weryfikacji.
- `ai-review/`: materiały potrzebne do wznowienia eksperymentu, wskazane w handoffie.
- Oryginalne odpowiedzi źródeł map, m.in. `warsaw-msi-all-osm.json`,
  `warsaw-msi-dabrowka-full.json`, `rail-osm.json` i `rail-passenger-osm.json`.
  Pozwalają wrócić do danych użytych przy generowaniu map; nowe pobranie może
  dać inny wynik. `m4-plans.pdf` zachować jako źródło do czasu zakończenia prac
  nad planami metra. Wygenerowane z niego obrazy można odtworzyć.
- Kopie stanu sprzed napraw i raporty otwartych problemów danych. Same nazwy
  `before`, `audit`, `snapshot` ani rozszerzenie `.json` nie wystarczają do
  uznania pliku za zbędny. Nie zweryfikowano indywidualnie treści wszystkich JSON-ów.

### Skrypty robocze

390 skryptów luzem zajmuje niewiele miejsca. Są wśród nich testy, diagnozy,
jednorazowe refaktoryzacje oraz operacje zmieniające bazę. Nie uruchamiać ich
zbiorczo podczas porządkowania. Przykładowo `cleanup-fresh.cjs` usuwa testową
bazę PostgreSQL, a nie katalog na dysku.

Przydatne, powtarzalne narzędzie należy najpierw przejrzeć, usunąć prywatne dane
i przenieść do `scripts/` z opisem użycia. Pozostałe można archiwizować wraz
z materiałami danego zadania. Przenoszenie pojedynczych plików może zerwać
wpisane w skryptach ścieżki `.local/...`; archiwum nie jest gotowym zestawem
do uruchomienia bez korekty ścieżek.

## Układ dla nowych prac

- `.local/runs/YYYY-MM-DD-temat/`: logi, skrypty jednorazowe, zrzuty i raporty
  jednej sesji; wewnątrz można wydzielić `logs/` i `screenshots/`.
- `.local/reference/`: zachowane odpowiedzi źródeł oraz dokumenty wejściowe.
- `.local/tools/`: odtwarzalne biblioteki pomocnicze.
- `.local/archive/`: stare sesje, których przydatności jeszcze nie rozstrzygnięto.
- `.local/backups/`, `.local/recovery/`, `.local/ai-review/`: pozostawić ścieżki
  obsługiwane przez istniejące narzędzia.

Ten układ dotyczy nowych materiałów; przegląd nie przeniósł dotychczasowych plików.
Prywatne listy ofert również pozostają pod obecnymi ścieżkami wskazanymi w TODO.
Notatki zadań i handoffy bez prywatnych danych zapisujemy w `docs/`.

Po zamknięciu zadania zapisać wynik w `docs/TODO.md`, a robocze materiały sesji
przechowywać orientacyjnie 14 dni. Usuwać ręcznie tylko zamknięte sesje;
ten termin nie dotyczy kopii zapasowych, źródeł map, decyzji użytkownika ani
materiałów nierozwiązanych problemów. Nie ma automatycznego kasowania.

## Kolejność porządkowania istniejących plików

1. Sprawdzić, czy nic nie korzysta ze starego `fresh-start`, i usunąć jego
   odtwarzalne `node_modules/`. To usuwa około 83% wszystkich plików `.local`.
2. Usunąć stare logi i zrzuty zakończonych kontroli UI, zachowując ostatnią
   sesję oraz dowody otwartych błędów.
3. Przejrzeć resztę `fresh-start`, profil OLX i biblioteki pomocnicze oddzielnie.
4. Rozdzielać JSON-y i skrypty według zadania oraz treści, bez masowego kasowania
   po rozszerzeniu. Przy przenosinach poprawić aktywne odwołania i dokumentację.

Pełny pomiar obejmował także katalogi bibliotek niedostępne w początkowym
odczycie sandboxa. Sprawdzono odwołania w kodzie aplikacji, skryptach,
konfiguracji Compose i dokumentacji. Nie sprawdzano aktywnych procesów starego
środowiska ani odtwarzania jego zależności; są to warunki przed faktycznym kasowaniem.
