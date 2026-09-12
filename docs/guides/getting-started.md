# Start lokalny

## Docker Desktop

Na Windows uruchom Docker Desktop z silnikiem WSL 2. Rozszerzenie do VS Code nie jest wymagane.
W katalogu projektu wykonaj:

```sh
docker compose up -d --build
docker compose ps
```

Jeśli masz Node.js, możesz zamiast tego uruchomić `npm run docker:up`.
Polecenie wykonuje `docker compose up -d --build --wait`, a po uzyskaniu gotowości
wypisuje adres lokalny i adresy IP komputera do otwarcia w sieci domowej.
`npm run docker:urls` wyświetla te adresy ponownie bez restartowania kontenerów.
Zwykłe `docker compose up` nadal działa; samo nie wypisuje adresu LAN komputera.

Otwórz `http://localhost:8080/oferty`. Pierwsze budowanie pobiera obrazy, zależności
i Chromium. Compose uruchamia frontend, API oraz własny PostgreSQL; nie wymaga
lokalnej instalacji Node.js ani PostgreSQL. Dane są przechowywane w osobnych
wolumenach `database` i `storage`, bez kopiowania dotychczasowej lokalnej bazy.
Port 8080 jest dostępny także przez `http://IP-KOMPUTERA:8080/oferty` w sieci
domowej, jeśli zapora Windows pozwala na połączenia. Opcjonalne
`DOCKER_BIND_ADDRESS=127.0.0.1` ogranicza dostęp do tego komputera.
`-d` uruchamia kontenery w tle; zamknięcie terminala ich nie zatrzymuje.
Po restarcie komputera uruchom Docker Desktop — kontenery mają automatyczny restart,
o ile nie zostały ręcznie zatrzymane. Po `docker compose down` ponów polecenie startu.
Przed udostępnieniem przez internet włącz [opcjonalne logowanie](login.md) i HTTPS.

`docker compose logs --tail=100` pokazuje logi. `docker compose down` zatrzymuje
aplikację i zachowuje dane; dodanie `--volumes` usuwa dane wolumenów.
Po zmianie kodu ponów `docker compose up -d --build`. Nie trzeba wcześniej wykonywać `down`.

### Zmiany kodu bez przebudowy za każdym razem

Z zainstalowanym Node.js uruchom `npm run docker:dev`. Polecenie zachowuje lokalny
`compose.override.yaml`, uruchamia Vite na tym samym porcie 8080 i obserwuje pliki.
Frontend odświeża się przez HMR; zmiana API lub wspólnego pakietu synchronizuje pliki
i restartuje dany serwis. PostgreSQL i dane pozostają uruchomione. Pierwszy start oraz
zmiana zależności wymagają budowy obrazu.

Terminal z obserwowaniem musi pozostać otwarty. Ctrl+C kończy sesję deweloperską.
Do zwykłej pracy w tle wróć przez `docker compose up -d --build`. Nie uruchamiaj
jednocześnie drugiego API na tej samej bazie.

Bez lokalnego Node.js użyj `docker compose -f compose.yaml -f compose.dev.yaml up --build --watch`.
Jeżeli masz lokalny plik konfiguracji, dopisz `-f compose.override.yaml` **przed**
`-f compose.dev.yaml`, aby zachować połączenie z dotychczasową bazą.
Wymagany jest aktualny Compose z obsługą `sync+restart`, `initial_sync` i `!override`.
Sposób synchronizacji opisuje [Docker Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/).

### Istniejące dane na tym komputerze

Nowa instalacja Compose ma osobną pustą bazę. Lokalny `compose.override.yaml`
może podłączyć API do istniejącego PostgreSQL Windows przez `host.docker.internal`
i zamontować dotychczasowy katalog `storage` w `/app/storage`. Compose automatycznie
uwzględnia ten plik przy zwykłym uruchomieniu. Plik jest ignorowany przez Git,
ponieważ zawiera lokalne ścieżki i dane połączenia; nie wysyłaj go znajomemu.
W takim układzie PostgreSQL Windows musi nadal działać. Nie uruchamiaj równolegle
drugiego API przez `npm run dev`, aby nie powielać automatycznych importów.

## Bez kontenerów

### Wymagania

- Node.js 22.14 lub nowszy i npm.
- Działający PostgreSQL 16 lub nowszy. Zainstaluj go lokalnie przed uruchomieniem aplikacji.
- Wolne porty 5173 (frontend) i 3001 (API).

### Nowa kopia repo

```sh
git clone https://github.com/Ichnes/Mieszkania.git
cd Mieszkania
npm install
npm run dev
```

`npm install` buduje `packages/shared`. `npm run dev` tworzy `.env`, jeśli go brakuje,
sprawdza PostgreSQL i inicjalizuje pustą bazę. Przy połączeniu lokalnym może utworzyć
brakującą bazę, jeżeli użytkownik PostgreSQL ma uprawnienie `CREATEDB`. Na zdalnym serwerze
bazę trzeba utworzyć samodzielnie. Nie nadpisuje istniejącego `.env` ani danych.

Jeżeli używasz innych danych logowania, ustaw je w `.env`:

```dotenv
DATABASE_URL=postgres://uzytkownik:haslo@localhost:5432/mieszkania
PORT=3001
VITE_API_URL=
```

Nie commituj tego pliku. Puste `VITE_API_URL` korzysta z proxy Vite — nie trzeba znać
adresu API z telefonu. Proxy automatycznie używa `PORT`; opcjonalne `WEB_PORT` zmienia port frontendu.

Po starcie otwórz `http://localhost:5173/oferty`. Pusta baza nie zawiera przykładowych
ogłoszeń. Dodaj własne preferencje i uruchom sprawdzanie portali w Aktualizacji.

## Problemy przy starcie

- **Błąd połączenia z bazą:** sprawdź, czy usługa PostgreSQL działa i czy dane w `.env` są poprawne.
- **Brak uprawnienia do tworzenia bazy:** utwórz bazę `mieszkania` w PostgreSQL dla swojego użytkownika i ponów start.
- **Zajęty port:** zakończ poprzedni proces aplikacji; nie uruchamiaj dwóch kopii na tym samym porcie.
- **Brak wspólnego pakietu po ręcznym czyszczeniu buildów:** `npm run setup` odbuduje pakiet.
- **Brak zdjęć z portalu:** użyj pobierania zdjęć; niektóre portale blokują bezpośrednie wyświetlanie zewnętrznych adresów.
- **Błąd kolektora:** szczegóły są w `storage/logs/import-failures.ndjson`.

`AUTOMATION_ENABLED=false` wyłącza automatyczne przetwarzanie kolejki przy starcie API.
To ustawienie jest przydatne w osobnej instalacji testowej.

## Dane użytkownika

Ustawienia są w PostgreSQL i lokalnym `storage/settings/family-settings.json`.
Plik służy do odtworzenia ustawień, jeśli brakuje ich w bazie; istniejący rekord bazy ma
pierwszeństwo. Ulubione, notatki, wizyty i oferty są przechowywane w bazie.
Motyw i pamięć filtrów pozostają w przeglądarce.

## Przeglądarka kolektorów

Instalacja i przygotowanie startu sprawdzają Chromium dla Playwrighta i pobierają je,
jeżeli go brakuje. Można powtórzyć ten krok poleceniem `npm run setup:browser`.
Na Linuksie mogą być potrzebne biblioteki systemowe; polecenie
`npx playwright install --with-deps chromium` instaluje je z uprawnieniami administratora.

Po pierwszym uruchomieniu przejdź do **Aktualizacja → Import i przygotowanie danych**
i pobierz katalog ulic Warszawy. Jest to jednorazowe przygotowanie lokalizacji.
