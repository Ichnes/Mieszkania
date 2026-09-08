# Bieżące zadania

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
