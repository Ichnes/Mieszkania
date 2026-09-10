# Bieżące zadania

## Przyspieszenie statystyk (2026-09-10)

- Pomiar przed zmianą: 5,24 s dla 90 dni bez filtrów, 8,18 s dla windy i garażu. Pełne payloady przy filtrowaniu oraz analiza wszystkich cech opisów do samego wykończenia/czynszu były kosztowne; brak ponownego użycia wyniku.
- [x] Ograniczona projekcja danych źródłowych, analiza tylko potrzebnych pól dla segmentów czynszu/wykończenia. Cache 30 s rozdzielony według filtrów i ustawień wyszukiwania; wspólna obietnica dla równoczesnych zapytań, limit 12 wyników, błędy nie są cache'owane.
- [x] Po zmianie: 3,19 s bez filtrów i 5,75 s z windą/garażem przy pierwszym obliczeniu; odczyt cache 1–2 ms w serwisie. Pełny widok w dwóch pomiarach przeglądarki po wdrożeniu: 1,52 i 2,33 s (z nawigacją/ładowaniem aplikacji).
- [x] Porównanie 4820 ofert: identyczne pola wykończenia/czynszu używane do klasyfikacji. Porównanie pełnego i ograniczonego payloadu dla 150 ofert: identyczne udogodnienia. Osiem testów cache, próbek, segmentów i PostgreSQL poprawnych; typecheck/build poprawne.
- [x] Lokalna aplikacja wdrożona, API/web/DB healthy. Instrukcja opisuje 30-sekundowy cache; dane mogą pozostawać niezmienione do wygaśnięcia tego zapisu.

- Weryfikacja całego zestawu zmian 2026-09-10: 179 testów API poprawnych, 5 środowiskowych pominiętych (regresja dzielnic wykonana dodatkowo na PostgreSQL), 89 testów frontend poprawnych. Typecheck/build i lokalne wdrożenie poprawne.

## Klikanie numerów tramwajów (2026-09-10)

- Przyczyna: główna mapa miała przyciski linii, ale mapa szczegółów oferty wyświetlała numery jako zwykły tekst.
- [x] Wspólny popup przystanku z przyciskami i obsługą zdarzeń, większe pola dotykowe, trasa i kolor przystanków wybranej linii także w ofercie oraz reset wyboru.
- [x] Playwright: wybór numeru i reset na mapie głównej oraz oferty, myszą 1440 px i dotykiem 390 px; potwierdzona wybrana geometria trasy i widoczne sterowanie. Typecheck i build poprawne, kontenery healthy.

## Zaznaczenie obszaru z mapy statystyk (2026-09-10)

- [x] Kliknięcie/wybór klawiaturą obszaru MSI na mapie lub jej liście przekazuje wybór do tabeli. Właściwa karta poddzielnicy dostaje obramowanie i `aria-current`. Zmiana dzielnicy zeruje poprzedni wybór.
- [x] Playwright 1440/390: wybór Skoroszy na mapie, przeniesienie klawiaturą do Szamot, jedna obramowana karta z `aria-current`, reset po powrocie do całej Warszawy; widoki obejrzane.

## Dzielnice: zgodność filtra, Wesoła i pełny katalog (2026-09-10)

- Przyczyna: filtr czytał surową dzielnicę z bazy, widok nadpisywał ją lokalizacją z tytułu. Trzy wskazane oferty miały błędny Mokotów/Ochotę i współrzędne poza Wesołą. Katalog wyboru pomijał Targówek i Rembertów.
- [x] SQL filtra używa tej samej reguły pierwszeństwa lokalizacji tytułu i dokładnego dopasowania dzielnicy; katalog zawiera wszystkie 18 dzielnic.
- [x] Wzbogacanie ulic nie uśrednia już ulic o identycznej nazwie z różnych dzielnic. Uwzględnia dzielnicę i ulicę z tytułu; pomija niejednoznaczne dopasowania bez dzielnicy.
- [x] Trzy oferty skorygowane na Wesołą; środki właściwych ulic sprawdzone z granicą dzielnicy. Test PostgreSQL porównuje SQL z regułą tytułu. Rzeczywiste zapytanie użytkownika nie zwraca wskazanych ofert ani ofert oznaczonych Wesołą.
- [x] Pełny filtr dzielnic 1440/1280/390/320 px, bez przepełnienia; preferencje Ursusa i wszystkie pięć obszarów potwierdzone na PC i telefonie. Test katalogu porównuje wszystkie 143 pary dzielnica–MSI z danymi statystyk.
- [x] Po doprecyzowaniu zakresu zastąpiono skróconą listę osiedli pełnymi 143 obszarami MSI z mapy statystyk. Generator i test zgodności obejmują każdą dzielnicę/obszar; Ursus zawiera Czechowice, Gołąbki, Niedźwiadek, Skorosze i Szamoty.

## Dalsze warianty cen dodatków (2026-09-10)

- [x] Kwoty zakończone `,-`, ceny bez słów „dodatkowo płatne”, wielkie litery; sumowanie garażu i osobnego miejsca przed budynkiem. Piwnica to osobny koszt przechowywania, ogródek ma własny koszt. Powtórzenie tej samej ceny miejsca nie dubluje dopłaty.
- [x] 57 regresji parserów i cech poprawnych. Rzeczywista oferta `4d2ff767-f917-4889-9c36-2dbdf4b69f6c`: parking 80 tys., piwnica 20 tys., ogródek 50 tys., suma dopłat 150 tys. — potwierdzone w API i UI na PC/telefonie.

## Ceny garażu i komórki w szczegółach (2026-09-10)

- Zakres: wszystkie przykłady dopłat użytkownika, rozdzielne ceny, pakiet garaż + komórka liczony raz oraz oznaczenie „W cenie mieszkania”.
- [x] Osobny parser kosztów zamiast szukania kwoty za dowolnym słowem w odległym fragmencie. Wspólna cena pakietu ma osobne pole; ręczna cena 0 nie jest pomijana.
- [x] „Garaż / parking” pokazuje cenę lub wliczenie; pakiet ma etykietę „Garaż i komórka”, a osobna cena komórki własny wiersz. Suma zakupu uwzględnia pakiet jednokrotnie.
- [x] 52 testy parserów i cech ofert poprawne (14 kosztów: przykłady użytkownika, tysiące/kropki, zakup obligatoryjny, negacja wliczenia i wynajem). Typecheck i build poprawne.
- [x] Przegląd 150 istniejących opisów oraz API/UI dla osobnego garażu, pakietu, dwóch oddzielnych cen i wliczenia obu dodatków. Suma pakietu sprawdzona z ceną mieszkania. Playwright 1440/1280/390/320 bez przepełnienia; widoki obejrzane.
- [x] Instrukcja zaktualizowana; lokalne API/web/DB healthy. Dane są przeliczane przy odczycie, bez ponownego scrapowania i modyfikowania opisów w bazie.

## Miejsca pracy na świeżym koncie i wybór punktu (2026-09-10)

- Przyczyna: pusta lista miejsc pracy nie miała przycisku dodania; edycja adresu nie usuwała starych współrzędnych.
- [x] Dodawanie/usuwanie maksymalnie sześciu miejsc, instrukcja adresu, wyszukiwanie na żądanie z wyborem wyniku, mapa z korektą kliknięciem i edycja współrzędnych. Zmiana adresu usuwa stary punkt i unieważnia spóźnione wyniki.
- [x] Zapis wymaga adresu oraz prawidłowego punktu; API również to sprawdza. Wyszukiwanie korzysta z istniejącego Nominatim, wspólnego limitu, timeoutu i cache w bazie, bez podpowiedzi po każdym znaku.
- [x] Siedem testów ustawień poprawnych, typecheck i build poprawne. Test wyszukiwarki z lokalnym serwerem potwierdza odczyt odpowiedzi, cache PostgreSQL oraz walidację. Rzeczywisty przykładowy adres zwrócił HTTP 200 i 5 kandydatów.
- [x] Playwright 1440/1280/390/320: świeże konto, dodawanie, wybór wyniku, usunięcie starego punktu po zmianie adresu, kliknięcie mapy i zapis współrzędnych. Brak przepełnienia; mapy obejrzane na PC i telefonie. Test powtórzony z dostępem do sieci po blokadzie kafelków przez sandbox.
- [x] Wdrożenie lokalne: API/web/DB healthy. Instrukcja uzupełniona. Prywatne miejsca pracy nie zostały zmienione — zapisy UI podczas testów były przechwycone.

## Wznawianie przerwanego skanu Otodomu (2026-09-10)

- Zakres: trwały zapis pierwszej niepobranej strony i końca zakresu, osobny przycisk wznowienia tylko Otodomu, powiązanie zapisu z filtrami wyszukiwarki.
- [x] Zapis w bazie po każdej zakolejkowanej stronie; przy błędzie pozostaje strona do ponowienia, przy ukończeniu zapis jest usuwany. Wznowienie zachowuje pierwotny koniec zakresu; blokada równoległych skanów Otodomu.
- [x] Panel Aktualizacji odczytuje zapis po odświeżeniu, pokazuje datę oraz stronę i pozwala ręcznie wznowić. Osobno pozostaje sprawdzanie od początku. Układ zawija się na telefonach.
- [x] Sześć testów checkpoint/discovery/skanu poprawnych; PostgreSQL: zapis, odczyt, aktualizacja i usunięcie sprawdzone. Typecheck i build poprawne, trzy kontenery healthy.
- [x] Playwright 1440/1280/390/320 px: zapis po odświeżeniu, kliknięcie wysyła wyłącznie wznowienie Otodomu, komunikat ukończenia i usunięcie przycisku; brak przepełnienia. Widoki PC i telefonu sprawdzone wizualnie.
- [x] Odzyskano 53–600 z istniejącego logu po porównaniu parametrów wyszukiwania. Rzeczywiste API oraz przycisk w lokalnej aplikacji potwierdzają ten zapis. Nie wykonywano kolejnego skanu portalu.
- Ograniczenie: CAPTCHA może ponownie zatrzymać skan; zmiany kolejności ofert między uruchomieniami wymagają okresowego sprawdzenia od początku.

## CAPTCHA Otodomu na stronie 53 (2026-09-10)

- [x] Log potwierdza `x-amzn-waf-action: captcha` przy HTTP 405. Skan zachował 52 strony, 1847 znalezionych adresów i 1 nową pozycję dodaną do kolejki.
- [x] Jawne CAPTCHA daje krótki komunikat z numerem strony; po zapisaniu diagnostyki kolektor zatrzymuje się bez próbowania zapasowego adresu. Sam HTTP 405 bez tego nagłówka nadal nie jest uznawany za CAPTCHA.
- [x] Pięć testów discovery/skanu/diagnostyki poprawnych, w tym CAPTCHA z HTTP 405 i 202 oraz zwykły 405 z zachowaniem zapasowego adresu. Typecheck i build poprawne; lokalne kontenery API, web i DB healthy.
- Ograniczenie: zmiana nie usuwa zabezpieczenia po stronie Otodomu; nie ponawiamy pełnego skanu podczas blokady.

## Negacja platformy, Chodkiewicza i logi skanowania Otodom (2026-09-10)

- [x] Parser rozróżnia „nie na platformie” / „bez platformy” od rzeczywistej platformy. Zwykły garaż podziemny pozostaje garażem.
- [x] Geokoder dobiera lokalną ulicę według dzielnicy; nie bierze dowolnego pierwszego rekordu z dwóch dzielnic. Koryguje stare przybliżenia z cache. Oferta `da65caf7-c21a-4dc2-8872-b50e007e4198` przeniesiona na Mokotów na podstawie lokalnego katalogu ulic i sprawdzona z granicą dzielnicy.
- [x] Błędne odpowiedzi wyszukiwarki: pełny HTML w gzipie, status, dozwolone nagłówki diagnostyczne, URL wejściowy/końcowy, checksum, liczba bajtów, strona, wariant adresu, identyfikator skanowania i limit stron. Podsumowanie błędu zawiera liczbę stron/ofert już zapisanych. Pierwotny błąd nie jest nadpisywany błędem adresu zapasowego.
- [x] Skan 600 stron przechodzi stronami kolejno, zapisując każdą od razu; błąd dalszej strony nie traci wyników poprawnych stron paczki. Usunięty potwierdzony niedziałający skrót adresu wyszukiwarki.
- [x] Weryfikacja: 155 testów API i 87 frontend poprawnych, 4 środowiskowe pominięte; regresja dwóch ulic o identycznej nazwie wykonana osobno na PostgreSQL. Test gzip odtwarza pełną odpowiedź i nagłówki; test skanu z limitem 600 zachowuje 6 poprawnych stron po błędzie strony 7. Typecheck i build poprawne.
- [x] API potwierdza Mokotów i poprawione współrzędne wskazanej oferty. Trzy istniejące oferty z frazą „nie na platformie” zwracają zwykły garaż. Zaktualizowana instrukcja diagnostyki; lokalne dane i logi nie trafiają do Git.
- Pozostała praca funkcjonalna: brak. Nie odtwarzano pełnego 600-stronicowego pobierania z portalu; obsługa przerwania sprawdzona kontrolowanym testem.

## Diagnoza HTTP 405 wyszukiwarki Otodom (2026-09-10)

- [x] Sprawdzono `storage/logs/import-failures.ndjson`, kod pobierania i wyszukiwania. Żądanie używa GET; błąd powstał przy wyszukiwaniu nowych adresów ofert. Log błędów importu nie zawiera treści tej odpowiedzi wyszukiwarki, więc przyczyna historycznego 405 pozostaje niepotwierdzona.
- [x] Aktualna próba z hosta i kontenera API: główny adres Warszawy zwraca HTTP 200 oraz 36 adresów ofert. Drugi wariant adresu też działa z hosta; najkrótszy zapasowy adres zwraca 404. Discovery pokazuje ostatni napotkany błąd, który może zasłaniać problem pierwszego adresu.
- Wynik: błąd obecnie nie odtwarza się; zapisane oferty pozostają zachowane. Nie uruchamiano pełnego importu ani nie zmieniano kolektora w ramach diagnozy.

## Wiele dzielnic w filtrze ofert (2026-09-10)

- Zakres: lista dzielnic z checkboxami, wybór wielu naraz (lub wszystkich), filtrowanie wyników ofert, zachowanie wyboru w sesji i zgodność ze starszym filtrem jednej dzielnicy.
- [x] Frontend i API obsługują listę dzielnic; zapytanie łączy dzielnice przez OR, a pozostałe kryteria przez AND. „Bez dzielnicy” można łączyć z nazwanymi dzielnicami.
- [x] Testy: 151 API i 87 frontend poprawne, 3 środowiskowe pominięte; typecheck i build Docker poprawne. API: Bemowo 197 + Ursus 120 = 317 ofert; sprawdzone łączenie z „Bez dzielnicy” i zgodność starego parametru.
- [x] Playwright 1440/1280/390/320 px: zaznaczanie i odznaczanie, zastosowanie wyników, zachowanie po przeładowaniu, czyszczenie wyboru i Escape. Bez poziomego przepełnienia; widoki sprawdzone wizualnie.
- Pozostała praca funkcjonalna: brak. Instrukcja zaktualizowana, aplikacja wdrożona lokalnie.

## Naprawa rzutów i częściowych danych okolicy (2026-09-10)

- [x] Rozpoznana przyczyna: rzeczywiste dane Otodomu mają osobne `ad.floorPlans`, bez HTML galerii i bez flagi w zwykłych zdjęciach. Parser obsługuje to pole; rzuty duplikatów są dostępne także przy głównym portalu innym niż Otodom.
- [x] Przygotowany idempotentny skrypt naprawy mediów z nowych manifestów i starszych archiwów. Próba bez zapisu: 4580 odczytanych ofert, 2662 z rzutami, 3041 rzutów; 4 oferty bez archiwum.
- [x] Okolica: zachowanie znanych odległości/liczników przy błędzie lub odświeżaniu; odfiltrowanie pustych zer zastępczych, jeden komunikat o częściowych danych, ponowienie pobrania braków.
- [x] Uzupełniono 3041 rzutów w 2662 istniejących ofertach i pobrano 686 brakujących plików, bez błędów. Pozostałe obrazy już były w cache. Ponowne wykonanie skryptu zachowuje te same zdjęcia. Bieżący import rozpoznaje również rzuty nowych ofert.
- [x] Testy: 151 API i 86 frontend poprawne, 3 testy środowiskowe pominięte; typecheck i build Docker poprawne. Sprawdzone rzeczywiste dane grupy z Gratką jako ofertą główną i rzutem Otodomu.
- [x] Playwright 1440/1280/390/320 px: rzeczywisty rzut otwiera właściwy lokalny plik i poprawnie dekoduje obraz; brak przepełnienia. Częściowa odpowiedź podana przez użytkownika zachowuje Metro Bemowo i dojazdy, ukrywa nieznane zera i utrzymuje wyniki podczas odświeżania. Zrzuty sprawdzone wizualnie.
- Pozostała praca funkcjonalna: brak. Cztery oferty bez lokalnego archiwum wymagają pełnego odświeżenia, jeżeli portal udostępnia dla nich rzut.

## Widoczność przycisku „Rzut” — diagnoza (2026-09-10)

- [x] Sprawdzono warunek renderowania i bazę: przycisk znajduje się w lewym górnym rogu galerii szczegółów, ale pojawia się tylko dla zdjęcia z podpisem `Rzut`. Obecnie 0 z 199 951 zapisanych zdjęć ma takie oznaczenie, więc przycisk nie jest widoczny.
- [x] Rozwiązane w zadaniu powyżej: uzupełnione archiwa i test rzeczywistego rzutu z lokalnego cache.

## Ceny duplikatów, piętro, rzuty i ciaśniejszy interfejs (2026-09-10)

- Zakres: wspólna najniższa cena grupy z historią obniżki i portalem; błędny parter oferty `3ef5c045-4e87-4375-81c0-42a16ac4c35d`; usunięcie powtórzonych portali, zwinięte umawianie oglądania, złota ramka ulubionych, mniejsze odstępy kredytu/statystyk/analizy historii.
- [x] Osobna cena źródłowa portalu i wspólne minimum grupy; atomowe przeliczenie przy pobieraniu, łączeniu, rozłączaniu i archiwizacji. Historia zawiera datę wykrycia i portal. Migracja przelicza istniejące grupy bez powielania zdarzeń.
- [x] Dane strukturalne piętra mają pierwszeństwo przed opisem komórki na parterze. Wskazana oferta: piętro 3, cena grupy 1 394 000 zł; obniżka z 1 440 000 zł pochodzi z Adresowo.
- [x] Usunięty dodatkowy blok portali; zwinięte „Umów oglądanie mieszkania”; złota ramka ulubionych; mniejsze odstępy kart, sekcji kredytu, statystyk i historii rynku.
- [x] Otodom: rozpoznawanie zdjęcia rzutu po semantycznych oznaczeniach galerii lub danych zdjęcia, wybór dużej wersji, zapis podpisu i pobieranie przez istniejący cache mediów. Przycisk „Rzut” otwiera właściwe zdjęcie w pełnym ekranie. Starsze oferty uzupełnią oznaczenie po pełnym odświeżeniu danych.
- [x] Pełne testy: 150 API i 85 frontend poprawne, 3 testy środowiskowe pominięte. Osobno wykonana regresja PostgreSQL z rzeczywistym typem enum: wspólna cena, źródło obniżki, idempotencja, zmiana tańszego portalu, archiwizacja i przywrócenie ceny własnej. Regresje piętra, procentu w szczegółach i parsera rzutów poprawne. Typecheck, build i wdrożenie Docker poprawne.
- [x] Playwright: 1440, 1280, 390 i 320 px, bez poziomego przepełnienia; ulubione, zwijanie formularza, kredyt i statystyki. Przycisk rzutu sprawdzony na kontrolowanej odpowiedzi API bez zmieniania danych użytkownika.
- [x] Końcowy przegląd: ręczne łączenie używa jednej transakcji i tej samej blokady co kolektor. Ponowny start nie powiela obniżki; wszystkie cztery duplikaty wskazanej oferty mają wspólną cenę i −3,2%.
- Pozostała praca funkcjonalna: brak. Zmiany przygotowane do publikacji na bieżącym `main`.

## Spójne segmenty, wykończenie i czynsz (2026-09-10)

- Zakres: usunięcie dolnej „Próby”, połączenie nazwy, paska i cen we wspólnym bloku; nowe przekroje wykończenia oraz miesięcznego czynszu.
- [x] Jedna ramka na grupę, pojedynczy licznik ofert u góry; szczegóły liczby ofert z ceną w dymku licznika. Dodano grupy stanu i czynszu z osobnymi brakami danych, wspólnym zakresem dat i filtrami.
- [x] Nowe przekroje korzystają z pól portali i opisów, rozdzielają brak danych od deklarowanego 0 zł, nie interpretują zakresów ani opłat rocznych/za m² jako kwoty miesięcznej. Mediany i kwartyle nadal opisują ceny zakupu za m²; wyjaśniono to w UI i instrukcji.
- [x] Testy klasyfikacji, granic czynszu, braków, interpolacji kwartylów i małych prób poprawne. Pełny typecheck i testy: 148 API + 85 frontend, 2 testy środowiskowe pominięte; build i wdrożenie Docker poprawne.
- [x] Rzeczywiste dane: obydwa przekroje obejmują 4821 ofert dla 90 dni i 439 po zmianie na 30 dni oraz 80–100 m², zgodnie z pozostałymi segmentami. Całe zapytanie statystyk 6,2 s przy pierwszym odczycie i 1,1 s przy kolejnym filtrowanym.
- [x] Chromium 1440/1280/390/320 px: 7 kart, 32 wspólne bloki, brak dolnej „Próby”, overflow i błędów JS. Obejrzano desktop/mobile oraz całą kartę czynszu w ciemnym motywie.
- Pozostałe prace funkcjonalne: brak; publikacja na bieżącej gałęzi.

## Przedziały metrażu i podsumowanie segmentów (2026-09-10)

- Zakres: wyjaśnienie granic metrażu i poprawa wyglądu mediany, kwartylów oraz liczby ofert.
- [x] Potwierdzono warunki SQL `< 40`, `< 60`, `< 80`, `< 100`: 59,4 i 59,9 należą do grupy od 40 do poniżej 60, bez zaokrągleń i luk.
- [x] Podsumowanie segmentów ma wyróżnioną medianę, osobny zakres środkowych 50% oraz oddzieloną próbę; semantyczne etykiety i responsywne zawijanie.
- [x] Etykiety `40–<60`, `60–<80`, `80–<100 m²` i wyjaśnienie granic w UI oraz instrukcji. Faktyczny fragment SQL sprawdzony w PostgreSQL na 11 wartościach, w tym 59,4/59,5/59,99/60 oraz null; wszystkie poprawne, bez zmiany danych.
- [x] Build i wdrożenie Docker poprawne. Chromium 1440/1280/390/320 px: 23 podsumowania bez overflow i błędów JS; etykiety poprawne. Obejrzano desktop, mobile i ciemny motyw.
- Pozostałe prace funkcjonalne: brak; zmiana przygotowana do commita i push na bieżący branch.

## Czytelny wzrost ceny (2026-09-10)

- Zakres: znak plus przed procentem podwyżki i wyraźnie czerwone oznaczenie.
- [x] Dodatnie zmiany ceny pokazują `+X%` w czerwonym znaczniku; „Nowa cena” przy podwyżce ma mocniejszą czerwień. Procent nie zawija się na małych ekranach.
- [x] Build i wdrożenie Docker poprawne; Chromium 1440/1280/390 px potwierdza `+5.2%`, `-3.1%` i `0%`, czerwony kolor wzrostu, brak zawijania procentu, overflow i błędów JS. Obejrzano widok mobilny. Dane testowe podstawione tylko w odpowiedzi przeglądarki, bez zmian bazy.
- Pozostałe prace funkcjonalne: brak; zmiana przygotowana do commita i push na bieżący branch.

## Automatyczny commit i push po poprawkach (2026-09-10)

- Zakres: stała zasada publikowania ukończonych zmian na bieżącej gałęzi oraz publikacja ostatniej poprawki przystanków.
- [x] Dodano do `AGENTS.md` obowiązek weryfikacji, commita i push przed zgłoszeniem zakończenia, bez osobnej prośby użytkownika. Prywatne i lokalne dane pozostają poza commitem.
- [x] Zakres publikacji obejmuje zasadę, mniejsze kropki, kolorowanie przystanków wybranej trasy i dokumentację. Build i kontrola UI przystanków opisane poniżej.
- Pozostałe prace funkcjonalne: brak; publikacja na bieżącej gałęzi `main`.

## Kropki przystanków tramwajowych (2026-09-10)

- Zakres: mniejsze przystanki i kolor wybranej linii także na jej przystankach.
- [x] Wspólny promień 4 px na mapie głównej i mapie oferty; przystanki wybranego numeru mają ten sam różowy kolor co trasa, pozostałe pozostają niebieskie. Powrót do wszystkich tras przywraca kolor.
- [x] Obszar trafienia Canvas powiększony o 6 px, aby mniejsze kropki nadal można było wygodnie wybierać na telefonie.
- [x] Build frontendu i wdrożenie Docker poprawne. Chromium 1440/1280/390 px: promień 4 px, kliknięcie 7 px od środka otwiera przystanek, wybór linii 1 koloruje wszystkie jej 94 przystanki tak jak trasę, reset przywraca niebieski. Bez błędów JS i overflow; obejrzano desktop/mobile.
- Pozostała praca: brak. Zmiana wdrożona lokalnie.

## Publikacja zmian na GitHub (2026-09-10)

- Zakres: autoryzowany commit i push na `origin/main` — aktualizacja README, lokalne dane transportu i naprawa detekcji archiwizacji OLX.
- [x] Sprawdzono zakres plików; wyniki testów, builda i kontroli UI opisano poniżej. Dane użytkownika, `.env`, `storage/` i `.local/` pozostają poza commitem.
- Pozostałe prace funkcjonalne: brak; publikacja przygotowana na bieżącej gałęzi `main`.

## Lokalny transport na mapie i wskazana oferta OLX (2026-09-10)

- Zakres: mapa bez oczekiwania na pobranie tramwajów, lokalna geometria torów i przystanki kolei, diagnoza oferty OLX `olx-1cgiQn`.
- [x] Diagnoza: tramwaje czekają na odnowienie cache po 6 godzinach; kolej odpytuje Overpass przy każdym otwarciu, a fallback łączy stacje prostymi poza torami.
- [x] Dołączono wspólny zestaw OSM: 1297 odcinków torów tras pasażerskich, 150 stacji, 26 numerów tramwajów i 599 przystanków. Obie mapy działają bez zapytań transportu; kolej to jedna warstwa torów bez schematycznych prostych. Generator i opis źródeł w repozytorium.
- [x] OLX: status „completed” ukrywał pominięcie `unavailableBeforeImport`; wskazany link nie był zapisany. Przyczyna: komunikat archiwizacji w słowniku tłumaczeń JavaScript aktywnej strony. Detekcja pomija skrypty, style, komentarze i atrybuty; OLX raportuje HTTP 403/429/5xx jako błędy.
- [x] Rzeczywista strona OLX: HTTP 200, aktywna oferta, 85 m², 4 pokoje, 1 499 000 zł, 8 zdjęć. Znaleziono 30 pominiętych pozycji do ponownego sprawdzenia.
- [x] Typecheck poprawny; 145 testów API i 85 frontendu przechodzą, 2 testy środowiskowe API pominięte. Regresje słownika OLX, prawdziwej archiwizacji i transportu bez sieci.
- [x] Końcowy zestaw pasażerski przeszedł test offline; build i wdrożenie Docker zakończone. Chromium 1440/1280/390 px: gotowa mapa w 1,2–1,3 s, filtry 54/49/30 ms, zero zapytań transportu, działa przesuwanie, brak błędów JS i overflow. Obejrzano mapę na podkładzie OSM oraz mapę oferty na 390 px.
- [x] Ponownie sprawdzono 30 pominiętych i 121 starszych zarchiwizowanych pozycji OLX. Wszystkie 151 zadań zakończone bez błędów: 77 aktywnych ofert przywróconych/pobranych, 73 rzeczywiście usunięte, jedna niedostępna przed importem. Wskazana oferta aktywna, niescalona i nieukryta; HTTP 200 szczegółów, 8 zdjęć i widoczność w UI potwierdzone.
- [x] Dokumentacja użytkowa i źródła danych zaktualizowane; formatowanie oraz `git diff --check` poprawne.
- Pozostała praca w tym zakresie: brak. Kafelki podkładu nadal pobierane z OSM; lokalne są warstwy transportu.

## Aktualizacja instrukcji uruchamiania (2026-09-10)

- Zakres: README zgodne z obecnym uruchamianiem aplikacji przez Docker.
- [x] Docker Desktop, start w tle i port 8080 jako główna ścieżka; aktualizacja, zatrzymanie, logi, trwałość danych i lokalny override.
- [x] Opisano tryb `docker:dev`; start bez kontenerów na 5173 pozostaje alternatywą. Uporządkowano sekcję alternatywną w instrukcji startu i doprecyzowano restart kontenerów.
- [x] Polecenia i zachowanie porównano z package.json, skryptami startowymi, Dockerfile i plikami Compose.
- [x] Prettier i `git diff --check` poprawne; lokalne odnośniki prowadzą do istniejących plików, nowe kotwice odpowiadają nagłówkom instrukcji.
- Pozostała praca: brak. Zmiana dokumentacji; bez uruchamiania aplikacji ani modyfikacji danych.

## Wydajność mapy i transport (2026-09-09)

- Zakres: przyspieszenie mapy przy wielu ofertach, lżejsze podglądy, naprawa tramwajów i przełącznika filtrów; korekta nowych stacji M2 oraz przebiegów M4/M5 według źródeł internetowych.
- [x] Diagnoza: wszystkie warstwy są przebudowywane przy zmianie filtrów ofert; tramwajowy Overpass pobiera tylko przystanki, bez relacji i geometrii tras; CSS filtrów nadpisuje stan zamknięty.
- [x] Oddzielono warstwę ofert od transportu, dodano grupowanie według widoku mapy, podglądy tworzone przy najechaniu, miniatury WebP 384×240 z cache i listę po 50 ofert. Naprawiono przełącznik filtrów na desktopie/mobile.
- [x] Tramwaje: zapytanie o relacje i geometrię, zapasowy serwer, cache dyskowy i współdzielenie pobrania, komunikat błędu/ponowienie. Wspólne odcinki torów są rysowane tylko raz. Potwierdzono pełną odpowiedź zapasowego Overpass (5,6 MB); główny serwer miał timeout połączenia.
- [x] Współrzędne trzech budowanych stacji M2 z obiektów OSM; orientacyjne punkty kolejnych trzech stacji M2, 23 stacji M4 i 20 M5 na podstawie plansz. Dane dołączone do repozytorium, wspólne dla mapy głównej i oferty; źródła oraz oznaczenie niepewności w dymkach i dokumentacji. M1/M3 zachowane.
- [x] Wstępne testy: 141 API + 80 frontend, typecheck; Chromium 1440/390 px: przełącznik działa, brak błędów JS i overflow, zamiast tysięcy znaczników 270/203 łącznie z transportem.
- [x] Dane metra M1/M2/M3 i 28 stacji WKD z odgałęzieniem do Milanówka są częścią aplikacji, niezależnie od bazy ofert. WKD ma zweryfikowane współrzędne OSM i nie znika przy częściowej odpowiedzi warstwy kolejowej.
- [x] Końcowe sprawdzenie: typecheck i build Docker poprawne; 142 testy API oraz 85 frontendu przechodzą (2 testy API pominięte). Chromium 1440/1280/390 px, 3038 ofert: 280/271/110 grup, filtr 45/47/34 ms, brak błędów JS i przepełnienia. Przełącznik filtrów i dymki źródeł metra działają; miniatura WebP 384×240 ma 7920 B w sprawdzonym przykładzie. Endpoint tramwajów: 64 relacje tras, 662 przystanki, cache 50 ms. Obejrzano zrzuty desktop/mobile.
- [x] Wdrożono API i frontend w lokalnym Dockerze. Zakres gotowy do commita i autoryzowanego push na main.

## Sortowanie za m² i wyrównanie filtrów (2026-09-09)

- [x] Dodano cenę za m² rosnąco/malejąco w formularzu, zapisie sesji, walidacji API i sortowaniu całego zbioru przed paginacją. Obliczenie z aktualnej ceny i metrażu, braki na końcu, stabilne rozstrzyganie remisów.
- [x] Usunięto desktopowe przesunięcie panelu filtrów `top: 82px`; dodano 32 px marginesu i paddingu na dole oraz ograniczenie wysokości pozostawiające miejsce pod panelem.
- [x] Wszystkie 12 dropdownów korzysta ze wspólnego komponentu Select: filtry, kredyt, ustawienia, mapa, duplikaty i szczegóły ofert. Wspólne menu, klawiatura, pozycjonowanie na małych ekranach oraz obsługa pól/opcji nieaktywnych.
- [x] Typecheck, build Docker i testy bez błędów: 138 API + 78 frontend, 2 testy zależne od środowiska pominięte. API: po 60 ofert na dwóch stronach dla obu kierunków ceny/m², prawidłowa kolejność i brak powtórzeń.
- [x] Chromium 1440/1280/390 px: różnica górnych krawędzi paneli 0 px, margines/padding filtra po 32 px, oba sortowania w menu. Dropdowny kredytu i ustawień działają z klawiaturą i mieszczą się w ekranie; dodatkowo mapa, duplikaty oraz notatki oferty na mobile. Obejrzano zrzuty scenariusza banku i ciemnego menu szczegółów. Brak natywnych selectów i błędów JS w sprawdzonych widokach.
- [x] Wdrożono lokalnie na 8080; końcowe zmiany przygotowane do publikacji na main.

### Różnica liczników ofert i statystyk

- [x] Potwierdzono różne zakresy: statystyki wymagają dolnego limitu ceny i minimalnej liczby pokoi, dashboard zachowuje tańsze oraz niepełne oferty. Bieżący odczyt: 2935 ofert w statystykach, dodatkowo 104 poniżej minimum ceny i 4 bez liczby pokoi. Dane zmienia automat.
- [x] Doprecyzowano podpis KPI statystyk, bez zmiany zakresu lub usuwania ofert.

## Dostępność przycisku Filtruj (2026-09-09)

- [x] Usunięto pole miasta z filtrów ofert i przywracanie starego miasta z zapisanych filtrów. Miasto nadal pochodzi z preferencji pobierania.
- [x] Dodano dolny odstęp pod przyciskami: desktop 24 px, mobilnie 28 px plus bezpieczny obszar ekranu; usunięto ujemne przesunięcie mobilnej stopki.
- [x] Build Docker i 78 testów frontendu poprawne, wdrożono na 8080. Chromium 1440×900, 1280×720, 390×844 i 320×568: brak pola miasta, przycisk klikalny, zapas 43–45 px pod przyciskiem. Obejrzano zrzut mobilny; kod przygotowany do publikacji na main.

## Brak ofert po obniżeniu metrażu do 53 m² (2026-09-09)

- [x] Sprawdzono import-failures.ndjson, zapisane kryteria i kolejki. Zakres pobierania ma 53 m², automat działa; próba jednej strony ośmiu portali dała odpowiedzi HTTP 200 i dwie nowe pozycje kolejki.
- [x] Przyczyna ukrywania: stały limit 56 m² w liście, mapie i licznikach. W bazie 112 aktywnych niescalonych ofert 53–56 m² spełnia pozostałe warunki widoczności.
- [x] Lista, mapa i liczniki korzystają z zapisanego miasta, minimalnego metrażu oraz maksymalnej ceny. Usunięto dawne stałe 56 m² i 2,2 mln zł. Zapis preferencji odświeża też aktywną mapę.
- [x] Poprawiono stałe kryteria w adresach portali (metraż, cena, pokoje), normalizację minimum 0 oraz zgłaszanie HTTP błędów zamiast pozornego zera wyników. Gratka nie otrzymuje błędnego `page=1`; próba wszystkich 8 portali po poprawce dała m.in. 14 nowych pozycji kolejki Gratki.
- [x] Wielokrotny wybór dzielnic Warszawy i zapis w ustawieniach. Otodom/Adresowo/Domiporta/Maxon zbiorczo, Morizon/Gratka po 3, OLX/Nieruchomości-online po jednej, osobna paginacja grup, deduplikacja kolejki i kontynuacja po błędzie grupy.
- [x] Zweryfikowano na portalach katalogi Morizon, OLX, Nieruchomości-online i Adresowo. Otodom wymaga podwójnego myślnika w nazwach obu Prag. Domiporta obsługuje Id i pełne Name, Ochota ma Id 70026.
- [x] 139 testów API i 78 frontendu, typecheck i build Docker poprawne. Formularz: 320/390/1280/1440 px, 18 opcji, zapis 4 dzielnic przechwycony testowo bez zmiany preferencji użytkownika, brak przepełnienia i błędów JS. Obejrzano zrzuty desktop/mobile.
- [x] Lokalna aplikacja: zakres 53–55,99 m² zwraca HTTP 200 i 117 ofert przy zapisanym maksimum 2 mln zł. Ustawienia nadal: minimum 53 m², cena 895 tys.–2 mln zł, 3 pokoje, brak wybranych dzielnic.
- [x] Sprawdzono rzeczywiste wygenerowane adresy: 6 portali HTTP 200 w końcowej kontroli; Otodom i OLX blokowały klienta Playwright HTTP 403, wcześniejsze odczyty właściwymi fetcherami potwierdziły działanie lokalizacji. Te błędy są raportowane, nie zamieniane na zero ofert.
- [x] Naprawiono również format paginacji Nieruchomości-online oraz użycie dedykowanego statycznego fetchera Gratki (obsługa jej błędów TLS na Windows).
- [x] Końcowy kod przygotowany do publikacji na `main`; build Docker uruchomiony lokalnie na 8080, kontrola zmian bez błędów whitespace.
- Ograniczenia opisane w instrukcji: Adresowo nie udostępnia Wesołej w katalogu Warszawy; lokalne przedziały ceny/pokoi portali mogą być szersze niż zadane minimum. Istniejące oferty nie są usuwane po wyborze dzielnic.

## Wygląd podsumowania kredytu (2026-09-09)

- Zakres: dopasowanie sekcji „Kredyt i efekt nadpłat” do pozostałych paneli, bez zmiany obliczeń.
- [x] Nagłówek i kompaktowe dane wejściowe, tabela z wyróżnioną kolumną po nadpłatach i łączną spłatą, wspólny panel oszczędności oraz dyskretna stopka.
- [x] Build Docker poprawny, wdrożono na 8080. Chromium 1440/1280/390/320 px w jasnym i ciemnym motywie: bez przepełnienia strony i komórek kwot, wartości zachowane, pojedyncze podsumowanie oszczędności. Obejrzano zrzuty desktop/mobile.
- Pozostała praca w tym zakresie: brak. Zmiana wyłącznie prezentacji; obliczenia bez zmian.

## Mobilne zamykanie oferty i układ Kredytu (2026-09-09)

- Zakres: usunięcie szerokiego tła przy X i kolizji z zakładkami, formularz kredytu na górze w poziomie, domyślne zwolnienie PCC, jedno podsumowanie spłaty i usunięcie opłaty konta/karty.
- [x] X ma przezroczystą otoczkę 44 px; zakładki rezerwują miejsce po prawej. Formularz kredytu przeniesiono nad koszty, z poziomymi polami na desktopie i siatką mobilną. Jedno porównanie spłaty zastąpiło powtarzające się podsumowania; usunięto opłatę konta/karty również z obliczeń.
- [x] Zwolnienie PCC domyślnie aktywne dla nowych ustawień, zapisane decyzje zachowane. Instrukcja obsługi zaktualizowana.
- [x] Testy frontendu i kompilacja poprawne. Chromium 1440/1280/390: formularz na górze, domyślne PCC i zmiana jego wartości, zapamiętanie decyzji, brak przepełnienia; X i cztery zakładki klikalne bez nakładania. Obejrzane zrzuty desktop/mobile.

## Brakujący moduł po wdrożeniu (2026-09-09)

- [x] Zidentyfikowano fallback Nginx zwracający index.html dla brakujących plików assets. Dodano 404 dla brakujących zasobów i rewalidację cache.
- [x] Globalna obsługa błędów renderowania: przy błędzie modułu jedna automatyczna próba odświeżenia z blokadą pętli przez 60 sekund. Przy braku sieci, blokadzie storage lub kolejnym błędzie widoczny przycisk ponowienia zamiast pustego widoku.
- [x] 78 testów frontendu, w tym regresje błędów importu Chromium/WebKit, limitu odświeżeń, offline i niedostępnego storage.
- [x] Docker wdrożony na 8080. Chromium: celowo zwrócony HTML za moduł SettingsDialog powoduje jedno odświeżenie; ponowna awaria pokazuje przycisk bez pętli; ręczne ponowienie po przywróceniu modułu otwiera ustawienia. Brakujący asset zwraca 404, HTML ma no-cache. Obejrzano widok błędu na telefonie.
- [x] Końcowa kontrola kalkulatora i przycisku X na 640/390 px: domyślne PCC, zapis wyboru, komplet klikalnych zakładek i brak przepełnienia.
- Zakres synchronizacji z GitHub: komplet powyższych zmian oraz wcześniejsza regresja tarasu; bez plików lokalnych i danych użytkownika.
- Pozostała praca funkcjonalna w tym zakresie: brak. Stare karty sprzed wdrożenia ochrony wymagają jednego ręcznego odświeżenia, aby pobrać tę poprawkę.

## Podświetlanie „mieszkanie posiada taras” (2026-09-09)

- [x] Przyczyna: wzorzec negacji dopasowywał końcówkę „nie” w słowie „mieszkanie”, tworząc fragment „nie posiada taras”. Dodano granicę słowa do negacji udogodnień i miejsc postojowych.
- [x] Dodano regresje dla tarasu, balkonu, garażu i miejsca postojowego oraz prawdziwych negacji, wielkich liter i zachowania pełnego tekstu.
- [x] 76 testów frontendu przeszło, build Docker i wdrożenie na 8080 poprawne. Chromium 1440/1280/390 z kontrolowanym opisem: taras pozytywny, prawdziwe „nie posiada garażu” negatywne, brak przepełnienia. Bez zmian danych ofert.
- Pozostała praca w tym zakresie: brak.

## Synchronizacja kodu z GitHub (2026-09-09)

- Zakres: commit i push bieżących poprawek na `origin/main`.
- [x] Zweryfikowano zakres: interfejs Aktualizacji, przywracanie przewinięcia, reguła duplikatów, regresja PostgreSQL oraz dokumentacja i zasady pracy.
- [x] Weryfikacja funkcjonalna opisana poniżej: testy API/frontendu, PostgreSQL, build i kontrola UI. Pliki lokalne, konfiguracja prywatna i dane nie są częścią commita.
- Pozostałe prace funkcjonalne: wyłącznie wskazana poniżej obserwacja Safari.

## Wyjaśnienie trwałości rozłączenia duplikatów (2026-09-09)

- [x] Sprawdzono rozłączanie i oba automaty łączenia: rozłączenie zapisuje `different_listing` względem wszystkich pozostałych członków grupy; import i skan pomijają odrzucone pary, również przy progu 25 słów.
- Weryfikacja: odczyt implementacji, bez zmian danych. Wykluczenie dotyczy konkretnych identyfikatorów ofert; nowy rekord ogłoszenia nie dziedziczy go automatycznie. Pozostała praca w zakresie odpowiedzi: brak.

## Aktualizacja, powrót do karty i duplikaty (2026-09-09)

- Zakres: ciaśniejszy ekran Aktualizacji, weryfikacja utraty ogłoszenia/przewinięcia po powrocie do Safari, wskazana para duplikatów i próg 25 słów.
- [x] Dodano do AGENTS zasadę krótkich, celowanych odczytów i ograniczania logów narzędzi.
- [x] Aktualizacja: status portali w automatycznym odświeżaniu, usunięte odziedziczone marginesy paneli 32 px, odstępy między sekcjami 10 px, ciaśniejsze kroki i nagłówek kolejki na desktopie i telefonie.
- [x] Odtworzono utratę przewinięcia po przeładowaniu karty (1800 → 0). Przywracanie czeka na dane i lazy widok; fokus okna ładowania nie przewija strony. Po poprawce 1800 → 1800.
- [x] Chromium: powrót z innej karty i przeładowanie z otwartą ofertą na drugiej stronie zachowują ofertę, stronę i przewinięcie. Nie potwierdzono samoczynnego zamknięcia ogłoszenia; fizyczny iPhone/Safari niedostępny.
- [x] Para 3755419e-b80f-4fae-84be-7ac9bf8b3ff3 / 8d807881-8f0d-4665-972a-4a3896a81577: wspólne 65 słów, oba Otodom. Przyczyną była blokada jednego portalu. Połączono transakcyjnie wskazaną parę; usunięto blokadę dla reguły prefiksu w imporcie i skanowaniu, próg 25 słów. Odrzucone pary nadal pomijane.
- [x] Weryfikacja: 130 testów API i 75 frontendu, typecheck/build; dodatkowa regresja PostgreSQL na tabelach tymczasowych: 24 słowa nie łączą, 25 łączy ten sam portal, ponowienie nie dubluje grupy.
- [x] Chromium 1440/1280/390: odstępy przed i po krokach 10 px, status we wspólnej sekcji, brak przepełnienia i błędów JS; obejrzane zrzuty desktop/mobile. Wdrożono Docker na 8080, istniejąca baza zachowana.
- Pozostałe: potwierdzenie zgłoszonego zamykania ogłoszenia na fizycznym Safari; nie odtworzono w dostępnej przeglądarce. Nie uruchamiano masowego łączenia całej bazy.

## Uproszczenie szczegółów i wyszukiwania (2026-09-09)

- [x] Szczegóły oferty: poprawna etykieta, działka na dole, telefon w notatkach, bez celu negocjacji w przeglądzie i bez sekcji przygotowania do rozmowy.
- [x] Mapa pod opisem na telefonie, mniejsze odstępy opisu, bez powtórzenia raty w opisie oceny.
- [x] Wyszukiwanie po ulicy i jej odmianach; estetyczne dropdowny filtrów/sortowania; usunięty powtórzony checkbox ulubionych.
- [x] Gabinet usunięty z punktacji i zasad, z regresją dla synonimów.
- [x] Punktacja: zakup do 7% ponad limit −5, ponad 7% −15; cena/m² przy limicie +10, proporcjonalnie do +20 przy 25% obniżce, przekroczenia −5/−10. Drugie piętro +2; nieznany stan wykończenia 0. Jasny opis prowizji.
- [x] Metro powyżej 150% limitu −3, metraż ponad 5 m² poza zakresem −3, dojazd ponad 18 km lub bez danych −5 (stałe maksimum 12). Południe jednostronne +4; E/W dwustronne premia +10, łącznie 20. Parking +8 i osobna kara za brak garażu zachowane zgodnie z potwierdzeniem użytkownika.
- [x] Tabela oceny: trzy kolumny, punkty z maksimum w nawiasie, krótkie powody, wiek w dniach, przedział dojazdu i raty. Bez słowa „dalej” w zasadach.
- [x] Podświetlanie piętra: „Liczba pokoi: 3 Piętro: 1/7” zaznacza właściwe piętro, bez przechwytywania liczby pokoi. Regresje z dwukropkiem, bez niego i w dwóch liniach.
- [x] Typecheck poprawny; 130 testów API, 75 testów frontendu oraz osobno integracja PostgreSQL na tabelach tymczasowych (wyszukiwanie ulic/odmian, statystyki, duplikaty). Standardowy zestaw pomija integrację bez TEST_DATABASE_URL.
- [x] Chromium 1440/1280/390: szczegóły, notatki, trzy kolumny oceny, mapa pod opisem na telefonie, działka na dole, dropdowny/klawiatura i filtr ulicy. Zero błędów JS/HTTP 500 i przepełnienia panelu. Obejrzane zrzuty tabeli mobilnej i dropdownu desktopowego.
- [x] Końcowy build i wdrożenie obejmują poprawkę podświetlania. API zdrowe, obecna baza zachowana; ponowna kontrola UI na 1440/1280/390 bez błędów. Zmiany przygotowane do synchronizacji z repozytorium.

## Kafelki i widoczność filtrów (2026-09-09)

- [x] Parter jako 0 / liczba pięter, metraż dzielony z rokiem budowy; brak roku oznaczony kreską.
- [x] Wyraźniejsze przyciski Ulubione / Wszystkie / Tylko ukryte: ikony, wspólna ramka, wypełnienie aktywnego wyboru, aria-pressed, focus i kontrast w obu motywach.
- [x] Typecheck i build Docker poprawne, wdrożenie na 8080. Chromium 1440/1280/390: sprawdzone kafelki i wszystkie trzy przełączniki, zero błędów JS/przepełnienia; obejrzane zrzuty jasnego i ciemnego motywu. Baza zachowana.

## Jakość danych i statystyki — P1 (2026-09-08)

- [x] Adres: odcięcie narracji i normalizacja odmiany ulicy bez utraty numeru; zgłoszona oferta poprawiona w bazie i sprawdzona w API/UI. Kopia przed zmianą.
- [x] Braki z potwierdzonych duplikatów uzupełniane także po późniejszej zmianie danych źródłowych. Sprzeczne liczby nie są dziedziczone; współrzędne tylko jako jedna zgodna para. Przeliczenie PLN/m² po odzyskaniu metrażu; brak pustych zapisów.
- [x] Gratka: poprawiona granica głównej treści (CSS nie kończy oferty), tabela, wyróżnione parametry i galeria; warianty piętro 3/7, parter/5, parter z 4. Każdy oparty na zanonimizowanym fragmencie archiwum i regresji.
- [x] OLX: parametry bieżącego `ad.ad`, oddzielna cena ofertowa i PLN/m², piętro, mapa, status; odtworzone 121 archiwalnych ofert: 121 cen/metraży/pokoi/lokalizacji/galerii, 115 pięter. Brak aktywnej próbki OLX — weryfikacja dotyczy archiwum.
- [x] Domiporta/Nieruchomości-online: współrzędne z JSON-LD, mikroformatów z przecinkami i własnej mapy portalu; brak łączenia niepełnych par lub pobierania punktów rekomendacji. Regresje na rzeczywistych fragmentach.
- [x] Statystyki: dzielnice i poddzielnice normalizowane przed agregacją, również w sygnałach obniżek; 19 unikalnych grup. Frontend nie uśrednia median aliasów. Segmenty mają liczebność, próg 10 ofert z ceną, medianę i kwartyle 25–75%; małe próby nie uczestniczą w porównaniu/rankingu cen dzielnic.
- [x] Kafelek Pokoje podzielony z Piętrem. „Porównaj” usunięte z kart dashboardu i pozostawione w szczegółach; usunięte nieużywane style przycisku.
- [x] Naprawa istniejących danych bez pobierania z internetu: 697 uzupełnień z archiwum (536 Gratka, 98 Domiporta, 63 Nieruchomości-online) i 156 uzupełnień rekordów z grup duplikatów w kolejnych transakcjach, w tym 14 brakujących lat budowy. Kopie pól przed zapisami w ignorowanym storage.
- [x] Kontrola bazy po naprawie: 0 brakujących pięter w 1473 aktywnych rekordach Gratki; 0 niespójnych cen za m². Pozostałe współrzędne: 1 Domiporta i 2 Nieruchomości-online — archiwum nie zawiera punktu właściwej oferty (w dwóch są tylko inne oferty rekomendowane).
- [x] Testy jednostkowe API/frontendu, dodatkowy test PostgreSQL na tabelach tymczasowych (mediany/kwartyle po scaleniu aliasów, parter, konflikty duplikatów, ceny), typecheck i build. Nowe warianty Gratki sprawdzone osobną regresją po pełnym zestawie.
- [x] Chromium 1440/1280/390: brak przycisku porównania na kartach, dodanie ze szczegółów działa, poprawny adres i kafelek piętra, segmenty z kwartylami; zero błędów JS/HTTP 500 i przepełnienia statystyk. Obejrzane zrzuty telefonu i desktopu.
- [x] Końcowe wdrożenie po ostatnim wariancie Gratki: API zdrowe, istniejąca baza zachowana. Powtórzona kontrola UI na 1440/1280/390, zero błędów i przepełnienia. Kod gotowy do synchronizacji z repozytorium.
- Instrukcje: [naprawa danych i regresje](guides/data-repair.md), [obsługa aplikacji](guides/application.md).

## Pełny audyt i usprawnienia (2026-09-08)

- [x] Audyt ośmiu widoków, aktualizacji, map/porównania/statystyk i responsywności; [raport z priorytetami](audit-2026-09-08.md).
- [x] Przegląd konfiguracji, bieżących Markdownów, zależności, żądań i pozostałości kodu; poprawione instrukcje Docker/LAN/logowania i odwołania do lokalnych artefaktów. 18 Markdownów, brak zepsutych lokalnych linków.
- [x] Audyt kompletności 8436 aktywnych rekordów z siedmiu portali, bez aktywnej próbki OLX. Otodom `ground_floor` poprawione w parserze i odczycie istniejących snapshotów. Pozostałe braki opisane per portal.
- [x] Naprawa globalnej niespójności PLN/m²: zapis `price_only` i odczyt. Backup + transakcja poprawiły 1057 pochodnych wartości, bez zmiany ceny, metrażu i historii.
- [x] Aktualna cena po rozmowie z oznaczeniem „Cena po negocjacjach”, zachowaną ceną portalową, filtrami/sortowaniem, finansowaniem, mapą i porównaniem. Cel negocjacji jest osobną planowaną kwotą. Sukces/błąd zapisu widoczny w UI.
- [x] Blat: granit 8, konglomerat/spiek 7, drewno/naturalny dąb 5; najwyższa premia raz. Synonimy mebli na wymiar i kabin prysznicowych, negacje i imitacje w testach.
- [x] Fraza „BEZPOŚREDNIO OD WŁAŚCICIELI – BRAK PROWIZJI” oraz warianty zero/0 %/zerowa prowizja nie uruchamiają przeciwnej etykiety ani kary. Testy regresji.
- [x] Ochrona ścieżek mediów, asynchroniczne wyszukiwanie zdjęć, mniej pobrań galerii i zbędnych żądań startowych; kompaktowy pierwszy ekran, działające przewijanie i przyciski porównania.
- [x] Opcjonalne lokalne logowanie email/hasło, sesje, cookies, limit prób, kontrola Origin i walidacja URL importu. Domyślnie wyłączone; współdzielona baza, bez zewnętrznych integracji.
- [x] Docker Watch z zachowaniem lokalnego override; sprawdzona synchronizacja Vite i API z restartem serwisu na osobnej pustej bazie/porcie. Poprawione uprawnienia katalogu tymczasowego Vite. PostgreSQL nie jest restartowany przy zmianie kodu.
- [x] 117 testów API i 70 frontendu, build monorepo. Npm audit: 0 podatności zależności npm. Próba ceny po rozmowie na rzeczywistym PostgreSQL (szczegóły, filtry ceny i PLN/m², mapa), wszystkie próbne zapisy wycofane.
- [x] Chromium: osiem widoków 1440/1280/390 px, zero błędów JS i przepełnienia, wybór porównania zachowany po następnej stronie. Login/błędne hasło/logout, ochrona API, HttpOnly/SameSite i link do oferty sprawdzone na 1440/390 px; konta testowe tylko w pamięci.
- [x] Końcowe wdrożenie na 8080 zachowuje dotychczasową bazę/storage. Powtórzony przegląd 8 tras na 3 rozmiarach; zgłoszone oferty mają poprawne ceny i prowizję. Końcowa naprawa uzupełniła 119 wartości powstałych przed wdrożeniem, z osobnym backupem: 0 niespójnych PLN/m² w 12 321 rekordach.
- [x] Końcowe sprawdzenie działających zabezpieczeń: błędny URL importu odrzucony, ścieżki spoza mediów nie ujawniają plików; logowanie i wylogowanie na finalnym buildzie, ciemny motyw 390 px. Formatowanie i `git diff --check` poprawne.

### Kolejna iteracja — plan po audycie

- [ ] P0 przed publikacją: włączyć logowanie i HTTPS, ustawić APP_ORIGIN; konto obecnie daje pełną edycję wspólnej bazy.
- [ ] P1 bezpieczeństwo: pełna ochrona przed SSRF dla przekierowań/DNS/zdjęć; naprawa łańcucha certyfikatów i usunięcie obejść weryfikacji TLS; walidacja wszystkich payloadów API.
- [ ] P1 udostępnianie: rola tylko do odczytu dla rodziny i jawnie zaufane proxy dla limitów logowania.
- [ ] P1 wydajność: profil SQL/tekstu/mediów dla `dream_desc`, jeden zbiorczy status portali, wolniejsze odpytywanie pustej kolejki.
- [x] P1 dane: piętro Gratki na archiwalnym HTML, pokrycie parsera OLX, brakujące współrzędne Domiporta/Nieruchomości-online. Szczegóły i pozostałe braki w sekcji P1 powyżej.
- [x] P1 statystyki: normalizacja dzielnic przed agregacją; usunięte uśrednianie median aliasów w frontendzie. Minimalne próby i kwartyle dla segmentów.
- [ ] P2 UX: mniej oznaczeń na zdjęciach, krótsza Aktualizacja, RCN w opcjonalnym imporcie, utrwalanie porównania po odświeżeniu, trzy stany cech (tak/nie/brak danych).
- [ ] P2 dostępność: Escape po pełnym otwarciu szczegółów (obecnie obsługiwany przy ładowaniu i w galerii), focus trap i powrót fokusu; sprawdzić współpracę z pełnym ekranem mapy/zdjęć.
- [ ] P2 porządek: usunąć martwe stany kontrolera importów i pozostałe typy wycofanego rankingu/RCN dopiero po kontroli zależności; utrzymywane odtwarzanie granic MSI zamiast lokalnego skryptu.
- [ ] P2 jakość analizy: zbiór pozytywnych i negatywnych przykładów opisów; fornir/laminat/lite drewno, zamontowane vs przygotowane instalacje, status prawny parkingu.

## HTTP 500 dashboard po podłączeniu istniejącej bazy do Dockera (2026-09-08)

- [x] Logi potwierdzają wyczerpanie puli połączeń przy równoległym pobieraniu RCN dla dashboardu i listy; błędy także w statusie kolejki.
- [x] Zgodnie z doprecyzowaniem użytkownika usunięto automatyczne porównania RCN z dashboardu, listy i szczegółów ofert, zamiast ograniczać ich równoległość. Usunięto zapytania benchmarku i pobliskich transakcji oraz sekcję w szczegółach. Zapisane dane/import RCN pozostają.
- [x] 110 testów API i build monorepo przechodzą. Rozszerzona regresja na 3000 ofertach potwierdza zero zapytań RCN także podczas pobierania dashboardu i szczegółów.
- [x] Kontenery przebudowane i uruchomione. Równoległe dashboard/lista/ustawienia/alerty/region: HTTP 200. Szczegóły: HTTP 200, 10 zdjęć, brak porównania RCN. Pełne otwarcie strony w Chromium 1440/1280/390: 30 kart ofert, zero HTTP 500, błędów JS i przepełnienia; obejrzany zrzut laptopa.
- Pozostały temat wydajności: pierwszy odczyt `dream_desc` w tej konfiguracji trwał około 24 s, dashboard około 8,7 s przy równoległym obciążeniu. Nie jest to już oczekiwanie na RCN. Naprawa zgłoszonego HTTP 500 zakończona.

## Przywrócenie dostępu do dotychczasowych danych (2026-09-08)

- [x] Zakres: wyjaśnienie pustego localhost po uruchomieniu osobnej kopii Docker i przywrócenie aplikacji z lokalnymi danymi.
- [x] Odczyt PostgreSQL na localhost:5432: baza `mieszkania` zawiera 12 319 rekordów ofert. Porty 5173/3001 nie działały; 8080 odpowiadał z osobną bazą Docker.
- [x] Na wyraźną prośbę użytkownika podłączono aplikację Docker na 8080 do istniejącego PostgreSQL Windows przez `host.docker.internal` i istniejącego katalogu `storage`. Lokalny `compose.override.yaml` jest ignorowany przez Git i automatycznie używany przy zwykłym `docker compose up`.
- [x] Zatrzymano dodatkowy proces `npm run dev`, aby nie działały dwie automatyzacje. Bez kopiowania, kasowania ani migracji dotychczasowej bazy.
- [x] HTTP 200 z `/api/listings`: 3077 ofert w bieżącym domyślnym zakresie, 30 na pierwszej stronie. Sprawdzono zdjęcie i odczyt ustawień przez port 8080. Brak dalszych prac w zakresie przywrócenia danych.

## Kontrola po restarcie i push (2026-09-08)

- [x] Zakres: sprawdzenie gotowości Dockera po restarcie oraz publikacja bieżących zmian kodu na prośbę użytkownika.
- [x] WSL 2 i docker-desktop działają; Docker Engine 29.7.2 odpowiada, Compose 5.5.1 dostępny. `docker compose config --quiet` przechodzi. Rozszerzenia VS Code nie są wymagane.
- [x] Poprawiono błędne separatory poleceń w Dockerfile; dodano instrukcję Compose i poprawiono README.
- [x] Poprawiono brak `tsconfig.base.json` w obrazie, niepełne dane testu, regresję parteru po wzmiance o garażu oraz przekazywanie indeksu `map` jako funkcji zapytania Overpass.
- [x] Weryfikacja: 110 testów API i 67 frontendu; build całego monorepo wewnątrz obrazu Linux. Trzy kontenery healthy, HTTP 200 dla strony/API, świeża baza bez ofert i adresów pracy.
- [x] Osobny projekt `mieszkania-check`, port 18080, automatyczne importy wyłączone. Znaczniki w PostgreSQL i storage przetrwały `--force-recreate`. Lokalna baza Windows i lokalne storage nie są podpięte do Compose.
- [x] Chromium 1440/1280/390 px: bez błędów JS i przepełnienia strony; obejrzany mobilny zrzut. Aktualizacja instrukcji startu i punktacji; przygotowany zakres commitu obejmuje bieżące zmiany aplikacji i Docker, bez danych lokalnych.
- Dalszy temat: dostęp taty przez internet. Wyjaśniono darmowy Quick Tunnel bez domeny; aplikacja nie ma logowania, przed publikacją potrzebna ochrona dostępu. Tunelu nie uruchamiano.
- [x] Na prośbę użytkownika dodano dostęp Compose po lokalnym IP (port 8080, konfigurowalny adres nasłuchu) i instrukcję działania w tle; uruchomienie używa osobnej bazy, bez migracji lokalnych ofert.

## Diagnostyka startu Dockera (2026-09-08)

- [x] Sprawdzono status poza sandboxem: WSL nie jest zainstalowany, HypervisorPresent=False. Użytkownik potwierdza włączoną wirtualizację w Menedżerze zadań.
- [x] Przekazano instrukcję instalacji WSL bez dodatkowej dystrybucji i restartu; bez zmian BIOS ani konfiguracji systemowej przez agenta.
- [x] Po restarcie uruchomiono Compose na osobnej bazie i wolumenach; wyniki w sekcji powyżej.

## Kategorie zasad punktacji i publikacja zmian (2026-09-08)

- [x] Panel zasad podzielony na Koszty, Lokalizację, Układ, Budynek i Wykończenie; przełączniki z ikonami, karty kryteriów i oznaczenia punktów bieżącej oferty. Panel umieszczony nad tabelą.
- [x] Playwright: wszystkie kategorie zawierają dokładnie raz każde kryterium; przełączanie i brak przepełnienia na 1440/1280/390 px. Obejrzane zrzuty laptop/telefon.
- [x] Pełne testy: 108 API + 64 frontend, bez błędów. Build przechodzi. Przygotowany zakres commitu: całość zmian punktacji z tej sesji, odczyt pól Otodom, usunięcie weights i zakładka Ocena. Wysyłka do origin/main zgodnie z poleceniem użytkownika; bez storage, .env i .local.

## Wynajem co najmniej dwóch miejsc parkingowych (2026-09-08)

- [x] Zakres i implementacja: dodatkowe −5 pkt za wynajem/dzierżawę lub miesięczny koszt co najmniej dwóch miejsc; zachowane +5 za liczbę miejsc.
- [x] Osobny wiersz i zasada w zakładce Ocena; dokumentacja oraz test cytatu użytkownika, odmian, negacji i ceny zakupu. Układ tabeli pozostaje responsywny.
- [x] Weryfikacja: 13 testów punktacji, pełny zestaw API/frontend, build i formatowanie poprawne.

## Zakładka Ocena, finansowanie i dane Otodom (2026-09-08)

- [x] Usunięte nieużywane weights/maxWeightTotal z typu, domyślnych ustawień i walidacji; migracja starych zapisów przy odczycie zachowuje pozostałe preferencje.
- [x] Nowe punkty: brak balkonu −8 przy włączonej preferencji, brak roku −3, prysznic +3, brak kwoty czynszu −2, najwyższe piętro dodatkowe +3.
- [x] Rata uwzględnia zapisany wkład, całkowitą cenę nabycia oraz założenia podglądu 5,8%/360 rat. Ponad 7500 zł −10; poniżej liniowe 0–10 pkt. Cache uwzględnia finansowanie.
- [x] Wspólne obliczenia zwracają pełne rozbicie z zasadami; czwarta zakładka Ocena i przycisk zasad, tabela przewijana lokalnie na telefonie.
- [x] Otodom: odczyt stanu wykończenia i czynszu z siatki pól; strukturalne cechy dostępne przed globalnym sortowaniem i w szczegółach. Naprawiony odczyt metrażu z kropką dziesiętną.
- [x] Testy nowych reguł, sumy tabeli, zależności od wkładu, migracji ustawień i pól Otodom. Pełny zestaw testów przeszedł; końcowa weryfikacja zachowanych testów ustawień i typów poniżej.
- [x] Playwright: zakładka, rozwijanie zasad i brak przepełnienia dla 1440/1280/390 px; usunięte 4 px przepełnienia starego mobilnego paska zamknięcia. Obejrzane zrzuty laptop/telefon.
- [x] Końcowy build przechodzi; zachowane wcześniejsze testy ustawień i nowy test migracji (5/5). Playwright ponownie przechodzi dla 1440/1280/390 px po ustawieniu mobilnych zakładek 2×2.
- [x] Lokalna baza/API i kopia family-settings nie zawierają już weights/maxWeightTotal. Ranking HTTP 200 i zgodność wyników API ze wspólnym algorytmem (pierwszy odczyt około 7,1 s). Kontrola diff bez błędów. Brak pozostałych prac w tym zakresie.

## Materiały, stolarka, parking i stan deweloperski (2026-09-08)

- [x] Zakres: blaty ze spieku/granitu/konglomeratu +8, deska dębowa w premii drewnianej podłogi +6, co najmniej dwa miejsca parkingowe +5, stolarka na wymiar +5.
- [x] Wspólne rozpoznawanie odmian w opisach, deduplikacja premii i sprawdzenia negacji/imitacji; progi cenowe zastępują −10 za stan do wykończenia.
- [x] Dokumentacja progów i granic. Zmiana dotyczy obliczeń, bez zmian układu PC/laptop/mobile.
- [x] Weryfikacja: 11 testów punktacji i sortowania przechodzi, w tym nowe odmiany, negacje/imitacje i wszystkie granice progów; pełny build z kontrolą typów, Prettier i git diff --check poprawne. Brak dalszych prac w tym zakresie.

## Wyjaśnienie punktacji wymarzonego mieszkania (2026-09-08)

- [x] Zakres: odczyt i wyjaśnienie aktualnych wag, progów, premii i kar bez zmiany algorytmu.
- [x] Weryfikacja: porównano obliczenia API (`listing-repository.ts`) i frontendu (`dream-profile.ts`); testów nie uruchamiano, ponieważ zadanie dotyczy wyjaśnienia kodu.
- [x] Ustalono, że wagi są zapisane w kodzie, a wynik normalizowany przez zmienną sumę punktów; osobne ustawienia `weights` nie sterują tym wynikiem.
- [x] Poprawiono rozbieżność API/frontend, tolerancję metrażu, respektowanie minimum pokoi, nakładające się premie tekstowe i ograniczenie wyniku do 100%.

## Zmiana punktacji wymarzonego mieszkania (2026-09-08)

- [x] Nowe punkty za komórkę, klimatyzację, podłogę, garderobę, ofertę prywatną i prowizję; 3 pokoje od 75 m² +4 pkt, 4 pokoje pozostają ideałem.
- [x] Nowe przedziały obniżek i wieku oferty; wspólny algorytm w shared, historia cen dostępna przed sortowaniem i stronicowaniem, cache zależny od zdarzenia cenowego i przedziału wieku.
- [x] Przewodnik z progami i zasadami. Zmiana frontendu dotyczy wyłącznie obliczeń; układ PC/laptop/mobile bez zmian.
- [x] Weryfikacja: pełne `npm.cmd test` bez błędów (58 testów frontendu, w tym 7 nowych); regresja API obejmuje zmianę kolejności po obniżce i zgodność ze wspólnym wynikiem. `npm.cmd run build` przechodzi; poprawiono błędną wartość stanu wykończenia w nowym teście wykrytą przez TypeScript.
- [x] Pozostała kontrola: formatowanie zmienionych plików i `git diff --check`; brak dalszych prac w tym zakresie.

## Reorganizacja aplikacji

- [x] Wydzielone komponenty, funkcje pomocnicze, strony i kontroler importów; usunięte martwe widoki i funkcje.
- [x] Routing zakładek, wstecz/dalej, bezpośrednie linki i lazy loading widoków.
- [x] API podzielone na trasy, kolektory, zadania w tle oraz domeny usług.
- [x] Usunięty Docker i martwy kod seedów/ocen; przygotowanie lokalnej konfiguracji, pakietu i bazy.
- [x] Przepisane README i dokumentacja: guides, architecture, reference, archive.
- [x] Końcowe porządki, testy, formatowanie, kontrola startu z czystej kopii i przegląd UI.
- [x] Style podzielone na 20 nazwanych modułów z zachowaną kolejnością kaskady; przygotowanie Chromium dla kolektorów.

## Weryfikacja bieżąca

- `npm test`: 97 testów API i 39 frontendu, wszystkie przeszły.
- `npm run build`: cały monorepo przechodzi kompilację i kontrolę typów.
- `npm run format:check`: poprawny format; `git diff --check`: bez błędów.
- `npm audit`: 0 podatności po zgodnych aktualizacjach Fastify, fast-uri i nanoid.
- Czysta kopia bez `.env`, `storage`, buildów i `node_modules`: `npm install --prefer-offline --no-audit` oraz `npm run dev` działają; inicjalizacja osobnej pustej bazy, proxy API 200, zero ofert i zero adresów pracy. Chromium dostępne z lokalnego cache.
- Playwright: 8 tras na obu instalacjach, szerokości 1440/1280/390 px, bez poziomego przepełnienia i błędów JavaScript; odświeżenie tras, 404, wstecz/dalej, szczegóły oferty, galeria i ustawienia.
- API zachowuje 100 tras; usunięty wyłącznie nieużywany `/api/roadmap`.
- Główny pakiet JS około 305 kB (96 kB gzip); mapy, wykresy i widoki są osobnymi pakietami ładowanymi na żądanie. To pomiar rozmiaru, nie obietnica określonego czasu ładowania.
- Środowisko nadal wymaga lokalnego PostgreSQL; npm przygotowuje bazę i Chromium, ale nie instaluje serwera bazy.

## Dalsze tematy

- Zbadać potencjalnie wymieszaną historię dawnych kolizji ID; bieżące identyfikatory są naprawione.
- Zweryfikować historyczne podejrzane dopasowania duplikatów przed zmianą grup.
- Sprawdzić mapy i galerie na fizycznym telefonie oraz obserwować długie partie importu.

Poprzednie ustalenia i wyniki: [archiwum sesji](archive/sessions-through-2026-09-07.md).
Nie powtarzać wykonanych migracji tylko w celu testowania.

## Porównanie, import startowy i instrukcje

- [x] Porównanie jako tabela ze zdjęciami i równymi wierszami; przyciski wyboru na kartach, zachowanie wyboru po paginacji i filtrach.
- [x] Powrót z importu, pobranie/odświeżenie ulic, stan pustego/gotowego katalogu oraz komunikaty powodzenia i błędu.
- [x] AGENTS uzupełniony o aktualny układ plików, dokumentację i reguły UI. Instrukcje startu, obsługi i LAN zgodne z widokami; AGENTS pozostaje w root dla automatycznego wykrywania.

- [x] Użytkownik doprecyzował IP, nie ID. Znaleziono żądania do localhost:3001 przy wejściu przez LAN; dodano wybór proxy i testy regresji.

### Weryfikacja porównania, importu i LAN

- 97 testów API i 43 frontendu przeszły; build całego monorepo poprawny.
- Playwright 1440/1280/390 px: pięć ofert, usuwanie, jasny/ciemny motyw, brak przepełnienia strony; ręczna kontrola zrzutów ekranu.
- Pięć wybranych ofert zachowane po przejściu na następną stronę listy. Przejście między zakładkami przewija na początek widoku.
- Import ulic: rzeczywisty odczyt statusu z lokalnej bazy; stany pusty/gotowy, sukces, błąd i ponowienie sprawdzone z kontrolowanymi odpowiedziami API. Bez uruchamiania masowego importu danych użytkownika.
- LAN: start i status ulic działają przy zablokowanych żądaniach do localhost; zero żądań do loopback z adresu LAN. Sprawdzone także kopiowanie linku przez HTTP i komunikat brakującej oferty.
- Lokalna baza, ustawienia i adresy użytkownika nie są częścią zmian w Git.

## Opisy ofert, otwieranie i preferencje

- [x] Wspólna interpretacja pięter dla importu i istniejących ofert; parter po wzmiance o garażu nie znika. Odmowa współpracy z pośrednikami oznacza sprzedaż bezpośrednią.
- [x] Pytania wynikające z konkretnego opisu, z cytatem i uzasadnieniem; brak pytań o najemców na podstawie komórki lokatorskiej.
- [x] Zamknięcie podczas ładowania anuluje żądania, także analizy i duplikatów; brak spóźnionego otwarcia. Obsługa szybkiego Wstecz/Dalej.
- [x] „Głośność: umiarkowanie ciche” i głośniki nie są oznaczane jako hałas; negacja ma granicę słowa.
- [x] Wkład własny w preferencjach wspólny dla kart, szczegółów i kalkulatora; pozostałe parametry symulacji zapamiętane w przeglądarce.
- [x] Osiem portali korzysta z miasta zapisanego w zakresie ofert; zmiana przez preferencje.
- [x] Ciemne tło otoczek pól w preferencjach zamiast półprzezroczystej bieli.
- [x] 102 testy API i 48 frontendu przeszły. Build monorepo poprawny.
- [x] Playwright: preferencje 1440/1280/390 px, zapis wkładu i miasto w ośmiu żądaniach (mock API, bez zmiany osobistych ustawień); parametry kalkulatora po odświeżeniu. Kontrola ciemnego motywu i braku przepełnienia.
- [x] Testy szybkiego otwierania/zamykania i anulowania żądań na 1440/390 px; rzeczywista oferta przez LAN pokazuje Parter / 3, Wstecz/Dalej działa.
- Pozostała praca w tym zakresie: brak.

## HTTP 500 podczas ładowania mieszkań

- [x] Odtworzono błąd `dream_desc` na 2978 ofertach: timeout puli PostgreSQL w `getRcnBenchmark` przy tysiącach równoległych zapytań.
- [x] Dopasowanie liczone dla wszystkich kandydatów, a RCN, zdjęcia i pozostałe dane pobierane dopiero dla wybranej strony.
- [x] Wszystkie siedem sortowań zwraca HTTP 200; `dream_desc` na lokalnych 2978 ofertach około 4,6 s zamiast HTTP 500 po około 24 s.
- [x] Playwright przez LAN: start z zapisanym `dream_desc`, dwie strony po 30 ofert, stabilna kolejność i brak powtórzeń. Zero żądań importu/aktualizacji; RCN jest wyłącznie odczytywane z lokalnej bazy.
- [x] 103 testy API i build API poprawne; regresja na 3000 ofertach potwierdza odczyt zdjęć i RCN wyłącznie dla wybranej strony.
- Pozostała praca w tym zakresie: brak.

## Filtry statystyk, gesty i dopasowanie — 2026-09-08

- [x] Wpisane i zastosowane filtry statystyk oraz okres zapisane w localStorage; przywracane po odświeżeniu i ponownym otwarciu.
- [x] Scroll oraz pinch na mapie szczegółów; pełny ekran mobilny przez stabilny portal, bez utraty gestów i instancji mapy. Poprawione warstwy przycisków.
- [x] Zdjęcia: pinch 1–5×, przesuwanie powiększonego zdjęcia, dwuklik reset/zoom, przewijanie zdjęć przy skali 1; dopasowanie po obrocie ekranu. Kompas w szczegółach mobilnych mniejszy o 30%.
- [x] Skróty ekspozycji NE/NW/SE/SW rozpoznawane z kontekstu niezależnie od wielkości liter; NE oznacza północny wschód. Opcja wykończenia pod klucz oznacza stan do wykończenia/deweloperski, także przy obliczaniu dopasowania.
- [x] Pamięć wyników analizy dopasowania z ograniczeniem do 5000 ofert. Zmiana treści oferty, preferencji lub roku unieważnia dany wynik. Baza, zdjęcia i RCN nadal odczytywane na bieżąco.
- [x] Ponowny odczyt `dream_desc` na 2978 ofertach około 0,51 s zamiast 5,44 s pierwszego przeliczenia.
- [x] Playwright: zapis filtrów zastosowanych i roboczych po odświeżeniu; gesty CDP powiększania/pomniejszania zdjęć, obrót 390×844 → 844×390, zamykanie; pinch mapy i scroll desktop; pomiar rozmiaru kompasu. Kontrola zrzutów ekranu.
- [x] Testy: 106 API i 51 frontendu, build monorepo. Regresja pamięci dopasowania potwierdza reakcję na zmianę opisu.
- Pozostała praca w tym zakresie: brak. Fizyczny telefon nie był dostępny; gesty i obrót sprawdzone w emulacji Chromium.

### Znaki HTML i błędna ulica

- [x] Dekodowanie popularnych encji HTML, polskich liter, odwołań liczbowych i podwójnego kodowania w tekście ofert. Import i odczyt istniejących ofert; tekst pozostaje tekstem w React.
- [x] Frazy o PCC, VAT i prowizji odrzucane jako kandydaci ulic. Oferta `ec1c9812-60a0-466a-b79f-c89650c3741f` pokazuje `Błonia Wilanowskie, Warszawa`, bez ulicy `bez Pcc`; opis zawiera poprawne `osób` i `Wilanów`.
- [x] Potwierdzono rzeczywistą odpowiedź lokalnego API. Korekta przy odczycie, bez masowego przepisywania bazy ani uruchamiania importów.

## Wyjaśnienie uruchamiania — 2026-09-09

- [x] Zakres: ustalenie komendy codziennego startu i roli Docker Desktop.
- [x] Sprawdzono skrypty npm, pliki Compose i instrukcję startu. Lokalny override korzysta z PostgreSQL Windows i istniejącego storage.
- [x] Przygotowano instrukcję startu w tle oraz wariant obserwowania zmian kodu; bez uruchamiania usług i zmiany konfiguracji.
- Weryfikacja: odczyt konfiguracji; testy nie dotyczą tej odpowiedzi. Pozostała praca: brak.
