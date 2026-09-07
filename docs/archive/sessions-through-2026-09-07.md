# TODO — kontynuacja po odświeżeniu VS Code

Stan zapisany: 7 września 2026. Szczegóły poprzedniej sesji: [raport przeglądu](review-2026-09-06.md).

## Do zrobienia

### Rzeczywiste granice poddzielnic na mapie statystyk

- [x] Zastąpić orientacyjne podpisy geometrią 143 obszarów MSI z OSM, lokalny GeoJSON z atrybucją ODbL; bez generowania granic dla nazw portalowych. Uzupełniona Dąbrówka (brak tagu MSI w OSM).
- [x] Dodać przybliżenie wybranej dzielnicy, wybór obszarów z mapy i listy, numery wewnątrz geometrii, obsługę klawiatury i czytelne kolory w obu motywach.
- [x] Wola Grzybowska należy do Wesołej: poprawione przypisanie geometrii oraz matcher nazw (także pełne ciągi lokalizacji). Test regresji, bez automatycznego przepisywania istniejących ofert.
- [x] Sprawdzić geometrię, oba motywy, responsywność i build. 143 geometrie, 18 dzielnic, zamknięte pierścienie, otwory i MultiPolygon; 37 testów frontendu, 90 API; UI 1440/1280/390 px: Wesoła, Mokotów, brak Woli Grzybowskiej na Woli. Szczegóły źródła: [granice MSI](../reference/warsaw-msi-boundaries.md).

### Kolejny punkt — dane startowe

- [x] Usunąć identyczny drugi odczyt 60 ofert z `/api/listings/recent` na starcie i po aktualizacjach; ranking i porównanie korzystają ze wspólnych danych dashboardu. Usunięty także nieużywany pomocniczy licznik oparty na drugiej kopii listy.
- [x] Zweryfikować start, ranking, porównanie oraz oszczędność transferu; endpoint API zachowany dla kompatybilności. Porównanie odpowiedzi przed zmianą: identyczne oferty; dashboard 373 275 B, recent 372 621 B. Oszczędność jednego odczytu i ok. 373 kB nieskompresowanego JSON na cykl; nie jest to pomiar czasu startu.
- [x] Zabezpieczyć równoczesne wywołania `loadInitial` (podwójny efekt React StrictMode). Test `.local/verify-startup-payload.cjs`: jeden dashboard na start, zero `/recent`, dostępne ranking i porównanie, poprawne ponowienie po HTTP 503. Build zaliczony.

### 7 września — poprawki pól i filtrów udogodnień

- [x] Usunąć ciemny pasek wokół etykiety „Miasto” w filtrach dashboardu i jasne tła pól „Sprawdź portale”. Etykiety przezroczyste, pola zgodne z motywem; sprawdzone 1440/1280/390 px w obu motywach.
- [x] Ujednolicić Winda/Garaż w statystykach z cechami kart i ręcznymi korektami; wspólny resolver uwzględnia negacje i brak informacji. Parking zewnętrzny nie oznacza garażu.
- [x] „Najdłużej obserwowane” liczyć względem maksymalnej dostępnej historii aktywnych ofert spełniających filtry, bez progu 60 dni. Próg w pełnych dniach, liczba i udział ofert od tego dnia; sprawdzony rzeczywisty wynik: 41 dni, 531 ofert, 19%.
- [x] Zapisać wyniki testów i bieżący stan TODO. Build zaliczony, 89 testów API i 33 frontendu; test PostgreSQL na tabelach tymczasowych: historia 70/41/0 dni, pusta próba i starsza oferta poza filtrami. Przegląd pól i nowego wskaźnika: oba motywy, desktop/laptop/telefon, bez poziomego overflow i błędów JS. Skrypty: `.local/verify-fields.cjs`, `.local/verify-review-api.ts`; zrzuty: `.local/review-ui/fields-*.png`, `.local/review-ui/history-*.png`.

### Bieżący przegląd — wydajność i czytelność

- [x] Przejść przez główne zakładki, zmierzyć czas odpowiedzi i wskazać kosztowne odczyty. Niewidoczne slajdy galerii powodowały kolejkę żądań zdjęć; teraz karty pobierają wybrane zdjęcie.
- [x] Naprawić limit partii nieruchomosci-online: do 500, rezerwacje po 15 aż do wykorzystania limitu, do 3 pracowników z zachowanym odstępem 5 s. Jedna próba HTTP przy odświeżeniu, najwyżej jeden fallback przeglądarkowy, bez obrazów/fontów w trybie ceny. HTTP 429 kończy pobieranie. Transakcja przejęcia kolejki używa jednego połączenia. Test: partia 200, potem 30 pozostałych; odkładanie po 429.
- [x] Oprzeć statystyki na zapisanych kryteriach: cena 900 tys.–2 mln zł, min. 56 m², min. 3 pokoje (wartości pobierane z ustawień). Dodać medianę ostatniej obniżki, powtarzające się przeceny, udział przecen w dzielnicach oraz zakres historii i aktualność próby.
- [x] Poprawić kompozycję kart duplikatów: wyśrodkowane karty, nagłówki portali, wyróżnienie głównej oferty, pełne zdjęcia, spójne ceny i akcje.
- [x] Poprawić kontrast filtrów ofert w ciemnym motywie: aktywne zakładki, pola, etykiety, checkboxy i znaczniki filtrów.
- [x] Uporządkować legendę mapy; osobne kolory M1–M5 również w rendererze canvas (CSS nie kolorował linii). Planowane odcinki przerywane, rozróżnienie tramwajów i kolei. Leaflet lokalnie w zależnościach, bez CDN.
- [x] Zweryfikować desktop, laptop, telefon, testy i build; uzupełnić wyniki oraz dalsze zadania. 119 testów logiki, test kolejki/statystyk na tabelach tymczasowych oraz przegląd jasnego/ciemnego UI 1440/1280/390 px zaliczone. Szczegóły: [raport wydajności](review-performance-2026-09-06.md).

### Kontynuacja — API i zdjęcia duplikatów

- [x] Przenieść listę do `docs/TODO.md` i zapisać zasadę lokalizacji dokumentacji w `AGENTS.md`.
- [x] Duplikaty: pełne zdjęcia (`object-fit: contain`, wysokość 200 px), kompaktowe kolumny bez rozciągania dwóch ofert na cały ekran. Sprawdzone 1440, 1280 i 390 px, motyw jasny i ciemny.
- [x] Start aplikacji: przycisk ponowienia po błędzie oraz wskazanie endpointu i statusu HTTP. Zasymulowany HTTP 503 dla `/api/alerts`, następnie poprawny start po ponowieniu. W trakcie diagnostyki wszystkie siedem endpointów startowych oraz `/health` odpowiadały HTTP 200; pierwotna awaria nie została odtworzona.
- [x] Otodom: sprawdzone cztery ostatnie błędy (`4CUZW`, `4CUZk`, `4CUXz`, `4CUVG`); ponowne pobrania zwracają HTTP 200 i poprawne ceny. Przy następnym `MISSING_PRICE` zapisujemy odpowiedź gzip w `storage/logs/otodom-responses/`, a w kontekście błędu kolejki status HTTP, finalny URL, rozmiar, checksum i ścieżkę odpowiedzi. Przyczyna historycznych błędów pozostaje niepotwierdzona.

Skrypty kontroli: `.local/verify-startup-duplicates.cjs`, `.local/inspect-otodom.ts`. Zrzuty: `.local/review-ui/duplicates-fixed-*.png`. Build zaliczony; ostrzeżenie o rozmiarze głównego pakietu nadal występuje. Pozostałe zadania poniżej pozostają otwarte.

### Pozostały zakres

- [ ] **Otodom: ustalić przyczynę okresowych błędów `MISSING_PRICE`.** Zacząć od `storage/logs/import-failures.ndjson`, zgodnie z AGENTS.md. Porównać odpowiedź portalu z nieudanego pobrania z poprawną odpowiedzią i sprawdzić, czy problem dotyczy danych, przekierowania czy ograniczenia dostępu. W poprzedniej sesji oferta `otodom-4CUZk` przy ponownym pobraniu zwróciła HTTP 200 i cenę 1 429 000 zł; przyczyna wcześniejszego błędu nie została potwierdzona.
- [x] **Ujednolicić filtry Winda/Garaż w statystykach z kartą oferty.** Wspólna hierarchia danych ręcznych, portalowych i wyciągniętych z opisu, rozróżnienie braku informacji i braku udogodnienia oraz negacje. Bez dodatkowego odczytu cech, gdy filtry są wyłączone.
- [x] **Zmniejszyć początkowy pakiet aplikacji.** Wykresy, Leaflet i renderer znaczników mapy ładowane na żądanie. Główny JS zmniejszony z 1013,12 kB do ok. 464 kB (gzip 297,07 → 132,10 kB), bez ostrzeżenia o przekroczeniu 500 kB. Ikony mapy są generowane raz, zamiast osobno dla tysięcy ofert.
- [ ] **Uporządkować CSS.** Ograniczyć nakładające się reguły i zachować spójność jasnego/ciemnego motywu oraz widoków desktop, laptop i telefon.
- [ ] **Zbadać błędne dopasowania duplikatów.** Podczas przeglądu zauważono grupę z ofertą ok. 58 m² i ogłoszeniami ok. 28 m². Sprawdzić źródło dopasowania, historyczne zmiany i ewentualne rekomendacje portalu w parserze; nie rozłączać automatycznie bez potwierdzenia.
- [x] **Ograniczyć powielone dane startowe.** Usunięte pobieranie `/api/listings/recent` z frontendu — odpowiedź zawierała dokładnie te same 60 ofert co dashboard. Usunięte powtórne odświeżanie tej kopii po akcjach oraz równoczesne podwójne ładowanie startowe.
- [ ] **Dalsze odchudzenie startu:** rozdzielić liczniki dashboardu i dane rankingu, aby ranking ładować na żądanie bez zmiany jego zakresu; zmierzyć czas startu na zimnej bazie/cache.
- [ ] **Audyt historycznych przypisań lokalizacji:** sprawdzić istniejące oferty z nazwą „Wola Grzybowska” i dzielnicą inną niż Wesoła. Matcher i mapa są poprawione; nie wykonano masowego przepisywania zapisanych ofert.
- [ ] **Rozwinąć sygnały o konkretne oferty.** Dodać przejście z przecen i wielokrotnych obniżek do listy ofert, z zachowaniem analizowanego okresu i kryteriów.
- [ ] **Zmierzyć rzeczywistą długą partię nieruchomosci-online.** Limit 200 sprawdzony na tabelach tymczasowych; pełna partia portalu nie była uruchamiana do testu. Zachowany odstęp 5 s oznacza dolną granicę ok. 17 minut dla 200 ofert. HTTP 429 może wydłużyć czas przez cooldown.

## Do sprawdzenia po wznowieniu

- [ ] Obejrzeć nowe widoki w aplikacji i zebrać uwagi do wyglądu.
- [ ] Sprawdzić pełne ekrany map i zdjęć na rzeczywistym telefonie, także po zmianie orientacji. Dotychczasowe testy obejmowały przeglądarkę i zmianę rozmiaru okna.
- [ ] Obserwować aktualizację podczas rzeczywistej dłuższej partii: postęp liczników, pauzę, zakończenie i komunikaty błędów portali.
- [ ] Sprawdzić przykładowe grupy duplikatów i otoczenie z wieloma odcinkami torów. Nie rozłączać poprawnych ofert tylko w celu testowania.

## Już wykonane — nie robić ponownie

- [x] Aktualizacja: usunięte fałszywe przerwanie po 30 sekundach; niezależne odczyty statusów portali, odświeżanie również przy pauzie, czas odczytu i szczegóły błędów.
- [x] Duplikaty: pełne liczniki grup/ogłoszeń/kopii, pobieranie kolejnych grup, filtry, stronicowanie i spójne karty.
- [x] Rozłączanie duplikatów: transakcja na jednym połączeniu, zapis odrzucenia względem pozostałych członków, usuwanie grup jednoelementowych, własne miniatury ofert.
- [x] Otoczenie 50 m: kategorie, tory w jednym rozwijanym wierszu, brak obcinania wyników do 12 obiektów, nowa wersja cache.
- [x] Opisy: pytania do sprzedającego z cytatami o kosztach, stanie, dokumentach, terminie wydania i dostępności budynku.
- [x] Mapy i zdjęcia: pełne ekrany, wariant bez natywnego Fullscreen API, reakcja na zmianę rozmiaru/orientacji, obrót zdjęć o 90°.
- [x] Galeria nie zamyka się po asynchronicznym doładowaniu danych oferty.
- [x] Kredyt: własny profil banku, prowizja, wycena, polisy, konto/karta, porównanie kosztów i pięć scenariuszy oprocentowania. Poprawione strategie nadpłat i przeliczanie rat po zmianie stopy.
- [x] Statystyki: bilans ofert, liczebność próby cenowej, niższe mediany dzielnic przy minimum 10 ofertach i ochrona przed nadpisaniem wyników starszym żądaniem.

## Weryfikacja z poprzedniej sesji

- Zaliczone: 33 testy logiki frontendu, 86 testów API, typecheck i build.
- Zaliczone: widoki 1440×1000, 1280×800, 390×844 oraz zdjęcia/mapy po zmianie do 844×390.
- Zaliczone: symulacja awarii portalu, odświeżania przy pauzie, partii ponad 65 sekund i błędu rozłączania. Żądania zapisu były przechwycone.
- Rozłączanie duplikatów sprawdzone w PostgreSQL na tabelach tymczasowych; test nie zmieniał rzeczywistych grup.
- Skrypty: `.local/review-ui.cjs`, `.local/review-behavior.cjs`, `.local/verify-duplicate-transaction.ts`.
- Zrzuty widoków: `.local/review-ui/`.
- Profile nazwanych banków są przykładowymi założeniami, nie zweryfikowanymi bieżącymi ofertami.

## Jak wznowić pracę

Polecenie dla kolejnej sesji: „Przeczytaj docs/TODO.md i docs/review-2026-09-06.md. Kontynuuj od niewykonanych zadań, zaczynając od błędów Otodom. Zachowaj wykonane zmiany”.

Przed edycją sprawdzić bieżący stan plików i `git status`. W poprzedniej sesji większość projektu była nieśledzona przez Git; nie traktować tych plików jako zbędnych ani nie przywracać ich do innej wersji.

## Bieżąca sesja — udostępnienie i opisy

- [x] Lokalna kopia ustawień w storage/settings, neutralne adresy i nazwy, origin GitHub.
- [x] Nowy ekran startu/błędu, wstępne ładowanie sąsiednich zdjęć, krótsza animacja.
- [x] Parter i odmiany; parking pod blokiem jako naziemny, parking gościnny pomijany.
- [x] Weryfikacja: 94 testy API i 37 frontendu; build i typecheck. UI błędu: 1440/1280/390 px, oba motywy; powrót po 503. Galeria: sąsiednie zdjęcie pobrane przed kliknięciem, zmiana licznika 27–52 ms w lokalnym teście (nie pomiar pełnego czasu dekodowania), brak overflow na trzech szerokościach.
- [x] Wszystkie ustawienia z API zgodne z lokalną kopią sprzed zmian. 159 plików kandydujących do Git bez dokładnych prywatnych nazw/adresów/współrzędnych; `.env`, `storage/`, `.local/` są ignorowane.
- [x] README: uruchomienie dla znajomego, lokalne ustawienia i procedura pierwszego push. Repozytorium podłączone; commit/push pozostawiony użytkownikowi zgodnie z zapowiedzią samodzielnego wysłania.

Notatki: brak potwierdzonego parkingu daje etykietę „Brak miejsca postojowego”, ale nie zapisuje nieznanego stanu jako faktu w bazie. Parking pod blokiem to naziemne miejsce; gościnny sam w sobie nie liczy się. Prywatne miejsce nie oznacza automatycznie garażu. Ręczne potwierdzenie garażu usuwa etykietę braku miejsca. Reguły działają też przy odczycie istniejących opisów — bez ponownego importu ofert.

Kopia sprzed zmian: `storage/settings/app-settings-backup.json`; bieżąca kopia/odtworzenie ustawień: `storage/settings/family-settings.json`. Skrypty QA i zrzuty pozostają w ignorowanym `.local/`. Pozostałe zadania historyczne powyżej nadal aktualne; nie wykonano pełnej semantycznej analizy wszystkich opisów ani testu na fizycznym telefonie.

## Usunięcie ocen i naprawa ID Otodom

- [x] Usunięte ręczne oceny, wagi, ranking, znaczniki punktacji i opcje nawigacji. Pozostawione cechy oferty i niezależne dopasowanie do wymarzonego mieszkania. Brak bieżących zapytań o punktację i endpointów ocen; dane historyczne bez kasowania.
- [x] Wspólna ekstrakcja ID wyłącznie z końcówki ścieżki `-ID…`. Testy „idealny”, „widok”, query/hash, błędnego hosta i dwóch różnych ofert z podobnym tytułem. Źródło błędu: niezakotwiczony regex ignorujący wielkość liter.
- [x] Oferta 4BSBL pobrana do lokalnej bazy: 83 m², 3 pokoje, 1 870 000 zł, 21 adresów zdjęć. Widoczna na liście ofert; blokada geokodowania nie blokuje importu, zachowuje dane portalu i zapisuje etap/cause do logu.
- [x] Naprawione 16 ID ofert i 2 ID kolejki; scalone 7 potwierdzonych par ofert i 14 par kolejki. Przed zmianą zapis pełnych rekordów i historii w ignorowanym `storage/backups/`. Wszystko w jednej transakcji; UUID rekordów ze starszymi powiązaniami zachowane. Brak ubytku snapshotów, zdarzeń cen, zdjęć, artefaktów, notatek, wizyt, ocen i członkostw grup.
- [x] Audyt końcowy: 0 niezgodnych ID w 4182 ofertach i 4207 wpisach kolejki Otodom; ponowny dry-run pusty. Stan automatyzacji przywrócony. Równoległy import dodawał nowe oferty podczas sesji.
- [x] UI ustawień i szczegółów sprawdzone w 1440/1280/390 px: brak wag/ocen/rankingu, dostępne Cechy, brak overflow i błędów JS. 96 testów API i 37 frontendu; build i typecheck zaliczone przed migracją, końcowe sprawdzenie skryptu przed publikacją.
- [x] Końcowy build wraz ze skryptem migracji zaliczony. Kontrola plików do publikacji: 161 plików, bez `.env`, storage, lokalnych backupów i prywatnych adresów. Przygotowane do commita i push do origin/main (wynik publikacji w odpowiedzi końcowej).

Skrypty kontroli: `.local/verify-remove-evaluation.cjs`, `.local/verify-repair-counts.ts`, `.local/audit-otodom-ids.ts`. Narzędzie naprawcze: `npm run ids:repair-otodom` (domyślnie dry-run). Stare snapshoty i pliki archiwum pozostają niezmienne — naprawa identyfikatorów nie odtwarza ofert utraconych historycznie przez kolizję i nie rozdziela automatycznie potencjalnie wymieszanej historii.

## Reorganizacja aplikacji i start lokalny

- [ ] Podział frontendu na app, features, shared, hooks/lib; widoki i routing URL, lazy loading.
- [ ] Podział API na trasy i moduły domenowe; usunięcie martwych elementów.
- [ ] Usunięcie Dockera, przygotowanie konfiguracji/bazy i wspólnego pakietu przy starcie.
- [ ] Dokumentacja: bieżące instrukcje, architektura, utrzymanie i archiwalne raporty w osobnych katalogach.
- [ ] Testy, przegląd wszystkich zakładek/responsywności, sprawdzenie startu z czystej kopii i pomiar pakietu.
