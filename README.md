# Mieszkania

Monorepo dla aplikacji do monitorowania rynku mieszkaniowego:

- zbieranie i normalizacja ogloszen,
- historia zmian cen i opisow,
- porownanie ofert do danych transakcyjnych RCN,
- alerty i dashboard analityczny.

## Struktura

- `docs/` - produkt, architektura, model danych
- [Lista zadań i stan prac](docs/TODO.md)
- `apps/web` - frontend React
- `apps/api` - backend HTTP
- `packages/shared` - wspolne typy i kontrakty

## Zakres MVP

1. Import ofert z ograniczonej liczby zrodel.
2. Wspolny model ogloszenia i snapshotow.
3. Historia zmian ceny i statusu.
4. Podstawowy dashboard z lista ofert i alertami.
5. Integracja z danymi RCN jako osobny strumien analityczny.

## Start

Wymagania: Node.js 22+, npm i PostgreSQL 16 (lokalny lub przez Docker).

```bash
npm install
# Skopiuj .env.example do .env i ustaw własny DATABASE_URL.
docker compose up -d postgres
npm run dev
```

Otwórz `http://localhost:5173`. W ustawieniach dodaj własne miejsca dojazdu i kryteria.
Istniejącej lokalnej bazy nie trzeba tworzyć ponownie.

## Prywatne dane i udostępnianie

Kod można udostępnić bez bazy, archiwum ofert i ustawień użytkownika.
`.env`, `storage/`, `.local/`, zbudowane pliki i kopie bazy są wykluczone przez `.gitignore`.
Adresy pracy nie są wpisane w kod: nowa instalacja zaczyna z pustą listą miejsc.

Ustawienia są odczytywane z lokalnej tabeli `app_settings`. Zapis ustawień aktualizuje
również `storage/settings/family-settings.json`. Jeśli w bazie zabraknie ustawień,
aplikacja odtworzy je z tego lokalnego pliku. Istniejący rekord bazy ma pierwszeństwo.
Nie kopiuj `storage/` ani `.env` do repozytorium znajomego. Osoby korzystające z tego
samego uruchomionego serwera współdzielą jego ustawienia; osobna instalacja ma własne dane.

Przed publikacją sprawdź `git status --short` i `git diff --cached`.
Przykładowy przebieg pierwszego wysłania (origin wskazuje repozytorium GitHub):

```bash
git add .
git diff --cached --stat
git commit -m "Initial application"
git push -u origin HEAD
```

## Priorytety techniczne

1. Stabilny model danych przed budowa kolektorow.
2. Rozdzielenie UI, API i workerow ETL.
3. Projektowanie pod sledzenie zmian w czasie, nie tylko aktualny stan.

## Utrzymanie storage

- `npm run storage:report` — raport logicznego i fizycznego rozmiaru archiwum oraz mediów.
- `npm run storage:migrate` — dry-run migracji starego archiwum ofert do gzip; dodaj `-- --apply`, aby wykonać.
- `npm run media:deduplicate` — dry-run deduplikacji zdjęć; `-- --apply` zastępuje wyłącznie identyczne pliki hardlinkami.
- `npm run storage:db-report` — read-only raport największych tabel i payloadów JSONB.
- `npm run storage:db-compact` — dry-run usuwania redundantnego HTML z JSONB po potwierdzeniu pliku archiwum; wykonanie: `-- --apply`.
- `npm run storage:db-reclaim` — dry-run operacji `VACUUM FULL`; wykonanie z `-- --apply` wymaga okna serwisowego.

Oferty ukryte i archiwalne pozostają w bazie. Pełny HTML jest przechowywany w skompresowanym archiwum, a migratory pomijają rekordy bez potwierdzonego pliku źródłowego.

## Naprawa historycznych ID Otodom

`npm run ids:repair-otodom` sprawdza zgodność identyfikatorów z końcówką `-ID…` linku.
`-- --apply` zapisuje poprawki transakcyjnie i tworzy lokalny backup w `storage/backups/`.
Jeśli istnieją już kopie pod poprawnym ID, przejrzyj plan z `-- --merge-same-offer`;
wykonanie wymaga obu flag. Narzędzie zachowuje historię i obrazy, a konflikt danych
użytkownika lub trwające przetwarzanie błędnego wpisu przerywa operację.
W razie konfliktu najpierw wstrzymaj automatyzację. Po naprawie przywróć jej poprzedni stan.

Oceny ręczne, wagi i ranking zostały wycofane z interfejsu. Dawne dane pozostają
w lokalnej bazie; bieżące widoki nie pobierają ani nie przeliczają punktacji.
