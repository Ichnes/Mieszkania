# Porządek w `.local`

`.local/` jest wykluczony z Git i kontekstu budowania Dockera. Zawiera prywatne
materiały robocze, źródła danych oraz kopie zapasowe. Nie usuwaj całego katalogu.

## Wynik sprzątania z 5 października 2026

Przed przeglądem: 21 987 plików, 570,5 MiB, w tym 2294 pliki luzem.
Usunięto 20 966 zbędnych plików, w tym dwie odpowiedzi błędów HTML mylnie nazwane JSON. Zostało około 160 MiB; dokładny bieżący rozmiar
rośnie o logi i zrzuty kolejnych prac. W głównym katalogu pozostały tylko dwie
prywatne listy ofert. Logi i skrypty bieżących zadań znajdują się w `runs/`.

Usunięto stare logi, obrazy z zakończonych kontroli UI, odtwarzalne rendery PDF,
jednorazowe skrypty refaktoryzacji i diagnostyki, pobrane kopie kodu portali,
bibliotekę walidacji skilli oraz kopię testową `fresh-start/` z zależnościami.
Nie znaleziono procesu korzystającego z tej kopii. Jej różniące się pliki kodu
były identyczne z obiektami w historii Git; osobne TODO i lokalne ustawienia
zachowano w archiwum. Nie uruchamiano starych skryptów napraw bazy.

## Co zostało

| Ścieżka                               | Zawartość                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `oferty-do-sprawdzenia-2026-10-04.md` | Decyzje użytkownika dotyczące opisów ofert                                      |
| `pietra-do-sprawdzenia-2026-10-04.md` | 357 historycznych rekordów do weryfikacji                                       |
| `playwright/olx-profile/`             | Profil OLX, razem z cookies i stanem sesji                                      |
| `python/`                             | Biblioteki PyMuPDF do ponownej obróbki PDF                                      |
| `tools/pdf/`                          | Trzy skrypty PDF/OSM, z poprawionymi ścieżkami                                  |
| `reference/pdf/`                      | Oryginalny PDF planów M4, tekst i strona źródłowa                               |
| `reference/maps/`                     | Oryginalne odpowiedzi OSM, mapy i zapytanie kolei                               |
| `reference/gis-research.json`         | 11 unikalnych odpowiedzi z 771 plików GIS, z mapowaniem starych nazw            |
| `reference/repair-evidence.zip`       | 21 plików: raporty napraw, stan przed zmianami, lokalne ustawienia i dawne TODO |
| `reference/portal-catalogs.zip`       | 5 katalogów portali i metadanych wyszukiwania                                   |
| `reference/parser-examples.zip`       | 11 zachowanych stron przydatnych do regresji parserów                           |
| `reference/research-tools.zip`        | 34 skrypty badań map, diagnostyki danych i weryfikacji decyzji                  |
| `ai-review/`                          | Zdjęcia, kolaże, manifest i oceny z wstrzymanego eksperymentu AI                |
| `runs/2026-10-04-decisions/`          | Ostatnie wyniki testów i wybrane zrzuty poprzedniego zadania                    |
| `runs/2026-10-05-cleanup/`            | Inwentarz, plan, raport wykonania i skrypty tego sprzątania                     |
| `backups/`, `certs/`, `qa/`           | Obecnie puste; `backups/` pozostaje ścieżką narzędzia kopii zapasowych          |

Sprawdzono zgodność zachowanych plików sumami SHA-256: wszystkie 988 plików
chronionych (profil OLX, Python, AI, prywatne listy), przeniesione pliki oraz
każdy wpis archiwów. Odpowiedzi GIS porównano po odczycie JSON. Archiwa i źródła
pozostają prywatne, poza Git. `repair-evidence.zip` zawiera także lokalny `.env`
z dawnego testu — nie jest materiałem do publikacji.

Z zachowanych źródeł MSI odtworzono 143 obszary; wynik jest identyczny z obecną
mapą aplikacji. Poprawne źródło to `reference/maps/warsaw-msi-osm.json` oraz
uzupełnienie `warsaw-msi-dabrowka-full.json`.

Archiwa można otworzyć zwykłym narzędziem ZIP. Stare skrypty są materiałem
referencyjnym: przed uruchomieniem trzeba sprawdzić ich ścieżki i operacje na
bazie. Nie rozpakowuj ich zbiorczo do katalogu projektu.

## Powrót do PDF

Uruchamiaj z katalogu głównego projektu:

```sh
python .local/tools/pdf/read-metro.py
node .local/tools/pdf/pdf-streets.cjs
python .local/tools/pdf/osm-parse.py
```

Pierwszy skrypt wykorzystuje zachowane `.local/python` i zapisuje odtwarzalne
obrazy w `.local/runs/pdf-render/`. Pozostałe odczytują zachowany tekst PDF
i dane OSM. Biblioteki można zachować niezależnie od kasowania renderów.

## Zasady dla kolejnych prac

- Logi, zrzuty i jednorazowe skrypty zapisuj w `.local/runs/YYYY-MM-DD-temat/`,
  bez tworzenia luźnych plików w `.local/`.
- Zachowywane źródła danych umieszczaj w `.local/reference/`, a pomocnicze
  narzędzia w `.local/tools/`. Powtarzalne narzędzia projektu przenoś do
  `scripts/` dopiero po przeglądzie i usunięciu prywatnych danych.
- Po zamknięciu zadania zapisz wynik w `docs/TODO.md`. Notatki i handoffy
  bez prywatnych danych należą do `docs/`.
- Logi i obrazy zamkniętej sesji można ręcznie usunąć po około 14 dniach.
  Nie dotyczy to dowodów nierozwiązanych błędów, decyzji użytkownika, źródeł,
  profilu OLX, narzędzi PDF, eksperymentu AI ani kopii zapasowych.
- Zachowaj ścieżki `.local/backups/`, `.local/recovery/` i `.local/ai-review/`
  używane przez narzędzia. Nie ma automatycznego kasowania.
