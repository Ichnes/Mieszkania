# Architektura

Projekt to monorepo npm: React/Vite w `apps/web`, Fastify/PostgreSQL w `apps/api` oraz
wspólne typy w `packages/shared`. Przeglądarka korzysta z API przez proxy Vite.

## Frontend

- `app/`: kompozycja aplikacji, konfiguracja tras, pamięć sesji i koordynacja danych.
- `pages/`: moduły odpowiadające adresom zakładek, ładowane na żądanie.
- `features/`: komponenty, logika i typy danej funkcji: oferty, importy, mapa, statystyki,
  kredyt, porównanie, duplikaty i ustawienia.
- `shared/components/`: wspólne elementy interfejsu, np. pełny ekran i ekran startowy.
- `shared/lib/`: formatowanie liczb/dat, pola formularzy, konfiguracja API i tekst.
- `styles/`: `global.css` ustala kolejność importów; `base/` zawiera podstawowe układy,
  a nazwane moduły dotyczą ofert, importów, map, preferencji, statystyk i motywów.
  Zachowana kolejność reguł chroni kaskadę CSS. Zmiany uwzględniają desktop, laptop i telefon.

`App.tsx` wybiera ekran startowy lub aplikację. `Workspace` układa nawigację i trasy.
`useWorkspaceController` koordynuje wspólne dane, a `useImportController` obsługuje
kolektory i kolejki. Ciężkie wykresy i Leaflet są importowane dopiero, gdy są potrzebne.
Sam podział pliku nie jest optymalizacją; efekt oceniamy po pakietach i żądaniach sieciowych.

Testy `*.test.ts` są obok sprawdzanej logiki. Importy powinny wskazywać konkretny moduł,
a funkcje specyficzne dla oferty czy kredytu powinny zostać w swojej funkcjonalności.
Nie dodajemy jednego globalnego pliku `utils` na wszystko.

## Backend

- `index.ts`: start, inicjalizacja bazy i zamknięcie procesu.
- `http/app.ts`: konfiguracja Fastify i rejestracja tras.
- `http/routes/`: endpointy pogrupowane według funkcji i portalu.
- `collectors/`: discovery, parsery i zapis danych poszczególnych portali; `registry.ts` tworzy kolektory.
- `background/`: cykl automatycznego przetwarzania kolejki.
- `services/`: domeny `listings`, `collecting`, `geography`, `insights`, `market`,
  `media`, `archive`, `duplicates`, `settings` i `maintenance`.
- `db/`: połączenie, podstawowy SQL i uzupełnianie schematu.
- `scripts/`: jawnie uruchamiane narzędzia bazodanowe, archiwizacji i napraw.

Start nie wykonuje masowych historycznych poprawek adresów i dzielnic. Te działania
należą do narzędzi utrzymania, a nie do każdego restartu serwera.

## Lokalna prywatność

Konfiguracja i baza nie należą do kodu aplikacji. `storage/`, `.env` i `.local/` są
ignorowane przez Git. Nie zapisujemy adresów pracy jako domyślnych wartości w kodzie.
