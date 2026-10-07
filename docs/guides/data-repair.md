# Uzupełnianie danych z portali i duplikatów

## Korekta sklejonych pięter

Parser Domiporty odczytuje `7/13` jako piętro 7, zamiast sklejać liczby do 713.
Zachowane błędne piętra można zweryfikować z archiwalnym HTML i opisem:

```powershell
node --import tsx apps/api/src/scripts/maintenance/repair-listing-floors.ts
node --import tsx apps/api/src/scripts/maintenance/repair-listing-floors.ts --apply
```

Pierwsze polecenie zapisuje raport, drugie stosuje potwierdzone poprawki w transakcji.
Wymagane jest połączenie `DATABASE_URL` z bazą aplikacji. W Dockerze użyj
`docker compose exec -T api` przed poleceniem. Raport z wartościami przed zmianą
i źródłem potwierdzenia zostaje w `storage/maintenance/`. Niejednoznaczne rekordy
pozostają bez zmian; skrypt nie rozdziela cyfr na podstawie domysłu.

Nowy import i pełna aktualizacja czytają piętro z tabeli/nagłówka Gratki, parametry `ad.ad`
OLX oraz współrzędne JSON-LD, mikroformatów i mapy Domiporta/Nieruchomości-online.
Punkt portalu może być przybliżony; samo jego odczytanie nie potwierdza położenia budynku.

Po zmianie danych oferty aplikacja ponownie uzupełnia braki w jej potwierdzonej grupie
duplikatów. Dotyczy to również roku budowy. Nie wystarczy samo podobieństwo do innej oferty.
Rok, pokoje, piętro, piętra budynku i metraż są dziedziczone tylko przy jednej zgodnej wartości
w grupie. Istniejące wartości nie są nadpisywane. Współrzędne przenoszą się razem,
wyłącznie gdy grupa ma jedną zgodną parę, a odbiorca nie ma żadnej współrzędnej.
Adres/dzielnica/poddzielnica korzystają z niepustej wartości, preferując ofertę główną.
Ceny ofertowe i ustalenia po rozmowie nie są kopiowane między portalami.

## Istniejąca baza

Najpierw sprawdź raport bez trwałego zapisu:

```powershell
npm run facts:backfill-portals
npm run duplicates:backfill-facts
```

Uzupełnienie po sprawdzeniu raportu:

```powershell
npm run facts:backfill-portals -- --apply
npm run duplicates:backfill-facts -- --apply
```

W Dockerze poprzedź komendę `docker compose exec api`, np.
`docker compose exec api npm run facts:backfill-portals -- --apply`.
Pierwsza komenda czyta archiwum HTML, uzupełnia brakujące piętro/liczbę pięter Gratki
i kompletne brakujące pary współrzędnych obu portali. Nie pobiera ofert z internetu,
nie zmienia ich statusu, opisów ani cen. Raport osobno liczy nieobecne archiwa i błędy.
Obsługiwane są manifesty nowego archiwum oraz stare katalogi `offers/<portal>/<id>/<data>/`.
Brak danych w archiwum pozostaje brakiem — nie jest zgadywany.

Obie komendy zapisują kopię zmienianych pól do `storage/maintenance/*-before-*.ndjson`
przed zatwierdzeniem transakcji. Raport duplikatów sprawdza rzeczywistą liczbę zmian
w transakcji wycofywanej w trybie bez `--apply`. Archiwum i kopie nie trafiają do Git.

## Regresje

Zanonimizowane rzeczywiste fragmenty i pochodzenie próbek są w
[katalogu fixtures](../../apps/api/src/collectors/fixtures/README.md).
`npm test` uruchamia regresje parserów. Test SQL jest dodatkowy i wymaga
zmiennej `TEST_DATABASE_URL` z połączeniem PostgreSQL:

```powershell
node --import tsx --test apps/api/src/services/market/market-postgres.test.ts
```

Test tworzy tabele tymczasowe na własnym połączeniu i wycofuje transakcję. Sprawdza
medianę/kwartyle po połączeniu aliasów oraz dziedziczenie i konflikty faktów duplikatów.
Bez zmiennej test SQL jest jawnie pomijany.

## Akapity w opisach

Nowe importy zachowują akapity i podziały wierszy portalu. Starsze opisy można odtworzyć z ostatniego zapisanego snapshotu:

```powershell
docker compose exec -T api node --import tsx apps/api/src/scripts/maintenance/restore-description-paragraphs.ts
docker compose exec -T api node --import tsx apps/api/src/scripts/maintenance/restore-description-paragraphs.ts --apply
```

Pierwsze polecenie pokazuje liczbę dopasowań, drugie zapisuje formatowanie. Zmiana jest możliwa wyłącznie przy zgodności treści po pominięciu białych znaków; opisy bez zachowanego źródła pozostają bez zmian. Dopisek portalu o sprzedaży bezpośredniej pozostaje zachowany.
