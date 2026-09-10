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

Lista, ekran startowy i szczegóły nie porównują automatycznie ofert z RCN ani
nie pobierają pobliskich transakcji. Import i zapisane dane RCN pozostają dostępne
osobno; nie są potrzebne do przeglądania ani oceny mieszkań.

W szczegółach oferty otwórz czwartą zakładkę **Ocena**. Tabela pokazuje każde
kryterium, zdobyte punkty, jego udział w mianowniku oraz dane/powód oceny.
Przycisk **Co ile daje punktów?** rozwija nad tabelą karty zasad w kategoriach
**Koszty**, **Lokalizacja**, **Układ**, **Budynek** i **Wykończenie**.
Wybierz kategorię, aby zobaczyć jej kryteria i punkty bieżącej oferty.
Suma wierszy odpowiada wynikowi;
na telefonie szeroka tabela przewija się wewnątrz zakładki.

Przy włączonej preferencji balkonu brak potwierdzonego balkonu oznacza −8 pkt
(obecność nadal +10). Brak roku budowy daje −3 pkt. Prysznic, kabina prysznicowa
lub natrysk dają +3 pkt; najwyższe/ostatnie piętro dodatkowe +5 pkt, także gdy
wynika z opisu, np. „trzecim najwyższym i najcichszym piętrze”.
Brak podanej kwoty czynszu daje −2 pkt. Kwota w polach portalu też się liczy;
wyraźnie bezczynszowe mieszkanie nie dostaje tej kary.

Rok budowy: do 1980 −4; 1981–1990 −2; 1991–2000 0; 2001–2005 +4;
2006–2010 +6; 2011–2015 +8; 2016–2020 +10; po 2020 +12.
Rok bieżący lub poprzedni daje dodatkowe +2.
Piętro: parter i poniżej −4; pierwsze +1; drugie −2; trzecie +3; czwarte +4;
piąte +5; szóste +7; siódme +8; 8–12 +9; powyżej 12 +12.
Premia ostatniego piętra nalicza się tylko raz, w tym samym wierszu.

Ekspozycja jednostronna daje −5, z wyjątkiem potwierdzonego S +2, W +4, N −15, E +2.
Dwustronna daje +10 oraz bonus za parę: S/W +10, S/E +7, S/N +4, N/W +2,
N/E +1, E/W +8. Trójstronna daje +13 oraz bonus: S/E/W +5, S/W/N +4,
S/E/N +3, N/W/E +1. Brak rozpoznanej ekspozycji daje 0.

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

Kryterium **Blat**: granit +8, konglomerat lub spiek (w tym kwarcowy) +7,
drewno, w tym „blaty z naturalnego dębu”, +5. Kilka materiałów nie sumuje się:
liczy się najwyższa potwierdzona premia. Mianownik przy rozpoznanym materiale to 8.
Samo „kamienny” bez podania materiału nie rozstrzyga punktacji; imitacje i laminaty nie dostają premii.
Deska dębowa, również w opisie „na podłogach wysokiej jakości deska dębowa”,
liczy się jako drewniana podłoga (+6, raz za tę cechę).
Co najmniej dwa miejsca parkingowe/postojowe/garażowe dają dodatkowe +5 pkt.
Jeśli te miejsca są wynajmowane/dzierżawione lub wymagają opłaty miesięcznej,
naliczane jest dodatkowe −5 pkt w osobnym wierszu **Wynajem miejsc parkingowych**.
Premia za liczbę miejsc pozostaje (+5 −5 = 0 pkt łącznie za te dwa kryteria).
Jednorazowa cena zakupu miejsca ani sam czynsz mieszkania nie uruchamiają tej kary.
Meble, kuchnia, szafy lub zabudowa na/pod wymiar albo na zamówienie dają +5 pkt,
także bez dosłownej wzmianki o stolarzu.
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
Dane dojazdu oraz preferencje należą do lokalnej instalacji. Opcjonalne konta chronią dostęp do wspólnej bazy; nie rozdzielają danych między użytkowników. [Włączenie logowania](login.md).

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

### Dojazdy do pracy

W ustawieniach wybierz **Dodaj miejsce pracy** (maksymalnie 6). Wpisz nazwę oraz
ulicę, numer budynku i miejscowość, np. „Marszałkowska 1, Warszawa”. Numer lokalu
nie jest potrzebny; przy niejednoznacznej ulicy dopisz dzielnicę.
Kliknij **Znajdź adres na mapie**, wybierz pasujący wynik i sprawdź zaznaczony punkt.
Możesz poprawić go kliknięciem na mapie, np. wskazując wejście do biura, albo wpisać
szerokość i długość geograficzną. Na końcu kliknij **Zapisz ustawienia**.
Zmiana tekstu adresu usuwa poprzedni punkt, aby nie liczyć dojazdu do starego miejsca.
Jeśli wyszukiwarka nie odpowiada, nadal można wskazać punkt ręcznie.

Wyszukiwanie adresów korzysta z Nominatim/OpenStreetMap wyłącznie na żądanie,
z limitem 1 zapytania na sekundę dla aplikacji i cache wyników w bazie.
Obowiązuje [polityka Nominatim](https://operations.osmfoundation.org/policies/nominatim/).
Serwer można zmienić przez `NOMINATIM_BASE_URL` (adres z końcowym `/`).

Miasto w **Aktualizacji** pochodzi z **Preferencji wyszukiwania → Zakres pobieranych ofert**.
Przycisk **Zmień w preferencjach** otwiera ten sam formularz. Po zapisaniu nowe wyszukiwania
na wszystkich ośmiu portalach używają wybranego miasta.

Miasto zmienia się w preferencjach; dashboard nie ma osobnego pola miasta w filtrach.
Sortowanie ofert obejmuje cenę za m² rosnąco i malejąco. Jest liczone z aktualnej ceny
i metrażu dla wszystkich wyników przed podziałem na strony; brakujące wartości są na końcu.
W **Zakresie pobieranych ofert** ustaw cenę od/do, minimalny metraż, liczbę pokoi
i dowolną liczbę dzielnic Warszawy. Pusty wybór dzielnic oznacza całe miasto.
Wyszukiwanie korzysta z zapisanych wartości; lista, mapa i liczniki korzystają też
z zapisanego miasta, minimalnego metrażu i maksymalnej ceny (bez dawnych stałych
56 m² i 2,2 mln zł). Dzielnice ograniczają nowe wyszukiwania, nie usuwają wcześniej
pobranych ofert. Preferowane dzielnice w profilu wymarzonego mieszkania pozostają
osobnym ustawieniem oceny dopasowania.

Otodom, Adresowo, Domiporta i Maxon wyszukują wybrane lokalizacje wspólnie.
Morizon i Gratka przeszukują kolejno grupy do 3 dzielnic; OLX i Nieruchomości-online
po jednej. Każda grupa zaczyna od wskazanej strony, ma własny limit stron i koniec
paginacji. Powtórzone adresy ofert trafiają do kolejki tylko raz w danym przebiegu.
Błąd jednej grupy jest raportowany, a pozostałe grupy są przeszukiwane dalej.
Adresowo rozdziela Gocław od Pragi-Południe, dlatego wybór Pragi-Południe obejmuje
obie lokalizacje. Katalog Adresowo nie zawiera Wesołej; jej wybór jest zgłaszany
jako nieobsługiwany zamiast rozszerzać wyszukiwanie na całe miasto.

Portale stosują własne przedziały: OLX ma kategorię 4+ pokoi, a Adresowo koduje
ceny w dziesiątkach tysięcy złotych. W tych przypadkach adres wyszukiwania obejmuje
najbliższy szerszy przedział. Początkowe wartości nowej instalacji są tylko domyślne
— zapisane ustawienia mają pierwszeństwo. Obecne integracje lokalizacji są
przygotowane dla Warszawy/województwa mazowieckiego.

W sekcji **Finansowanie zakupu** zapisz planowany wkład własny. Korzystają z niego
szacunki na kartach, szczegóły oferty i kalkulator. Kwotę można też zapisać z kalkulatora
przyciskiem **Zapisz wkład w preferencjach**. Te preferencje są wspólne dla lokalnej instalacji,
przechowywane w bazie i lokalnej kopii `storage/settings/family-settings.json`, pomijanej przez Git.
Pozostałe parametry symulacji kredytu zapamiętuje przeglądarka na danym urządzeniu.

W zakładce **Kredyt** formularz **Podstawowe dane** znajduje się przed kosztami transakcji.
Sekcja **Kredyt i efekt nadpłat** porównuje łączną spłatę, odsetki, liczbę rat i ratę bankową
w jednej tabeli. Zwolnienie PCC dla pierwszego mieszkania jest domyślnie zaznaczone
w nowej symulacji; wcześniej zapisany wybór pozostaje zachowany. Opłata za konto i kartę
nie jest uwzględniana w kalkulatorze.

## Czytanie i otwieranie ofert

Jeżeli po aktualizacji serwera otwarta karta odwołuje się do starego modułu widoku,
aplikacja próbuje raz automatycznie się odświeżyć. Przy utrzymującym się błędzie
wyświetla przycisk **Odśwież aplikację** zamiast pustego ekranu.

Kafelek **Pokoje / Piętro** na karcie pokazuje oba parametry. Parter ma numer **0** (np. **0 / 5**),
a brak piętra kreskę. Obok metrażu znajduje się **Rok budowy**; kreska oznacza brak roku.
Przełączniki **Ulubione / Wszystkie / Tylko ukryte** mają ikony i wyróżniony aktywny wybór.
Dodawanie do porównania jest dostępne po otwarciu szczegółów oferty;
na kartach dashboardu nie ma przycisku **Porównaj**.

W **Szczegółach oferty** telefon kontaktowy i cel negocjacji są w zakładce **Notatki**.
Telefon jest wstępnie uzupełniany numerem z ogłoszenia, jeśli nie zapisano własnego.
Na telefonie mapa znajduje się pod opisem, a **Działka i planowanie** na dole szczegółów.
Pole **Szukaj w ofercie** przeszukuje także adres, dzielnicę i okolicę; np. Okopowa
znajduje również Okopowej. Filtry dzielnicy i sortowania obsługują strzałki, Enter i Escape.
Ocena nie uwzględnia gabinetu. Nieznany stan wykończenia daje 0 pkt.
Przekroczenie budżetu do 7% oznacza −5 pkt, większe −15 pkt. Dla ceny za m²
odpowiednio −5 i −10 pkt; przy limicie jest +10 pkt, przy cenie o 25% niższej +20 pkt,
a pomiędzy tymi cenami premia rośnie proporcjonalnie.
Metraż ponad 5 m² poza zakresem daje −3 pkt, a metro powyżej 150% limitu −3 pkt.
Dojazd w linii prostej powyżej 18 km lub bez danych daje −5 pkt.
Drugie piętro daje +2 pkt, jednostronne południe +4 pkt, a dwustronny wschód–zachód
20 pkt (10 za dwustronność i 10 premii za kierunki).
Tabela oceny pokazuje **Kryterium**, **Punkty** oraz **Dane / powód**.
Zapis **+11 (18)** oznacza 11 zdobytych punktów z 18 możliwych. Powody pokazują wiek
w dniach i osiągnięte zakresy dojazdu oraz raty. Parking zewnętrzny bez garażu daje
osobne +8 pkt; kara za brak garażu nadal obowiązuje.
Okno oferty można zamknąć przyciskiem lub kliknięciem tła, również podczas ładowania.
Podczas ładowania działa także Escape; w galerii Escape zamyka podgląd zdjęcia.
Zamknięcie anuluje żądania przeglądarki i zapobiega ponownemu otwarciu przez spóźnioną odpowiedź.

## Zapamiętywanie statystyk i gesty

Dzielnice i poddzielnice są normalizowane przed liczeniem statystyk, dzięki czemu np.
Gocław i Praga-Południe trafiają do jednej dzielnicy. Mediany powstają z pojedynczych ofert.
Segmenty pokazują medianę i kwartyle cen za m² (środkowe 50%) przy co najmniej 10 ofertach
z ceną. Mniejsze próby są oznaczone; kwartyle nie są prognozą ani przedziałem ufności.
Przedziały metrażu uwzględniają dokładną powierzchnię bez zaokrąglania: `40–<60 m²`
oznacza od 40 m² włącznie do mniej niż 60 m². Zarówno 59,4, jak i 59,9 m² należy
do tej grupy; 60 m² zaczyna kolejną. Każda grupa ma wspólną ramkę z nazwą,
liczbą ofert, udziałem, paskiem oraz medianą i zakresem środkowych 50%.
Licznik ofert jest pokazany raz; jego dymek podaje też liczbę obserwacji z ceną i metrażem.

**Stan wykończenia** rozróżnia mieszkania wykończone/do zamieszkania,
do wykończenia/remontu i brak danych. Korzysta z pól portalu i rozpoznawania opisu;
to deklaracja ogłoszenia, nie ocena techniczna mieszkania.
**Czynsz miesięczny** grupuje deklarowane kwoty: 0 zł, poniżej 500 zł,
500–<1000 zł, 1000–<1500 zł oraz od 1500 zł. Brak jednoznacznej kwoty stanowi
osobną grupę: zakresy, opłaty roczne i opłaty za m² nie są traktowane jako miesięczna suma.
W obu przekrojach mediana i kwartyle dotyczą **ceny zakupu za m²**, nie wysokości czynszu.
Przekroje respektują ten sam okres i filtry co pozostałe segmenty.

Segmenty i mediana dzielnicy dotyczą ofert wykrytych w wybranym okresie, natomiast
liczba aktywnych i główna mediana aktywnych opisują bieżący stan. Ceny są aktualnymi cenami
ogłoszeniowymi tych ofert, nie historyczną wyceną z dnia pierwszego wykrycia.

Filtry statystyk i wybrany okres zapisują się automatycznie w tej przeglądarce.
Po odświeżeniu wracają zarówno zastosowane kryteria, jak i rozpoczęte zmiany w polach.
**Pokaż wyniki** zatwierdza zmiany, a **Wyczyść** usuwa kryteria.

Mapa w szczegółach oferty obsługuje kółko myszy oraz powiększanie dwoma palcami.

Na mapie głównej wybierz przynajmniej jeden filtr ofert. Przycisk **Pokaż filtry /
Ukryj filtry** działa również na komputerze. Liczby w zielonych kółkach oznaczają
grupy ofert: kliknięcie przybliża mapę, a przy maksymalnym powiększeniu pozwala
wybrać spośród ofert w tym samym miejscu. Lista obok mapy ma strony po 50 ofert;
zmiana strony listy nie usuwa pozostałych wyników z mapy. Podgląd zdjęcia używa
małej miniatury, a szczegóły oferty zachowują oryginalne zdjęcia.

Współrzędne metra są dołączone do aplikacji. Po kliknięciu planowanej stacji
możesz sprawdzić jej etap i źródło planu. M4, M5 i przedłużenie M2 do Ursusa
pokazują orientacyjne lokalizacje; połączenia punktów nie wyznaczają dokładnych
osi tuneli. [Źródła danych metra](../reference/metro-map-sources.md).
Tramwaje i kolej są zapisane w aplikacji — otwarcie mapy nie czeka na pobieranie
transportu z internetu. Kolej to wspólna warstwa torów PKP / SKM / KM / WKD
z przystankami, bez prostych łączących stacje. Kafelki tła nadal wymagają sieci.
[Zakres i aktualizacja danych transportu](../reference/transport-snapshot.md).
Kliknij przystanek i numer tramwaju w dymku, aby wyróżnić na różowo jego trasę
oraz przystanki. **Pokaż wszystkie tramwaje** w panelu filtrów przywraca pełną sieć.
W pełnoekranowym podglądzie zdjęć rozsuń palce, aby powiększyć, i zsuń, aby pomniejszyć.
Powiększone zdjęcie można przesuwać; przy podstawowym powiększeniu przesunięcie w bok
zmienia zdjęcie. Dwuklik przełącza powiększenie. Obrót telefonu dopasowuje zdjęcie do
nowego ekranu i resetuje powiększenie. Na telefonie pełny ekran zajmuje obszar aplikacji;
paski systemowe przeglądarki mogą pozostać widoczne.

## Cena po rozmowie

W szczegółach wpisz **Cena po rozmowie (aktualna)** i wybierz **Zapisz notatki do oferty**.
Ta kwota jest od tej chwili główną ceną, opisaną jako **Cena po negocjacjach**.
Korzystają z niej cena za m², filtry i sortowanie cenowe, dopasowanie, podgląd finansowania,
mapa i porównanie. Obok pozostaje cena z ogłoszenia.
**Cel negocjacji (planowana kwota)** nie zmienia ceny — to wyłącznie Twój cel.
Wyczyszczenie aktualnej ceny po rozmowie i zapis przywraca kwotę portalową.

Aktualizacja portalu nie nadpisuje ustaleń po rozmowie. Historia cen, procenty zmian
z portalu i statystyki rynku nadal dotyczą cen ogłoszeniowych: prywatne negocjacje
nie są rejestrowane jako obniżki na całym rynku.

# Automatyczne łączenie opisów

Filtr **Dzielnice** pozwala zaznaczyć kilka dzielnic checkboxami. Wyniki obejmują
każdą z wybranych dzielnic, z uwzględnieniem pozostałych kryteriów. Możesz dodać też
**Bez dzielnicy**. **Wszystkie dzielnice** czyści wybór; następnie zastosuj filtry.
Zestaw dzielnic pozostaje zapamiętany w bieżącej sesji przeglądarki.

Połączone oferty mają wspólną cenę ogłoszeniową: najniższą znaną cenę aktywnego,
nieodrzuconego duplikatu. Wybór portalu głównego nie zmienia tej kwoty. Gdy wszystkie
oferty są nieaktywne, pozostaje minimum z zapisanych cen. Ceny źródłowe są zachowane
osobno; po rozłączeniu oferta odzyskuje własną cenę. Historia każdej oferty w grupie
pokazuje zmianę wspólnej ceny, datę wykrycia oraz portal, z którego pochodzi nowa cena.
Pierwsze przeliczenie istniejących grup zapisuje obniżkę z datą przeliczenia — nie
przypisuje jej nieznanej historycznej daty publikacji. Cena po negocjacjach zachowuje
pierwszeństwo przed ceną portalową.

W szczegółach formularz **Umów oglądanie mieszkania** jest początkowo zwinięty;
kliknij nagłówek, aby ustawić lub zmienić termin. Portale połączonych ofert znajdziesz
w tabeli **Przegląd**. Złota ramka karty oznacza ofertę dodaną do ulubionych.

Jeśli pobrane dane Otodomu zawierają zdjęcie planu lokalu, na galerii pojawia się
przycisk **Rzut**, otwierający go w powiększeniu. Rzuty pobierane są razem ze zdjęciami
i korzystają z lokalnego cache. Rzuty są dostępne również z połączonych duplikatów,
nawet gdy główna galeria pochodzi z innego portalu. Starsze dane można uzupełnić
z lokalnych archiwów bez ponownego pobierania ogłoszeń:

```powershell
node --import tsx apps/api/src/scripts/maintenance/backfill-otodom-floor-plans.ts --apply --download
```

Bez `--apply` skrypt tylko podaje liczbę wykrytych rzutów. `--download` pobiera brakujące
pliki obrazów do cache; ponowne uruchomienie nie dubluje zdjęć. Przy braku lokalnego
archiwum należy wykonać pełne pobranie danych oferty.

Gdy część usług mapowych nie odpowie, **Okolica** nadal pokazuje znane obiekty,
odległości i dojazdy. Informacja o częściowych danych dotyczy brakujących wyników;
puste wartości z błędnej odpowiedzi nie są potwierdzeniem braku obiektów.

Identyczne pierwsze 25 słów opisu pozwala automatycznie połączyć aktywne oferty
w tym samym mieście, również z tego samego portalu. Normalizacja pomija wielkość
liter i interpunkcję. Pary oznaczone jako różne oferty pozostają rozdzielone.
Reguła działa podczas przetwarzania ofert i skanowania duplikatów w Aktualizacji.

Dane M1/M2/M3, planowanych odcinków metra oraz 28 stacji WKD są częścią aplikacji: są dostępne także przy pustej lub zaimportowanej bazie ofert. Planowane lokalizacje M4/M5 i przedłużenia M2 do Ursusa są orientacyjne. Źródła: [metro i WKD](../reference/metro-map-sources.md).
