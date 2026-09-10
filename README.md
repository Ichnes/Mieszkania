# Mieszkania

Lokalna aplikacja do przeglądania ofert z ośmiu portali, porównywania cen, map,
statystyk i planowania oglądań. Dane oraz ustawienia użytkownika zostają na jego komputerze.

## Uruchomienie przez Docker Desktop

Uruchom **Docker Desktop** (na Windows z silnikiem WSL 2), a następnie w katalogu projektu:

```sh
docker compose up -d --build
docker compose ps
```

Otwórz **http://localhost:8080/oferty**. Docker buduje frontend i API oraz uruchamia
PostgreSQL. Nie trzeba lokalnie instalować Node.js, npm ani PostgreSQL.
Pierwsze budowanie pobiera obrazy, zależności i Chromium dla kolektorów ofert;
wymaga dostępu do internetu.

Aplikacja działa w tle po zamknięciu terminala. Po restarcie komputera uruchom Docker
Desktop; kontenery mają automatyczny restart, o ile nie zostały ręcznie zatrzymane.
Po pobraniu zmian kodu ponów `docker compose up -d --build`.
`docker compose down` zatrzymuje aplikację i zachowuje dane; **nie dodawaj `--volumes`,
jeśli chcesz je zachować**. Logi sprawdzisz przez `docker compose logs --tail=100`.

Nowa instalacja przechowuje dane w wolumenach `database` i `storage` i zaczyna bez ofert.
Jeśli masz lokalny `compose.override.yaml`, Compose uwzględni go automatycznie — może on
korzystać z dotychczasowej bazy PostgreSQL na Windows i katalogu `storage`.
Wtedy ta usługa PostgreSQL musi nadal działać. Szczegóły opisuje
[instrukcja startu](docs/guides/getting-started.md#istniejące-dane-na-tym-komputerze).

Pierwsze oferty dodasz w **Aktualizacja** lub przez **Import pojedynczego linku**.
Adresy dojazdu i preferencje zmienisz w ustawieniach.

### Praca nad kodem

Z zainstalowanym **Node.js 22.14+** i npm uruchom `npm run docker:dev`.
Adres pozostaje ten sam: **http://localhost:8080/oferty**. Zmiany frontendu odświeżają
się automatycznie, a zmiany API i wspólnego pakietu restartują odpowiedni serwis.
Polecenie zachowuje lokalny `compose.override.yaml`. Terminal musi pozostać otwarty;
Ctrl+C kończy sesję. Do pracy w tle wróć przez `docker compose up -d --build`.

### Alternatywa bez kontenerów

Wymaga **Node.js 22.14+**, npm i działającego **PostgreSQL 16+**:

```sh
npm install
npm run dev
```

Ten tryb działa pod **http://localhost:5173/oferty**. Przygotowanie startu tworzy brakujący
`.env` z szablonu i inicjalizuje bazę; inne dane połączenia ustaw w `DATABASE_URL`.
Pełna konfiguracja jest w [instrukcji startu bez kontenerów](docs/guides/getting-started.md#bez-kontenerów).
Nie uruchamiaj równolegle drugiego API na tej samej bazie.

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

| Polecenie                        | Działanie                                                                |
| -------------------------------- | ------------------------------------------------------------------------ |
| `docker compose up -d --build`   | Uruchomienie lub aktualizacja aplikacji w tle na porcie 8080             |
| `docker compose ps`              | Stan kontenerów                                                          |
| `docker compose logs --tail=100` | Ostatnie logi aplikacji i bazy                                           |
| `docker compose down`            | Zatrzymanie kontenerów z zachowaniem danych                              |
| `npm run docker:dev`             | Docker z obserwowaniem zmian kodu                                        |
| `npm run dev`                    | Przygotowanie bazy, frontend, API i obserwowanie zmian wspólnego pakietu |
| `npm run setup`                  | Sprawdzenie konfiguracji i przygotowanie lokalnej bazy                   |
| `npm test`                       | Wszystkie testy API i frontendu                                          |
| `npm run typecheck`              | Kontrola typów                                                           |
| `npm run build`                  | Kompilacja projektu i produkcyjny frontend                               |
| `npm run format`                 | Spójne formatowanie kodu i dokumentacji                                  |
| `npm run format:check`           | Kontrola formatowania                                                    |

## Dokumentacja i dane prywatne

Zacznij od [spisu dokumentacji](docs/README.md), [instrukcji startu](docs/guides/getting-started.md)
i [architektury](docs/architecture/overview.md). Bieżące zadania są w [docs/TODO.md](docs/TODO.md).
[Audyt aplikacji](docs/audit-2026-09-08.md) opisuje poprawki i kolejne priorytety;
[opcjonalne logowanie](docs/guides/login.md) przygotowuje dostęp przez email i hasło.

`.env`, `compose.override.yaml`, `storage/`, `.local/`, zależności i buildy są ignorowane przez Git. Nie wysyłaj
znajomemu swojej bazy ani tych katalogów. Każda osobna instalacja ma własne dane;
urządzenia podłączone do tego samego uruchomionego serwera współdzielą jego ustawienia.
