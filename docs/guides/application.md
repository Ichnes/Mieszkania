# Widoki aplikacji

| Adres           | Zastosowanie                                          |
| --------------- | ----------------------------------------------------- |
| `/oferty`       | Filtry, lista ofert, ulubione i otwieranie szczegółów |
| `/statystyki`   | Ceny, przepływ ofert, dzielnice i granice MSI         |
| `/porownanie`   | Porównanie wybranych mieszkań                         |
| `/mapa`         | Oferty, dojazdy i transport na mapie                  |
| `/kredyt`       | Kalkulator zakupu i finansowania                      |
| `/duplikaty`    | Weryfikacja ofert połączonych z kilku portali         |
| `/aktualizacja` | Wyszukiwanie ofert, kolejki, retry i pobieranie zdjęć |
| `/import`       | Katalog ulic, pojedyncza oferta i dane RCN            |

Adresy można odświeżać i otwierać bezpośrednio. Przyciski Wstecz/Dalej przeglądarki
zmieniają widok. Link z `?listing=UUID` otwiera szczegóły konkretnej lokalnej oferty;
stare linki zaczynające się od `/` pozostają obsługiwane.

Ustawienia otwiera ikona w górnym pasku. Ręczne oceny, wagi i ranking zostały wycofane.
Procent dopasowania do profilu wymarzonego mieszkania jest niezależną funkcją.
Stare pola `weights` i `maxWeightTotal` są usuwane automatycznie przy odczycie
zapisanych ustawień (baza i lokalna kopia family-settings).

## Punktacja wymarzonego mieszkania

W szczegółach oferty otwórz czwartą zakładkę **Ocena**. Tabela pokazuje każde
kryterium, zdobyte punkty, jego udział w mianowniku oraz dane/powód oceny.
Przycisk **Co ile daje punktów?** rozwija nad tabelą karty zasad w kategoriach
**Koszty**, **Lokalizacja**, **Układ**, **Budynek** i **Wykończenie**.
Wybierz kategorię, aby zobaczyć jej kryteria i punkty bieżącej oferty.
Suma wierszy odpowiada wynikowi;
na telefonie szeroka tabela przewija się wewnątrz zakładki.

Przy włączonej preferencji balkonu brak potwierdzonego balkonu oznacza −8 pkt
(obecność nadal +10). Brak roku budowy daje −3 pkt. Prysznic, kabina prysznicowa
lub natrysk dają +3 pkt; najwyższe/ostatnie piętro dodatkowe +3 pkt, także gdy
wynika z opisu, np. „trzecim najwyższym i najcichszym piętrze”.
Brak podanej kwoty czynszu daje −2 pkt. Kwota w polach portalu też się liczy;
wyraźnie bezczynszowe mieszkanie nie dostaje tej kary.

Ocena raty korzysta z zapisanego wkładu własnego w **Finansowaniu zakupu**.
Kwota kredytu to cena zakupu z rozpoznanymi dodatkowymi kosztami garażu i komórki,
pomniejszona o wkład (nie mniej niż zero). Założenia są takie jak w podglądzie ofert:
5,8% rocznie, 360 równych rat; bez dodatkowych opłat bankowych.
Lokalne symulacje oprocentowania i okresu w kalkulatorze nie zmieniają rankingu.
Rata powyżej 7500 zł daje −10 pkt; przy racie do 7500 zł premia to zaokrąglone
`10 × (1 − rata / 7500)`: 7500 zł → 0 pkt, 6000 zł → +2 pkt,
3750 zł → +5 pkt, zakup bez kredytu → +10 pkt. Brak ceny daje 0 pkt za ratę.
Zmiana zapisanego wkładu własnego przelicza ocenę i kolejność sortowania.

Pole Otodom **Stan wykończenia: do wykończenia** jest zapisywane przez kolektor
i uruchamia progi stanu deweloperskiego niezależnie od opisu. Odczytywane są
też zachowane dane strukturalne. Oferty zapisane bez tego pola wymagają
odświeżenia danych z portalu, jeśli informacji nie ma w opisie ani snapshotach.

Lista, porównanie i sortowanie „Sortuj: wymarzone mieszkanie” korzystają ze wspólnego
algorytmu. Wynik to suma punktów podzielona przez możliwą sumę, zaokrąglona
i ograniczona do 0–100%. Punkty nie są punktami procentowymi. Mianownik zależy
od aktywnych preferencji i dostępnych danych; wykryte dodatkowe udogodnienia
zwiększają zarówno licznik, jak i mianownik.

Minimum to 3 pokoje (domyślne ustawienie profilu), a ideałem są 4:
3 pokoje dostają 11 pkt, 4 — 18 pkt, więcej — 14 pkt.
Dodatkowa premia za układ to 4 pkt dla 3 pokoi od 75 m², 8 pkt dla 4 pokoi
i 6 pkt dla większej liczby. Ustawione wyższe minimum pokoi jest respektowane:
oferta poniżej niego nie dostaje punktów za pokoje ani układ.
Komórka daje 9 pkt, klimatyzacja 5 pkt, drewniana podłoga 6 pkt, garderoba 5 pkt.

Blaty ze spieku (w tym kwarcowego), granitu lub konglomeratu dają +8 pkt.
Deska dębowa, również w opisie „na podłogach wysokiej jakości deska dębowa”,
liczy się jako drewniana podłoga (+6, raz za tę cechę).
Co najmniej dwa miejsca parkingowe/postojowe/garażowe dają dodatkowe +5 pkt.
Jeśli te miejsca są wynajmowane/dzierżawione lub wymagają opłaty miesięcznej,
naliczane jest dodatkowe −5 pkt w osobnym wierszu **Wynajem miejsc parkingowych**.
Premia za liczbę miejsc pozostaje (+5 −5 = 0 pkt łącznie za te dwa kryteria).
Jednorazowa cena zakupu miejsca ani sam czynsz mieszkania nie uruchamiają tej kary.
Meble lub zabudowa robione na/pod wymiar przez stolarza dają +5 pkt.
Rozpoznawane są odmiany i różny szyk zwrotów; powtórzenie cechy nie mnoży premii.
Premie opierają się na treści ogłoszenia, z kontrolą typowych negacji i imitacji.

Dla stanu deweloperskiego / do wykończenia poniższa punktacja **zastępuje**
poprzednie −10 pkt za stan. Ogólna ocena ceny za m² nadal działa osobno.
Brak poprawnej ceny za m² pozostawia −10 pkt.

| Cena za m² mieszkania do wykończenia | Punkty za stan |
| ------------------------------------ | -------------- |
| Poniżej 17 000 zł                    | +5             |
| 17 000–18 000 zł włącznie            | +1             |
| Powyżej 18 000 do 19 000 zł włącznie | −4             |
| Powyżej 19 000 do 20 000 zł włącznie | −8             |
| Powyżej 20 000 do 21 000 zł włącznie | −12            |
| Powyżej 21 000 zł                    | −18            |

| Spadek ceny względem poprzedniej ceny w ostatnim zdarzeniu | Punkty |
| ---------------------------------------------------------- | ------ |
| Brak spadku / wzrost                                       | 0      |
| Więcej niż 0%, do 1% włącznie                              | 2      |
| Więcej niż 1%, do 2% włącznie                              | 4      |
| Więcej niż 2%, do 3% włącznie                              | 5      |
| Więcej niż 3%, do 4% włącznie                              | 6      |
| Więcej niż 4%                                              | 7      |

Procent zmiany ceny jest prezentowany i oceniany z dokładnością do 0,1%.
Wiek oferty liczymy od pierwszego wykrycia, a przy braku tej daty od publikacji:
do 20 dni włącznie +2 pkt, powyżej 20 do 40 dni −1 pkt, powyżej 40 dni −2 pkt.
Brak poprawnej daty daje 0 pkt. Jest to preferencja rankingu, a nie ustalenie
faktycznego stanu mieszkania. Oferta prywatna lub bezpośrednia daje +10 pkt;
oznaczenie „Z prowizją” odejmuje 15 pkt i ma pierwszeństwo przed premią prywatną.

Metraż w zakresie daje 20 pkt, poza nim maksymalnie o 5 m² — 10 pkt, dalej 0 pkt.
Synonimy w opisie nie naliczają wielokrotnie tej samej premii (np. „projekt architekta”
i „architekta”, „dwie łazienki” i „2 łazienki”).

Portale: Otodom, Gratka, OLX, Nieruchomości-online, Domiporta, Maxon, Adresowo i Morizon.
Dane dojazdu oraz preferencje należą do lokalnej instalacji. Aplikacja nie ma oddzielnych kont użytkowników.

## Pierwsze dane i import

W **Aktualizacji** wybierz **Import i przygotowanie danych · ulice, oferty, RCN**.
W sekcji **Pierwsze uruchomienie** zobaczysz, czy katalog ulic jest już dostępny.
**Pobierz ulice Warszawy** pobiera katalog do lokalnej bazy; później ten sam przycisk
pozwala go odświeżyć. Pobieranie może potrwać kilka minut. Import aktualizuje istniejące
odcinki, więc ponowne uruchomienie nie tworzy ich duplikatów.
Poniżej dodasz pojedynczą ofertę z dowolnego obsługiwanego portalu lub dane cen RCN.
Przycisk **Wróć do aktualizacji** prowadzi do głównego panelu pobierania ofert.

## Porównanie

Na kartach wybierz **Porównaj** (maksymalnie pięć ofert). W zakładce **Porównanie**
ceny i cechy znajdują się w tych samych wierszach. Na małym ekranie przewijaj samą tabelę
w bok. Kliknięcie tytułu otwiera ofertę, krzyżyk usuwa ją z porównania, a **Dodaj oferty**
wraca do listy. Zmiana filtrów lub strony listy nie usuwa wcześniejszego wyboru.
Wybór obowiązuje w bieżącej sesji aplikacji; odświeżenie całej strony go resetuje.

## Preferencje i finansowanie

Miasto w **Aktualizacji** pochodzi z **Preferencji wyszukiwania → Zakres pobieranych ofert**.
Przycisk **Zmień w preferencjach** otwiera ten sam formularz. Po zapisaniu nowe wyszukiwania
na wszystkich ośmiu portalach używają wybranego miasta.

W sekcji **Finansowanie zakupu** zapisz planowany wkład własny. Korzystają z niego
szacunki na kartach, szczegóły oferty i kalkulator. Kwotę można też zapisać z kalkulatora
przyciskiem **Zapisz wkład w preferencjach**. Te preferencje są wspólne dla lokalnej instalacji,
przechowywane w bazie i lokalnej kopii `storage/settings/family-settings.json`, pomijanej przez Git.
Pozostałe parametry symulacji kredytu zapamiętuje przeglądarka na danym urządzeniu.

## Czytanie i otwieranie ofert

Sekcja **Co sprawdzić w tej ofercie** pojawia się, gdy opis daje konkretny powód
np. do sprawdzenia własności, najmu, dodatkowych kosztów albo remontu. Pytanie zawiera
cytat i uzasadnienie; brak przesłanek oznacza brak sekcji.
Okno oferty można zamknąć również podczas ładowania, przyciskiem, Escape lub kliknięciem tła.
Zamknięcie anuluje żądania przeglądarki i zapobiega ponownemu otwarciu przez spóźnioną odpowiedź.

## Zapamiętywanie statystyk i gesty

Filtry statystyk i wybrany okres zapisują się automatycznie w tej przeglądarce.
Po odświeżeniu wracają zarówno zastosowane kryteria, jak i rozpoczęte zmiany w polach.
**Pokaż wyniki** zatwierdza zmiany, a **Wyczyść** usuwa kryteria.

Mapa w szczegółach oferty obsługuje kółko myszy oraz powiększanie dwoma palcami.
W pełnoekranowym podglądzie zdjęć rozsuń palce, aby powiększyć, i zsuń, aby pomniejszyć.
Powiększone zdjęcie można przesuwać; przy podstawowym powiększeniu przesunięcie w bok
zmienia zdjęcie. Dwuklik przełącza powiększenie. Obrót telefonu dopasowuje zdjęcie do
nowego ekranu i resetuje powiększenie. Na telefonie pełny ekran zajmuje obszar aplikacji;
paski systemowe przeglądarki mogą pozostać widoczne.
