# Przegląd wydajności i interfejsu — 6 września 2026

## Wdrożone zmiany

- Karty ofert pobierają tylko wybrane zdjęcie. Niewidoczne slajdy pozostają lekkimi elementami zastępczymi; strzałki, kropki i przesuwanie pozostają dostępne. Pierwotny przebieg miał żądania zdjęć czekające ponad 10 s; nie traktujemy czasu całej aplikacji jako skróconego o stały współczynnik.
- Główny JS: 1013,12 → ok. 464 kB (około −54%). Wykresy, mapa i renderer HTML ikon są ładowane na żądanie. Powtarzalne znaczniki mapy generowane raz. Leaflet 1.9.4 jest zależnością aplikacji, bez pobierania skryptu i CSS z unpkg przy otwarciu mapy.
- Statystyki stosują zapisany zakres ceny, minimalnego metrażu i liczby pokoi. Dodatkowy filtr metrażu może go zawęzić. Usunięto arbitralne widełki 20–300 m². Nie wykonujemy drugiego identycznego odczytu statystyk dla porównania bez dodatkowych filtrów.
- Sygnały liczą ostatnią obniżkę każdej aktywnej, nieukrytej jako duplikat oferty; medianę kwoty i procentu, liczbę powtarzających się przecen, udział przecen w dzielnicach i wiek obserwacji. Próg rankingu dzielnic: co najmniej 20 aktywnych i 3 przecenione. Przy historii krótszej niż 60 dni jawnie pokazujemy brak dostatecznej historii.
- Duplikaty: pełne zdjęcia w ramkach, wyróżnione źródło i rola oferty, czytelna cena/metraż, wyrównane działania. Ciemny motyw filtrów poprawiony dla pól, etykiet, zakładek i checkboxów.
- Mapa: pięć kolorów M1–M5 w legendzie oraz bezpośrednio w opcjach polilinii. Wcześniejsze klasy CSS nie wpływały na renderer canvas. Planowane odcinki są przerywane. Legenda zwijana, domyślnie zwinięta na telefonie. Wyłączone animacje powodujące błąd przy szybkim opuszczaniu mapy.
- Nieruchomosci-online: usunięty twardy limit 15 na całą partię; rezerwacje po 15 powtarzają się do zadanego limitu (maks. 500), do 3 pracowników. Pozostaje globalny odstęp 5 s między startami żądań tej instancji kolektora. Rezerwowanie małych części chroni przed odzyskiwaniem zadań czekających dłużej niż 30 min. Przejęcie kolejki ma transakcję na jednym połączeniu PostgreSQL.
- Odświeżanie ceny: krótka próba statyczna (15 s), najwyżej jeden fallback przeglądarkowy, bez pobierania obrazów, mediów i fontów w tym trybie. Po 429 nie uruchamiamy kolejnej przeglądarki, tylko odkładamy zadania. Pełne pobranie zachowuje galerię i opis.

## Weryfikacja

- 86 testów API i 33 testy logiki frontendu: zaliczone.
- Typecheck i build: zaliczone; wszystkie chunki poniżej 500 kB.
- `.local/verify-review-api.ts`: PostgreSQL, wyłącznie tabele tymczasowe. Partia 200 i kolejna 30, maksymalnie 3 równoległe zadania, odłożenie po 429, mediana ostatniej obniżki bez podwójnego liczenia oferty, ograniczenie metrażu i okresu.
- `.local/verify-review-ui.cjs`: desktop 1440, laptop 1280, telefon 390 px, jasny i ciemny motyw; zdjęcia duplikatów, statystyki, mapa, nawigacja galerii i filtry. Zrzuty w `.local/review-ui/improved-*`.
- Przegląd zakładek: Oferty, Duplikaty, Statystyki, Mapa, Aktualizacja, Kredyt. Żądania zapisu z przeglądarki testowej blokowane.

## Dalsze prace

Aktualna lista pozostaje w [TODO](../TODO.md). Najważniejsze obserwacje: podejrzane grupy duplikatów z dużą różnicą metrażu, powielone dane początkowe, niespójne filtry Winda/Garaż w dotychczasowych statystykach oraz potrzeba pomiaru prawdziwej długiej partii portalu. Czas od pierwszej obserwacji nie jest potwierdzonym czasem sprzedaży.
