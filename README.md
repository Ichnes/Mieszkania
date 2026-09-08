# Mieszkania

Lokalna aplikacja do przeglądania ofert z ośmiu portali, porównywania cen, map,
statystyk i planowania oglądań. Dane oraz ustawienia użytkownika zostają na jego komputerze.

## Uruchomienie

Wymagania uruchomienia bez kontenerów: **Node.js 22.14+**, npm i uruchomiony **PostgreSQL 16+**.
Alternatywnie użyj [Docker Desktop i Compose](docs/guides/getting-started.md#docker-desktop).

```sh
npm install
npm run dev
```

Otwórz **http://localhost:5173/oferty**. Pierwsza instalacja pobiera również Chromium
dla kolektorów ofert; wymaga dostępu do internetu.

Przy pierwszym starcie aplikacja tworzy lokalny `.env` z szablonu, buduje wspólny pakiet
oraz przygotowuje bazę i tabele. Domyślne połączenie to PostgreSQL na `localhost:5432`,
użytkownik i hasło `postgres`, baza `mieszkania`. Jeśli Twoje dane są inne, popraw
`DATABASE_URL` w `.env` i ponów `npm run dev`. **npm nie instaluje serwera PostgreSQL.**
Istniejąca baza i zapisane ustawienia są zachowywane. Nowa baza zaczyna bez ofert i adresów pracy.

Pierwsze oferty dodasz w **Aktualizacja** lub przez **Import pojedynczego linku**.
Adresy dojazdu i preferencje zmienisz w ustawieniach.

## Struktura

```text
apps/web/src/       app, pages, features, shared, styles
apps/api/src/       http/routes, collectors, background, services, db, scripts
packages/shared/   wspólne kontrakty i konfiguracja regionu
scripts/           przygotowanie startu i uruchamianie testów
docs/              instrukcje, architektura, referencje i archiwalne notatki
storage/           lokalne dane, zdjęcia i backupy — poza Git
```

## Polecenia

| Polecenie              | Działanie                                                                |
| ---------------------- | ------------------------------------------------------------------------ |
| `npm run docker:dev`   | Docker z obserwowaniem zmian kodu                                        |
| `npm run dev`          | Przygotowanie bazy, frontend, API i obserwowanie zmian wspólnego pakietu |
| `npm run setup`        | Sprawdzenie konfiguracji i przygotowanie lokalnej bazy                   |
| `npm test`             | Wszystkie testy API i frontendu                                          |
| `npm run typecheck`    | Kontrola typów                                                           |
| `npm run build`        | Kompilacja projektu i produkcyjny frontend                               |
| `npm run format`       | Spójne formatowanie kodu i dokumentacji                                  |
| `npm run format:check` | Kontrola formatowania                                                    |

## Dokumentacja i dane prywatne

Zacznij od [spisu dokumentacji](docs/README.md), [instrukcji startu](docs/guides/getting-started.md)
i [architektury](docs/architecture/overview.md). Bieżące zadania są w [docs/TODO.md](docs/TODO.md).
[Audyt aplikacji](docs/audit-2026-09-08.md) opisuje poprawki i kolejne priorytety;
[opcjonalne logowanie](docs/guides/login.md) przygotowuje dostęp przez email i hasło.

`.env`, `storage/`, `.local/`, zależności i buildy są ignorowane przez Git. Nie wysyłaj
znajomemu swojej bazy ani tych katalogów. Każda osobna instalacja ma własne dane;
urządzenia podłączone do tego samego uruchomionego serwera współdzielą jego ustawienia.
