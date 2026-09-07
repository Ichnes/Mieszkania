# Start lokalny

## Wymagania

- Node.js 22.14 lub nowszy i npm.
- Działający PostgreSQL 16 lub nowszy. Zainstaluj go lokalnie przed uruchomieniem aplikacji.
- Wolne porty 5173 (frontend) i 3001 (API).

## Nowa kopia repo

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
