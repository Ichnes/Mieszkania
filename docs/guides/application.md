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

W panelu ponownych wystawień rozwiń **Połącz ręcznie po ID**, wpisz identyfikatory
aktywnej i archiwalnej oferty, a następnie wybierz **Połącz jako ponowne wystawienie**.
Można tak potwierdzić także parę pominiętą przez automatyczne propozycje.

W **Aktualizacja → Sprawdź portale** podaj **Od strony** i **Ile stron na portal**.
Przycisk **Zmień w preferencjach** na końcu pola miasta otwiera ustawienia zakresu ofert.
Wartości 30 i 10 oznaczają strony od 30 do 39 włącznie. Po sprawdzeniu stron 1–30
zacznij od 31, jeśli chcesz pominąć stronę 30. Pusty początek oznacza stronę 1.
Zakres jest stosowany dla każdej grupy lokalizacji. Skan może zakończyć się wcześniej,
gdy skończą się wyniki. Otodom pozwala w tym panelu na 5000 stron, pozostałe portale
na 250. Wznowienie przerwanego skanu Otodom korzysta z zapisanego zakresu.

Przy starcie aplikacja czeka na ustawienia i region. Lista ofert, podsumowanie bazy
i kalendarz wczytują się niezależnie po wejściu na **Oferty**. Kalkulator i porównanie
nie czekają na ranking ofert ani odczyt kalendarza. Przejście do innej strony anuluje
oczekujący odczyt listy i podsumowań; powrót odświeża dane z zachowaniem zastosowanych
filtrów, sortowania i strony wyników.

Jeden przycisk wyboru okresu w wąskim pasku po prawej stronie podsumowania steruje wszystkimi
czterema kafelkami: **7 dni**, **30 dni** i **60 dni** (domyślnie 7). **Nowe** pokazuje aktywne oferty pierwszy raz znalezione
w wybranym okresie, a **Zmiany cen** — aktywne oferty ze zmianą ceny; kilka zmian
ceny jednej oferty liczy się raz. Oba wskaźniki pomijają duplikaty i uwzględniają
miasto, cenę i metraż ustawione dla poszukiwań.

Kliknij **Nowe** (na telefonie **Nowe oferty**) lub **Zmiany cen**, aby przejść do pierwszej strony ofert z wybranego okresu. Na telefonie wspólne pole **Okres podsumowania** znajduje się pod licznikami.
Kliknięcie zastępuje wcześniejsze filtry listy. Nagłówek wyników pokazuje rodzaj i okres wyboru.
Przycisk **Wyczyść filtry** przywraca pełną listę.

W filtrach ofert dolna i górna granica ceny, ceny za m², metrażu, roku budowy i liczby pokoi są obok siebie.
Pola ceny mieszkania oraz ceny za m² grupują tysiące już podczas pisania, np. **1 250 000**.
Możesz wkleić kwotę ze spacjami i dopiskiem „zł”. Przycisk **Filtruj** stosuje wpisane granice.

W **Aktywnych ofertach** i **Średniej cenie / m²** główna liczba nadal opisuje
obecny stan, a wybrany okres określa porównanie do stanu sprzed 7, 30 lub 60 dni.
Średnia dotyczy Warszawy. Przy zbyt krótkiej historii pojawia się informacja
o braku porównania. Okres podsumowania jest niezależny od okresu strony Statystyki.

Kliknij **Wszystkie ulubione**, aby wyświetlić razem zapisane oferty aktywne i archiwalne.
Ten skrót czyści wcześniejsze ograniczenia wyników. Przy tytule nieaktywnej oferty widnieje **Archiwalna**.
Na telefonie skrót znajduje się pod przyciskiem **Filtry**.

W **Aktualizacji** przy pracującym portalu zobaczysz osobne liczby nowych i odświeżanych ofert.
Przy odświeżaniu aplikacja pokazuje przykładowy tytuł z bieżącej partii. Przy imporcie nowego ogłoszenia może pokazać jego identyfikator.

W **Duplikatach** kolumny tabeli odpowiadają kolejności kart pod tabelą. Strzałki pod zdjęciem i przesunięcie palcem zmieniają zdjęcie tylko w danej ofercie. Dotknięcie samego zdjęcia otwiera ofertę. Gdy zdjęcia pochodzą z powiązanego ogłoszenia, aplikacja pokazuje podpis.

W **Ponownych wystawieniach → Połączone** kolejne publikacje tego samego mieszkania tworzą wspólną historię. Dla większej grupy lista pokazuje publikacje w kolejności pierwszego wykrycia. Rozwiń **Powiązania między publikacjami**, aby sprawdzić poszczególne pary. **Propozycje** wymagają osobnej decyzji dla każdej pary.

W **Statystykach** kliknij tydzień na wykresie **Ceny i liczba ofert — tygodniowo** albo wybierz go z listy, aby zachować dokładne wartości pod wykresem. Obok znajdziesz tygodniowy bilans ofert oraz porównanie obniżek i podwyżek w dzielnicach.

Aby zobaczyć wyłącznie dawne ulubione, kliknij **Ulubione**, zaznacz **Tylko archiwalne**
i naciśnij **Filtruj**. Możesz też najpierw wybrać archiwum, a potem kliknąć
**Ulubione**. Nagłówek **Archiwalne ulubione** potwierdza połączenie filtrów.
Ponowne kliknięcie **Ulubione** wyłącza tylko ten warunek, zachowując archiwum.
Ulubione wyróżniają złoty tytuł i grubsza pulsująca ramka. Przy systemowym
ograniczeniu animacji ramka pozostaje nieruchoma. Procent dopasowania na laptopie
i PC ma nieco większą czcionkę niż wcześniej.

Po zaznaczeniu **Tylko archiwalne** możesz dodatkowo włączyć **Uwzględnij aktualne połączone z archiwalnymi** i kliknąć **Filtruj**. Wyniki obejmą aktualne oferty mające połączony archiwalny duplikat, po jednym wyniku na grupę. Fraza wyszukiwania sprawdza również treść archiwalnych kopii. Aktualna oferta zachowuje swój status; ręcznie odrzucona kopia nie kwalifikuje jej do archiwum.

W szczegółach, w zakładce **Przegląd**, wiersz **Telefon** pokazuje zapisany numer kontaktu i numery z portali, także połączonych ofert. Powtórzenia są pomijane, a kliknięcie numeru otwiera połączenie telefoniczne. Przy braku numeru pojawia się **Brak numeru**. Zakładka **Ocena AI** jest widoczna tylko dla ofert z zapisaną oceną.
**Wszystkie** przywraca aktywne oferty i wyłącza oba ograniczenia.

Błąd podsumowania lub kalendarza pojawia się przy danej sekcji. **Ponów** powtarza
tylko jej odczyt. Pozostałe części aplikacji nadal działają. Jeśli wcześniejsze dane
są dostępne, pozostają widoczne z informacją, że mogą być nieaktualne. Brak odczytu
nie jest prezentowany jako pusta baza ani pusty kalendarz. Błąd ustawień lub regionu
nadal wymaga użycia **Spróbuj ponownie** na ekranie startowym.

Ustawienia otwiera ikona w górnym pasku. Ręczne oceny, wagi i ranking zostały wycofane.
Procent dopasowania do profilu wymarzonego mieszkania jest niezależną funkcją.
Stare pola `weights` i `maxWeightTotal` są usuwane automatycznie przy odczycie
zapisanych ustawień (baza i lokalna kopia family-settings).

## Zapisane wyszukiwania i interpretacja opisów

Na stronie **Oferty** rozwiń **Zapisane wyszukiwania** u góry panelu filtrów.
Na telefonie ta sekcja przewija się razem z polami, a wybór dzielnic zajmuje cały wiersz.
Ustaw kryteria i sortowanie, kliknij **Filtruj**, nadaj nazwę i wybierz
**Zapisz aktualne wyniki**. Kliknięcie nazwy przywraca kryteria i pierwszą stronę
wyników. Możesz przechowywać 12 zestawów w danej przeglądarce. Usunięcie można
cofnąć; zestawy nie synchronizują się między urządzeniami i nie wysyłają alertów.

**Brak danych o parkingu** oznacza, że źródło nie potwierdza dostępności miejsca.
To odrębny stan od **Brak miejsca postojowego**. Dostępny najem ma oznaczenie
**Garaż — najem** lub **Komórka — najem**; nie jest traktowany jako własność.
Konkretna możliwość dokupienia/odkupienia miejsca ma oznaczenie **Garaż — możliwość zakupu**,
również od firmy zewnętrznej. Ogólna wzmianka o dostępnych miejscach „do wynajmu lub zakupu”
bez konkretnego miejsca i ceny nie potwierdza garażu. **Parking miejski / przy ulicy**
nie oznacza parkingu osiedlowego ani własnego miejsca i nie daje premii za parking zewnętrzny.
Planowane wyposażenie
i możliwość jego montażu nie są wykazywane jako istniejące udogodnienia.

Zgodnie z uzgodnioną interpretacją pełne kwoty dopłat od 1000 do 1 000 000 zł
z nadmiarowym „tys.” są odczytywane bez ponownego mnożenia: „55 000 tysięcy” to 55 000 zł,
a „30 tysięcy” to 30 000 zł. Jeszcze większe niejednoznaczne dopłaty mają ostrzeżenie
**Dopłaty do sprawdzenia** i nie wliczają się do sumy.

## Punktacja wymarzonego mieszkania

### Dodatkowa ocena AI

Eksperyment jest **wstrzymany na prośbę użytkownika**. Istniejące wyniki pozostają
w aplikacji, ale ich jakość nie została zaakceptowana. Wnioski i warunki powrotu
opisuje [notatka z eksperymentu](../ai-photo-review-handoff.md).

W szczegółach oferty zakładka **Ocena AI** znajduje się między **Ocena** i **Duplikaty**.
Jeżeli mieszkanie ma zapisaną analizę, na jego karcie po prawej stronie dotychczasowego
kółka dopasowania pojawia się fioletowe kółko **AI** z wynikiem 0–100. Oferty bez zdjęcia
pokazują ocenę tekstowo. Brak analizy ma osobny komunikat w zakładce; nie jest oceną zero.

Analiza zawiera uzasadnienie, mocne i słabsze strony, pytania na oględziny, datę,
model i liczbę analizowanych zdjęć/rzutów. Oceny cząstkowe mają stałe wagi:
lokalizacja 25%, cena i koszty 20%, stan i wykończenie 20%, układ 15%,
budynek 10%, światło i przestrzeń zewnętrzna 10%.
Wynik liczy aplikacja, nie model. Kryterium bez danych jest pomijane w średniej;
**pokrycie kryteriów** pokazuje sumę ocenionych wag, a **pewność** wiarygodność podstaw oceny.
Wyniki o różnym pokryciu lub niskiej pewności wymagają ostrożnego porównania.

Oceny AI nie zmieniają sortowania „Wymarzone mieszkanie”. Są zapisanym stanem
z dnia analizy: otwieranie stron nie wysyła zdjęć do modelu, nie zużywa kredytów
i nie odświeża oceny. Zmiana ceny od analizy ma ostrzeżenie; aktualizacja opisu,
zdjęć lub preferencji również wymaga nowej weryfikacji.
Pierwsza partia obejmuje 10 najlepszych aktywnych ofert według tego sortowania,
bez dodatkowych filtrów, maksymalnie 6 zdjęć/rzutów na ofertę.

Ta wersja ocenia lokalizację i cenę na podstawie danych oferty oraz preferencji;
nie weryfikuje tras, hałasu ani wyceny rynkowej. Materiały poglądowe i deklaracje
sprzedawcy są oznaczane w uzasadnieniach. Przygotowanie/import partii opisuje
[instrukcja utrzymania](maintenance.md#oceny-ai-bez-wywołań-api-modelu).

### Zasady dotychczasowej punktacji

Lista, ekran startowy i szczegóły nie porównują automatycznie ofert z RCN ani
nie pobierają pobliskich transakcji. Import i zapisane dane RCN pozostają dostępne
osobno; nie są potrzebne do przeglądania ani oceny mieszkań.

W szczegółach oferty otwórz zakładkę **Ocena**. Tabela pokazuje każde
kryterium, zdobyte punkty, jego udział w mianowniku oraz dane/powód oceny.
Obok wyniku jest **Pokrycie kryteriów**: liczba aktywnych kryteriów z danymi do oceny
podzielona przez liczbę aktywnych kryteriów. Każde kryterium ma równy udział, także
osobne reguły premii łącznych i kar. To nie jest procent prawdziwości ani jakość mieszkania.
Potwierdzony brak garażu, windy lub komórki jest informacją; samo niewykrycie cechy
nią nie jest. Uwzględniane są ręczne korekty. Przy cechach tekstowych brak pozytywnego
rozpoznania pozostaje niepotwierdzony. Częściowe dane (np. piętro bez liczby pięter
budynku lub bez informacji o ostatnim piętrze) nie oznaczają pełnego pokrycia reguły.
**Najpierw sprawdź** pokazuje do trzech niewiadomych według największej możliwej premii.
Status przy każdym wierszu wskazuje dane dostępne, niepełne/niepotwierdzone lub wyłączone
kryterium. Pokrycie nie zmienia punktów, mianownika dopasowania ani sortowania ofert.
Punkty możliwe to stała suma maksimów wszystkich aktywnych kryteriów dla danych
preferencji, identyczna dla każdej oferty. Brak danych nie usuwa kryterium z mianownika.
Uzupełnienie kierunków, roku, piętra, ceny lub wyposażenia zmienia tylko zdobyte punkty.
Zmiana preferencji może zmienić mianownik dla wszystkich ofert. Maksima kryteriów
są sumowane osobno, także dla alternatywnych udogodnień (garaż i parking zewnętrzny).
Domyślny widok **Ocena** pokazuje **Co ile daje punktów?** — karty zasad w kategoriach
**Koszty**, **Lokalizacja**, **Układ**, **Budynek** i **Wykończenie**.
Wybierz kategorię, aby zobaczyć jej kryteria i punkty bieżącej oferty. Pogrubiony
warunek **Dla tej oferty** wskazuje zastosowane widełki lub brak danych. Tabelę
punktów, sumę i szczegółowe objaśnienia pokrycia otworzysz w **Dane rozwinięte**.
Suma wierszy odpowiada wynikowi;
na telefonie szeroka tabela przewija się wewnątrz zakładki.

Przy włączonej preferencji balkonu potwierdzony brak oznacza −8 pkt,
brak informacji −4, obecność +10. Brak roku budowy daje −3 pkt.
Prysznic, kabina prysznicowa lub natrysk dają +3 pkt.
Brak podanej kwoty czynszu daje −2 pkt. Kwota w polach portalu też się liczy;
wyraźnie bezczynszowe mieszkanie nie dostaje tej kary.
Gdy kwoty brakuje, aplikacja sprawdza połączone duplikaty z innych portali. Przy zgodnej kwocie w szczegółach można otworzyć ogłoszenie źródłowe i sprawdzić, czy jest archiwalne. Rozłączenie ofert usuwa podstawę takiego uzupełnienia.

Rok budowy: do 1980 −4; 1981–1990 −2; 1991–2000 0; 2001–2005 +4;
2006–2010 +6; 2011–2015 +8; 2016–2020 +10; po 2020 +12.
Rok bieżący lub poprzedni daje dodatkowe +2.
Piętro: parter i poniżej −4; wyżej zaokrąglone `9 × piętro / liczba pięter`,
z dodatkowym +3 za ostatnie. Przykłady: 2/5 +4, 4/5 +7, 5/5 i 13/13 +12.
Bez wysokości budynku 0, chyba że opis potwierdza ostatnie piętro (+12).
Sprzeczne dane, np. 7. piętro w budynku pięciopiętrowym, wymagają sprawdzenia.

Jedna strona: S/W +4, E +2, N −15, kierunek SW +6, SE +4, NW +1, NE 0.
Dwie strony: S/W +20, S/E i E/W +18, S/N +15, N/W +13, N/E +11.
Trzy strony zachowują co najmniej premię najlepszej pary: S/E/W i S/W/N +20,
S/E/N i N/E/W +18. Cztery lub więcej +20. Bez znanych kierunków jedna strona
daje −5, dwie +10, trzy +13; bez rozpoznanej ekspozycji 0.

Ocena raty korzysta z zapisanego wkładu własnego w **Finansowaniu zakupu**.
Kwota kredytu to cena zakupu z rozpoznanymi dodatkowymi kosztami garażu i komórki,
pomniejszona o wkład (nie mniej niż zero). Założenia są takie jak w podglądzie ofert:
5,8% rocznie, 360 równych rat; bez dodatkowych opłat bankowych.
Lokalne symulacje oprocentowania i okresu w kalkulatorze nie zmieniają rankingu.
**Limit miesięcznej raty w DreamScore (zł)** jest edytowalny, początkowo 7500 zł.
Do limitu premia wynosi zaokrąglone `10 × (1 − rata / limit)`, od +10 do 0.
Powyżej limitu kara rośnie płynnie do −10 przy przekroczeniu o 20%.
Brak ceny daje 0. Zmiana wkładu lub limitu przelicza ocenę i kolejność sortowania.

Pole Otodom **Stan wykończenia: do wykończenia** jest zapisywane przez kolektor
i uruchamia progi stanu deweloperskiego niezależnie od opisu. Odczytywane są
też zachowane dane strukturalne. Oferty zapisane bez tego pola wymagają
odświeżenia danych z portalu, jeśli informacji nie ma w opisie ani snapshotach.

Lista, porównanie i sortowanie „Sortuj: wymarzone mieszkanie” korzystają ze wspólnego
algorytmu. Wynik to suma punktów podzielona przez możliwą sumę, zaokrąglona
i ograniczona do 0–100%. Punkty nie są punktami procentowymi. Mianownik zależy
wyłącznie od aktywnych preferencji; wykryte dodatkowe udogodnienia zwiększają
licznik, a mianownik pozostaje stały, również przy brakujących danych.

Minimum to 3 pokoje (domyślne ustawienie profilu), a ideałem są 4:
3 pokoje dostają 18 pkt albo 23, gdy opis jednoznacznie podaje sypialnię/pokój
dziecięcy większy niż 12 m². Salon nie spełnia tego warunku; brak metrażu oznacza
brak dodatkowej premii. 4 pokoje dają 25, więcej 23 (25 przy minimum profilu ponad 4).
Nie ma dodatkowej premii za ten sam układ ani za 75 m². Wyższe minimum profilu
jest respektowane; poniżej minimum punkty za pokoje wynoszą 0.
Komórka daje 9 pkt, klimatyzacja 5, drewniana podłoga 8, garderoba 5.
Projekt wnętrza przez architekta daje 5, ogólny slogan wysokiego standardu 1.
Osobne WC lub pralnia daje 3 łącznie, bez dodatkowych punktów przy dwóch łazienkach (+4).
Konkretna armatura łazienkowa daje maksymalnie 2; wzmianka o jakości obsługi lub jasnych
meblach nie potwierdza standardu ani nasłonecznienia mieszkania.

Kryterium **Blat**: granit, konglomerat lub spiek (w tym kwarcowy) +7,
drewno, w tym „blaty z naturalnego dębu”, +5. Kilka materiałów nie sumuje się:
liczy się najwyższa potwierdzona premia. Maksimum kryterium to 7.
Samo „kamienny” bez podania materiału nie rozstrzyga punktacji; imitacje i laminaty nie dostają premii.
Deska dębowa, również w opisie „na podłogach wysokiej jakości deska dębowa”,
liczy się jako drewniana podłoga (+8, raz za tę cechę).
Co najmniej dwa miejsca parkingowe/postojowe/garażowe dają dodatkowe +5 pkt.
Jeśli te miejsca są wynajmowane/dzierżawione lub wymagają opłaty miesięcznej,
naliczane jest dodatkowe −5 pkt w osobnym wierszu **Wynajem miejsc parkingowych**.
Pojedynczy garaż w najmie zachowuje premię za dostępny garaż, pomniejszoną o 2 pkt.
Ta kara nie dodaje się do powyższych −5 pkt. Komórka w najmie otrzymuje 8 zamiast 9 pkt
(potrącenie 1 pkt). Punkty są następnie przeliczane na procent dopasowania.
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

W **Aktualizacji** liczniki kolejek ośmiu portali są pobierane jednym wspólnym odczytem.
Po zakończeniu odczytu aplikacja czeka 5 sekund, gdy kolejki mają pracę, lub 30 sekund,
gdy są bezczynne albo automat jest wstrzymany i nic się już nie przetwarza.
Ręcznie uruchomione pobieranie jest monitorowane co 3 sekundy. Termin zaplanowanej
próby może skrócić bezczynny odstęp. Ukryta karta wstrzymuje monitoring; powrót
odświeża go od razu. Ręczne odświeżanie nadal działa.
Błąd jednego portalu nie blokuje liczników pozostałych. Komunikat wskazuje niedostępne
portale oraz ostatni poprawny odczyt (w bieżącym procesie API), jeśli jest znany.
Poprzednie liczniki pozostają widoczne jako potencjalnie nieaktualne. **Ostatni pełny odczyt**
zmienia się dopiero po poprawnym odczycie wszystkich portali. Błędy są ponawiane co 5 sekund.

W **Aktualizacji** panel **Postęp skanowania portali** pokazuje osobno dla każdego
portalu sprawdzone strony, limit skanu, liczbę ofert dodanych do kolejki, **Dodano do duplikatów** i stan
skanowania. Liczniki odświeżają się co 2 sekundy podczas pracy, po zakończeniu
strony lub partii. Limit dla dzielnic obejmuje wszystkie grupy lokalizacji.
To maksymalny zakres, nie liczba stron dostępnych na portalu ani przewidywany czas:
skan może skończyć się wcześniej przy braku wyników lub błędzie. Wyniki liczników
pozostają widoczne po zakończeniu i odświeżeniu strony, do restartu API lub kolejnego skanu.
Skanowanie portali (również wznowienie Otodomu) działa w tle. Panel odczytuje wynik
krótkimi zapytaniami, więc długi skan nie przekracza limitu czasu pojedynczego
połączenia. Zamknięcie strony nie zatrzymuje pracy. Ponowne uruchomienie aktualizacji
dołącza do trwających skanów; zakończone portale mogą rozpocząć nowy skan.
Restart API przerywa zadania w tle; po restarcie uruchom aktualizację ponownie.
**Dodano do duplikatów** liczy nowe oferty z kolejki danego skanu, automatycznie
połączone z istniejącymi ofertami po pobraniu szczegółów i zapisaniu danych.
Licznik może rosnąć po zakończeniu skanowania (wtedy panel odświeża się co 10 sekund).
Nie obejmuje ofert już znanych, pominiętych ani tylko podejrzewanych o duplikat.
Dane dojazdu oraz preferencje należą do lokalnej instalacji. Opcjonalne konta chronią dostęp do wspólnej bazy; nie rozdzielają danych między użytkowników. [Włączenie logowania](login.md).

## Pierwsze dane i import

W **Aktualizacji** wybierz **Import i przygotowanie danych · ulice, oferty, RCN**.
W sekcji **Pierwsze uruchomienie** zobaczysz, czy katalog ulic jest już dostępny.
**Pobierz ulice Warszawy** pobiera katalog do lokalnej bazy; później ten sam przycisk
pozwala go odświeżyć. Pobieranie może potrwać kilka minut. Import aktualizuje istniejące
odcinki, więc ponowne uruchomienie nie tworzy ich duplikatów.
Poniżej dodasz pojedynczą ofertę z dowolnego obsługiwanego portalu lub dane cen RCN.
**Uruchom import RCN** pobiera najnowszy datowany plik ZIP/GML z [portalu m.st. Warszawy](https://architektura.um.warszawa.pl/udostepniane-dane-rcn1).
Import porównuje identyfikatory transakcji i lokali z lokalną bazą. Panel pokazuje liczbę
zapisanych transakcji, datę ostatniego dodania oraz datę najnowszego aktu dla
porównywalnego mieszkania. Uwzględnia lokale mieszkalne z podaną własną ceną,
powierzchnią 20–250 m² i ceną 3000–50 000 zł/m². Pomija wskazane udziały ułamkowe.
Odczyt statusu można ponowić po błędzie. W Aktualizacji sekcja **Ulice i ceny transakcyjne**
zawiera dopasowanie ulic i przycisk **Importuj transakcje**, prowadzący do RCN.
Przycisk **Wróć do aktualizacji** prowadzi do głównego panelu pobierania ofert.

W szczegółach oferty **Tab** porusza się po elementach okna, a **Escape** je zamyka
i przywraca fokus na liście. Jeśli otwarte jest zdjęcie, potwierdzenie odrzucenia lub
pełny ekran mapy, Escape zamyka najpierw tę warstwę.

## Porównanie

W szczegółach ofert wybierz **Porównaj** (maksymalnie pięć ofert). W zakładce **Porównanie**
ceny i cechy znajdują się w tych samych wierszach. Na małym ekranie przewijaj samą tabelę
w bok. Kliknięcie tytułu otwiera ofertę, krzyżyk usuwa ją z porównania, a **Dodaj oferty**
wraca do listy. Zmiana filtrów lub strony listy nie usuwa wcześniejszego wyboru.
Wybór zapisuje się w tej przeglądarce i pozostaje po odświeżeniu lub ponownym otwarciu.
Przy wejściu do porównania aplikacja pobiera aktualne ceny i cechy wybranych mieszkań.
Wiersz **Status oferty** oznacza oferty archiwalne. Gdy oferta zniknęła z bazy lub
odczyt się nie udał, wybór pozostaje zapisany; możesz użyć **Ponów odczyt** albo
**Usuń z porównania**. Niedostępne dane nie są zastępowane dawną ceną.
Jeśli przeglądarka blokuje zapis, komunikat informuje, że wybór działa tylko do odświeżenia.

Przełącznik **Tylko różnice** ukrywa identyczne wiersze dla co najmniej dwóch ofert.
Wspólny brak danych również znika; nie oznacza to identycznych mieszkań. **Brak danych**
różni się od **Nie**. Gdy wszystkie porównywane cechy są jednakowe, przycisk
**Pokaż wszystkie cechy** przywraca pełną tabelę. Nagłówki ofert pozostają widoczne.
Tabela obejmuje ekspozycję (z pierwszeństwem ręcznej korekty), status kontaktu, etap
decyzji, cenę po negocjacjach oraz zapisane **Notatki i ustalenia**.

**Oblicz dojazdy** pobiera trasy do celów zapisanych w ustawieniach. Każdy cel ma
osobny wiersz. Wynik to szacunek jazdy samochodem bez korków według OpenStreetMap;
przybliżona lokalizacja mieszkania obniża jego dokładność. Brak współrzędnych celu
lub oferty oraz niedostępna trasa mają osobne komunikaty. **Oblicz dojazdy ponownie**
ponawia odczyt; błąd jednej oferty nie usuwa wyników pozostałych. Zmiana wyboru,
lokalizacji lub celów wymaga ponownego obliczenia. Trasy nie są pobierane przy samym
wejściu na stronę i nie zapisują się pomiędzy wizytami w porównaniu.

## Preferencje i finansowanie

W szczegółach oferty **Garaż / parking** pokazuje rozpoznaną dopłatę lub **W cenie
mieszkania**. Komórka z osobną ceną ma własny wiersz. Gdy opis podaje jedną kwotę
za oba dodatki, widzisz **Garaż i komórka — … łącznie**; suma zakupu dolicza tę
kwotę tylko raz. Reguły obejmują istniejące opisy bez ponownego pobierania ofert.
Garaż i osobne miejsce przed budynkiem sumują się w polu **Garaż / parking**.
Parser rozpoznaje również zapis `60 000,-`, `50,000 PLN` oraz etykietę `Miejsce postojowe: 30 000 zł`.
Piwnica i ogródek są osobnymi dopłatami i nie zwiększają ceny samego parkingu.

### Dojazdy do pracy

W ustawieniach wybierz **Dodaj miejsce pracy** (maksymalnie 6). Wpisz nazwę oraz
ulicę, numer budynku i miejscowość, np. „Marszałkowska 1, Warszawa”. Numer lokalu
nie jest potrzebny; przy niejednoznacznej ulicy dopisz dzielnicę.
Kliknij **Znajdź adres na mapie**, wybierz pasujący wynik i sprawdź zaznaczony punkt.
Możesz poprawić go kliknięciem na mapie, np. wskazując wejście do biura, albo wpisać
szerokość i długość geograficzną. Na końcu kliknij **Zapisz ustawienia**.
Zmiana tekstu adresu usuwa poprzedni punkt, aby nie liczyć dojazdu do starego miejsca.
Jeśli wyszukiwarka nie odpowiada, nadal można wskazać punkt ręcznie.

Przy każdym celu wybierz **Tryb pracy**: **Dojeżdżam do pracy** albo **Pracuję z domu**.
Praca z domu nie wymaga adresu i nie wpływa na dojazd w DreamScore. Jedna osoba
dojeżdżająca oznacza jej czas; kilka — średnią ich czasów. Gdy wszyscy pracują z domu
albo nie ma celów, kryterium jest wyłączone. Istniejące cele domyślnie oznaczają dojeżdżanie.

DreamScore używa tras samochodem po drogach (OSRM), bez aktualnych korków.
Do 35 minut daje +12, 45 minut +8, 55 minut +4, od 70 minut −5, płynnie pomiędzy.
Brak choć jednej potrzebnej trasy daje częściową karę −3; nie zastępujemy jej linią prostą.
Lista oblicza brakujące trasy w tle i pokazuje postęp; odświeża się co 15 sekund.
Sortowanie DreamScore przygotowuje trasy dla wszystkich pasujących ofert, pozostałe
sortowania dla pobranej strony. Wyniki zapisują się lokalnie na 30 dni; zmiana punktu
oferty lub pracy wymaga nowej trasy. Nieudany odczyt ponawiany jest najwcześniej po 10 minutach.
Komunikacja publiczna nie jest jeszcze podłączona do punktacji.

Wyszukiwanie adresów korzysta z Nominatim/OpenStreetMap wyłącznie na żądanie,
z limitem 1 zapytania na sekundę dla aplikacji i cache wyników w bazie.
Obowiązuje [polityka Nominatim](https://operations.osmfoundation.org/policies/nominatim/).
Serwer można zmienić przez `NOMINATIM_BASE_URL` (adres z końcowym `/`).

Miasto w **Aktualizacji** pochodzi z **Preferencji wyszukiwania → Zakres pobieranych ofert**.
Przycisk **Zmień w preferencjach** otwiera ten sam formularz. Po zapisaniu nowe wyszukiwania
na wszystkich ośmiu portalach używają wybranego miasta.

Miasto zmienia się w preferencjach; dashboard nie ma osobnego pola miasta w filtrach.
Filtry dashboardu zapisują się po poprawnym zastosowaniu przyciskiem **Filtruj**
i wracają po zamknięciu przeglądarki lub restarcie komputera. **Reset** od razu
wczytuje listę bez filtrów i z sortowaniem **Najnowsze**; po udanym odczycie zapisuje reset.
Edycja pól nie zmienia jeszcze wyników ani zapisanego zestawu. Przejście na kolejną
stronę używa ostatnio zastosowanych filtrów i sortowania; niedokończony formularz pozostaje.
Przełączniki **Ulubione**, **Wszystkie**, **Tylko ukryte** stosują bieżące ustawienia formularza.
Przy błędzie pobierania listy lub mapy aplikacja pokazuje komunikat i **Ponów**.
Ostatnio odczytane wyniki pozostają widoczne, ale mogą być nieaktualne.
Trwały zapis nie obejmuje sortowania ani numeru strony; usunięcie danych strony usuwa zapis filtrów.
Sortowanie ofert obejmuje cenę za m² rosnąco i malejąco. Jest liczone z aktualnej ceny
i metrażu dla wszystkich wyników przed podziałem na strony; brakujące wartości są na końcu.
W **Zakresie pobieranych ofert** ustaw cenę od/do, minimalny metraż, liczbę pokoi
i dowolną liczbę dzielnic Warszawy. Pusty wybór dzielnic oznacza całe miasto.
Wyszukiwanie korzysta z zapisanych wartości; lista, mapa i liczniki korzystają też
z zapisanego miasta, minimalnego metrażu i maksymalnej ceny (bez dawnych stałych
56 m² i 2,2 mln zł). Dzielnice ograniczają nowe wyszukiwania, nie usuwają wcześniej
pobranych ofert. Preferowane dzielnice w profilu wymarzonego mieszkania pozostają
osobnym ustawieniem oceny dopasowania.

Otodom, Adresowo i Domiporta wyszukują wybrane lokalizacje wspólnie.
Maxon przeszukuje wybrane dzielnice osobno, korzystając z aktualnych adresów `/oferty/sprzedaz/mieszkania/…`.
Bez wybranych dzielnic Otodom przeszukuje całą Warszawę z filtrami ceny, metrażu
i liczby pokoi z ustawień. Pusty wynik lub błąd nie przełącza wyszukiwania na inną ścieżkę lokalizacji.
Morizon i Gratka przeszukują kolejno grupy do 3 dzielnic; OLX i Nieruchomości-online
po jednej. Każda grupa zaczyna od wskazanej strony, ma własny limit stron i koniec
paginacji. Powtórzone adresy ofert trafiają do kolejki tylko raz w danym przebiegu.
Gratka jest przeszukiwana od najnowszych ofert (`sort=newest`), również bez wybranych dzielnic.
Błąd jednej grupy jest raportowany, a pozostałe grupy są przeszukiwane dalej.
Linki ogłoszeń OLX są oczyszczane ze zbędnego parametru śledzącego `search_reason`.
Dotyczy to także ponawiania istniejących wpisów kolejki i ręcznego pobierania;
filtry stron wyszukiwania pozostają zachowane. Przy HTTP 403 lub błędzie serwera 5xx importer próbuje jednokrotnie
odczytu w Chromium (jedna przeglądarka naraz). Komunikat „To ogłoszenie nie jest
już dostępne” lub HTTP 404/410 oznacza niedostępne ogłoszenie: istniejąca oferta
jest archiwizowana, a wpis kolejki kończy się bez błędu importu.
Chromium wysyła standardowy nagłówek Chrome z własną aktualną wersją; domyślny
identyfikator `HeadlessChrome` powodował odpowiedź 403 z CDN OLX. Nie wymaga to
logowania ani przenoszenia cookies z przeglądarki użytkownika.
Jeśli również przeglądarka odmawia dostępu (403/429), OLX odkłada pozostałe wpisy
i wstrzymuje kolejne partie na 30 minut. Zachowuje zapisane oferty; odmowa dostępu
nie oznacza, że ogłoszenie zostało usunięte.

Adresowo archiwizuje zapisane ogłoszenie po komunikacie **Ogłoszenie usunięte**,
odpowiedzi HTTP 404/410 lub przekierowaniu na listę wyników. Cena pochodzi z danych
konkretnego ogłoszenia.
Maxon odczytuje aktualne linki `/oferta/…-ID` i dane strukturalne oferty, w tym cenę,
metraż i zdjęcia. Stary adres `/mieszkania/oferta/…` jest dopasowywany do mapy strony
wyłącznie po identycznym ID. Gdy aktualna mapa nie zawiera tego ID, kolejka pomija
stary adres i zachowuje zapisane ogłoszenie. Znalezienie nowego adresu dla tego samego
ID wznawia import. Przekierowanie z aktualnego adresu na listę ofert pozostaje błędem,
który można ponowić.
HTTP 404/410 pod adresem właściwej oferty archiwizuje zapisane ogłoszenie. Kolejka
kończy ten wpis, zachowując ostatnią zapisaną migawkę.
Nie pobieramy wówczas ceny z rekomendacji i nie uznajemy mieszkania za sprzedane.
Maxon: tak samo traktujemy **OFERTA NIEAKTUALNA** oraz komunikat
„Poszukiwana oferta … nie jest już aktualna”. Pełne pobranie danych i odświeżenie
ceny archiwizują istniejącą ofertę, zachowując ostatnią cenę, opis i zdjęcia.
Brak ceny na takiej stronie nie jest błędem importu. Jeśli oferta wygasła jeszcze
przed pierwszym importem, kolejka kończy wpis jako niedostępny bez tworzenia oferty.

Cena opisana jako „Mieszkanie z miejscem garażowym: 1 680 000 PLN” oznacza
garaż w cenie mieszkania i nie jest ponownie doliczana do kosztu zakupu.
Dotyczy to również zapisów „Mieszkanie + garaż + komórka” i ceny łącznej pakietu.
Jeżeli opis podaje osobno dopłatę, zachowujemy ją niezależnie od kolejności kwot:
mieszkanie 1 240 000 zł + garaż i komórka 80 000 zł daje podstawę kalkulacji
raty 1 320 000 zł. Cena całego pakietu nie zastępuje dopłaty.
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

Na telefonie liczba dopasowań i sortowanie są w jednym wierszu, a zakres aktualnej strony jest przy paginacji. Przy odwróconych granicach filtra wybierz **Zamień wartości**, a następnie **Filtruj**. Na telefonie **Rynek** otwiera dolny panel ze statystykami i wyborem okresu.

Na zdjęciu warunki zakupu poprzedzają prowizję i parking. Etykieta miejsca pokazuje wykrytą dopłatę. Najedź na kółko lub przejdź do niego klawiszem Tab, aby zobaczyć podpis wyniku. Na telefonie **Ulubione** obok **Filtry** przełączają widok zapisanych mieszkań, zachowując aktualny zakres i sortowanie. Kolejność możesz zmienić przy liczbie wyników. Link **Zobacz rzut** otwiera rozpoznany plan w galerii. Kliknij procent dopasowania, aby zobaczyć najważniejsze potwierdzone plusy i minusy oraz liczbę niewiadomych. Na mobilnej karcie pod zdjęciem znajdziesz tytuł, lokalizację od dzielnicy do ulicy, cenę i podstawowe parametry. Obowiązek zakupu parkingu sprawdzisz w kosztach w szczegółach. Informacja o zakupie za gotówkę prowadzi do słów sprzedającego w opisie.

W szczegółach pod tytułem są ID i **Kopiuj link**. Przed galerią znajdziesz akcje odświeżania danych, ulubionych, porównania, archiwizacji, odrzucenia i kalkulacji. Przy kalkulacji tabela publikacji pozwala porównać parametry ogłoszeń i osobno sprawdzić kandydatów do powiązania.

Jeżeli po aktualizacji serwera otwarta karta odwołuje się do starego modułu widoku,
aplikacja próbuje raz automatycznie się odświeżyć. Przy utrzymującym się błędzie
wyświetla przycisk **Odśwież aplikację** zamiast pustego ekranu.

Kafelek **Pokoje / Piętro** na karcie pokazuje oba parametry. Parter ma numer **0** (np. **0 / 5**),
a brak piętra kreskę. Obok metrażu znajduje się **Rok budowy**; kreska oznacza brak roku.
Opis „na ostatnim, 4. piętrze” uzupełnia **4 / 4**, także przy zapisie słownym
„na czwartym, ostatnim piętrze”. Samo „ostatnie piętro” nie wystarcza do ustalenia
liczby pięter. „Budynek z ok. 2000 roku” uzupełnia rok **2000**; daty remontu
nie są rokiem budowy. Dopiski takie jak „na warszawskiej Pradze-Południe” są
usuwane z nazwy ulicy. Reguły są wspólne dla portali.
Pełny adres w opisie, np. „znajduje się w Warszawie-Wesołej przy ul. Długiej 80B”,
ma pierwszeństwo przed błędną dzielnicą portalu; numer domu pozostaje w adresie.
Dotyczy to także filtrowania dzielnic. Przy imporcie punkt spoza wskazanej dzielnicy
jest zastępowany lokalnym przybliżeniem ulicy albo pomijany, jeśli brak dopasowania.
Zapis „na drugim piętrze w 2-kondygnacyjnym budynku” jest pokazywany jako **2 / 2**.
Przełączniki **Ulubione / Wszystkie / Tylko ukryte** mają ikony i wyróżniony aktywny wybór.
Dodawanie do porównania jest dostępne po otwarciu szczegółów oferty;
na kartach dashboardu nie ma przycisku **Porównaj**.

Kliknięcie tytułu otwiera ofertę na zdjęciu oglądanym na karcie. Zdjęcie wybrane w powiększeniu pozostaje widoczne po powrocie do szczegółów i na listę. Na telefonie przypięty pasek pokazuje nazwę aktualnej sekcji. Dotknij jej, aby rozwinąć listę zakładek, lub zamknij ofertę przyciskiem po prawej.

W **Szczegółach oferty** telefon kontaktowy i cel negocjacji są w zakładce **Notatki**.
Telefon jest wstępnie uzupełniany numerem z ogłoszenia, jeśli nie zapisano własnego.
Na telefonie mapa znajduje się pod opisem, a **Działka i planowanie** na dole zakładki **Przegląd**. Ta sekcja nie pojawia się w Notatkach, Cechach, Ocenie ani Duplikatach.
Pole **Szukaj w ofercie** przeszukuje także adres, dzielnicę i okolicę; np. Okopowa
znajduje również Okopowej. Filtry dzielnicy i sortowania obsługują strzałki, Enter i Escape.
Lista dzielnic obejmuje wszystkie 18 dzielnic Warszawy, w tym Targówek i Rembertów.
W preferencjach lokalizacji każda dzielnica zawiera pełną listę obszarów MSI
z mapy statystyk — łącznie 143 obszary, w tym wszystkie 5 obszarów Ursusa.
Wybór obszaru na mapie statystyk obramowuje jego kartę w rozwiniętej tabeli.
Wybranie innego obszaru przenosi obramowanie, a zmiana dzielnicy je czyści.
Obliczone statystyki są przechowywane przez 30 sekund dla danego zestawu filtrów
i ustawień wyszukiwania. Powrót do tego samego widoku korzysta z gotowego wyniku;
zmiany w ofertach mogą być widoczne z opóźnieniem do 30 sekund. Równoczesne
odczyty tych samych statystyk współdzielą obliczenia.

Na głównej mapie i mapie szczegółów oferty kliknij przystanek, a następnie numer
tramwaju w okienku. Wybrana trasa i jej przystanki zostaną wyróżnione. Przycisk
pokazania wszystkich tramwajów przywraca pełny widok.
Filtr dzielnicy obowiązuje razem z wyszukiwanym tekstem; samo wystąpienie „Wesoła”
w opisie np. dojazdów nie oznacza, że oferta leży w Wesołej. Dzielnica wskazana
w lokalizacyjnej części tytułu ma takie samo pierwszeństwo w filtrze i widoku oferty.
Ocena nie uwzględnia gabinetu. Nieznany stan wykończenia daje 0 pkt.
Limit zakupu dotyczy samego mieszkania: do limitu +15, każde 1% przekroczenia
odejmuje płynnie 3 pkt; przy 5% jest 0, od 10% −15. Cena za m²: przy limicie +10,
25% taniej +20, 5% drożej 0, od 10% drożej −10; pomiędzy płynnie i po zaokrągleniu.
Metraż ponad 5 m² poza zakresem daje −3 pkt, a metro powyżej 150% limitu −3 pkt.
Metro bliżej niż 60% ustawionego limitu daje dodatkowe +3 pkt, czyli łącznie +13.
Dokładnie na granicy 60% pozostaje +10 pkt. Odległość jest liczona w linii prostej.
Dojazd oceniamy według czasu trasy samochodem; piętro względem wysokości budynku.
Jednostronne południe daje +4, dwustronny wschód–zachód +18.
Tabela oceny pokazuje **Kryterium**, **Punkty** oraz **Dane / powód**.
Zapis **+18 (25)** oznacza 18 zdobytych punktów z 25 możliwych. Powody pokazują wiek
w dniach oraz czas dojazdu i ratę. Garaż daje +15 albo parking zewnętrzny +8
w ramach jednego kryterium (maks. 15). Przy wymaganym parkingu potwierdzony brak
obu daje −36, brak informacji −18; przy niewymaganym odpowiednio −10 i −5.
Garaż z windą zachowuje dodatkowe +12. Winda daje +21; potwierdzony brak −20,
brak informacji −10, na parterze bez kary.

Filtr **Tylko zmiana ceny** wymaga rzeczywistej zmiany pomiędzy dwiema dodatnimi
kwotami. Uzupełnienie brakującej ceny nie jest podwyżką. Karta i szczegóły pokazują
ostatnią rzeczywistą zmianę, także gdy później odnotowano ponowne wystawienie.
Jeżeli nowe ogłoszenie nie ma jeszcze własnej zmiany ceny, procent na karcie,
w szczegółach i na mapie uwzględnia różnicę ceny z ustalonego ponownego wystawienia.
Ta różnica kwalifikuje ofertę również do filtra **Tylko zmiana ceny**. Późniejsza
zmiana ceny nowego ogłoszenia ma pierwszeństwo. Same propozycje powiązań oraz
ponowne wystawienie za tę samą cenę nie tworzą obniżki ani podwyżki.
Okno oferty można zamknąć przyciskiem lub kliknięciem tła, również podczas ładowania.
Podczas ładowania działa także Escape; w galerii Escape zamyka podgląd zdjęcia.
Kliknięcie lub dotknięcie tła poza zdjęciem również zamyka pełnoekranowy podgląd.
Przesuwanie i powiększanie zdjęcia oraz przyciski galerii nie zamykają podglądu.
Zamknięcie anuluje żądania przeglądarki i zapobiega ponownemu otwarciu przez spóźnioną odpowiedź.

## Zapamiętywanie statystyk i gesty

Dzielnice i poddzielnice są normalizowane przed liczeniem statystyk, dzięki czemu np.
Gocław i Praga-Południe trafiają do jednej dzielnicy. Mediany powstają z pojedynczych ofert.
Segmenty pokazują medianę i kwartyle cen za m² (środkowe 50%) przy co najmniej 5 ofertach
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
Komunikat **Niezastosowane zmiany** oznacza, że wyniki nadal odpowiadają ostatnio
zatwierdzonym filtrom. W **Monitorze kupującego** przełącznik 30/60/90/180 dni zmienia
okno obliczeń indeksu presji. Każdy okres ma własną historię porównawczą. Gdy jest za
krótka, panel sprawdza też okno wynikające z liczby dni zapisanej historii, z miejscem
na dwa wcześniejsze odczyty oddalone o 30 dni. Okno może przyrastać o dzień z każdym
kolejnym dniem historii. Odczyt nadal wymaga pokrycia co najmniej 70% wag dla segmentu.
Historyczna rekonstrukcja obejmuje cechy, które można odtworzyć z zapisów portali.
Nagłówek wskazuje rzeczywisty okres indeksu. Liczby obniżek i podwyżek obejmują zakres
wybrany na stronie. Przy dłuższych okresach poniżej widać również dostępne odczyty
indeksu 30-dniowego. Zmiany punktowe za 30 i 90 dni porównują
odczyty indeksu obliczonego dla tego samego okna.
Miary ekspozycji, zmian cen i podaży są zawsze widoczne pod indeksem.
Pod skrótem monitora wybór miary w rankingu dzielnic zmienia również skalę kolorów mapy.
Wybierz dzielnicę, a następnie numerowany obszar MSI, aby zobaczyć liczebność i średnią
cenę aktywnych ofert przypisanych do tej nazwy. **Cała Warszawa** przywraca widok dzielnic.
Na telefonie ranking początkowo obejmuje pięć pozycji oraz wybraną dzielnicę.
Kliknięcie mieszkania na liście pod heatmapą otwiera statystyki tego ogłoszenia.
Zamknięcie szczegółów przywraca listę z tym samym segmentem i sortowaniem.
W statystykach mieszkania **Podobne mieszkania** pokazuje całkowitą liczebność grupy.
Po otwarciu widać trzy najbliższe metrażem oferty. **Pokaż wszystkie** rozwija pełną listę.
W sekcji **Rynek w czasie** wybierz jeden z sześciu wykresów. Podpis wskazuje, czy
analiza dotyczy całego zakresu filtrów strony, czy segmentu wybranego w monitorze.
W **Strukturze ofert** wybierz wymiar, np. czynsz. Grupy mają wspólną skalę cen za m².
Odcinek pokazuje kwartyle, a pionowa kreska medianę ceny ofertowej.
W **Ile mieszkań mieści się w budżecie?** wpisz kwotę całkowitą i rezerwę na dodatki.
Licznik pokazuje dopasowania wśród aktywnych ofert ze znaną ceną po odjęciu rezerwy.
W podsumowaniu rynku odsetek obniżek dotyczy wszystkich aktywnych ofert.
Monitor porównuje kolejne udokumentowane ceny ofert ze znaną ceną odniesienia.
W **Ustaw analizowany rynek** można zaznaczyć **Komórka / piwnica** oraz wybrać
kierunki w kompasie. Wystarczy co najmniej jeden wybrany kierunek: N obejmuje
także mieszkania północ–południe, a S + SE + SW obejmuje oferty z dowolnym z tych
trzech kierunków. Dodatkowe kierunki mieszkania nie wykluczają oferty.
Przy częściowym wyborze pomijane są oferty bez podanych kierunków.
Pusty wybór i wszystkie osiem kierunków nie ograniczają ofert. **Pokaż wyniki**
stosuje filtry do wszystkich wskaźników, tabel i wykresów; **Wyczyść** resetuje je.

Koszt parkingu „dwa miejsca po 35 000 zł” to 70 000 zł, a „dwóch miejsc w cenie
50 000 za miejsce” to 100 000 zł. Cena opisana jako łączna nie jest mnożona.
W szczegółach oferty **Łączna cena zakupu** pokazuje cenę mieszkania z dodatkami,
a **Cena całkowita / m²** dzieli tę kwotę przez metraż mieszkania. Zwykłe **PLN/m2**
nadal pokazuje cenę samego mieszkania za metr; brak metrażu daje kreskę.
Opcjonalny zakup konkretnego miejsca oferowanego z mieszkaniem oznacza jego dostępność.
Jednoznaczna informacja, że miejsce nie przynależy do mieszkania, oznacza **Brak miejsca postojowego**,
także gdy opis wspomina możliwość późniejszego dokupienia lub wynajęcia miejsca w inwestycji.
Taka możliwość nie daje punktów za garaż i nie dolicza ceny miejsca do zakupu.
Ręczne ustalenie po rozmowie ze sprzedawcą zachowuje pierwszeństwo. Mieszkanie narożne jest traktowane
jako co najmniej dwustronne, ale konkretne kierunki muszą wynikać z opisu.
W punktacji wymarzonego mieszkania brak windy na parterze daje 0 pkt zamiast −20;
obecna winda nadal daje +21 pkt. Reguła obejmuje też parter rozpoznany z opisu.
Po odświeżeniu wracają zarówno zastosowane kryteria, jak i rozpoczęte zmiany w polach.
**Pokaż wyniki** zatwierdza zmiany, a **Wyczyść** usuwa kryteria.

Mapa w szczegółach oferty obsługuje kółko myszy oraz powiększanie dwoma palcami.

Na mapie głównej wybierz przynajmniej jeden filtr ofert. Przycisk **Pokaż filtry /
Ukryj filtry** działa również na komputerze. Liczby w zielonych kółkach oznaczają
grupy ofert: kliknięcie od razu pokazuje listę wszystkich ofert z tej grupy.
Kliknij wybraną pozycję, żeby otworzyć ogłoszenie — także gdy kilka ofert ma
dokładnie ten sam adres. Nie trzeba przybliżać mapy. Lista obok mapy ma strony po 50 ofert;
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

## Historyczna średnia cen

W statystykach wykres **Ceny i liczba ofert — tygodniowo** pokazuje wykryte oferty,
archiwizacje, medianę cen wykrytych oraz średnią i medianę cen ofert aktywnych
na koniec danego tygodnia (w bieżącym tygodniu do teraz). Ceny są podane za m².
Najedź na tydzień, aby odczytać wartości. Kliknięcie, dotknięcie lub wybór tygodnia
z listy zostawia wartości pod wykresem. Na wykresie zmian cen w dzielnicach liczby obok
słupków pozostają widoczne. Najechanie na dzielnicę pokazuje oba wyniki razem.
Średnia uwzględnia zapisane zmiany cen, daty wykrycia i archiwizacji oraz zakres filtrów.
Brak udokumentowanej ceny w okresie wyklucza ofertę z obliczeń tej ceny.

W **Monitorze kupującego** wybierz dzielnicę i liczbę pokoi. Kliknięcie komórki mapy
cieplnej zawęża także metraż. Wykres indeksu porównuje ceny tych samych ogłoszeń,
a wykres ekspozycji pokazuje aktywność i pierwsze obniżki od dnia wykrycia.

**Buyer Power Index** mierzy eksperymentalną presję na sprzedających względem historii
monitorowanego segmentu. Aplikacja utrwala pierwszy pomiar każdego dnia UTC. Domyślny
zakres jest sprawdzany automatycznie podczas pracy API, a dodatkowe zestawy filtrów przy
otwarciu Statystyk. Zapis obejmuje dzielnice i segmenty metrażu oraz pokoi. Dziury w historii
pozostają widoczne. Do kalibracji jednej składowej potrzeba co najmniej sześciu
wcześniejszych zapisów oddalonych o wielokrotność 30 dni. Poziom 50 oznacza historyczny
środek, a wynik przy pokryciu od 70% do poniżej 100% wykorzystuje przeskalowane wagi.
Rozwiń **Jak liczymy indeks i jaki jest zakres obserwacji?**, aby zobaczyć wagi, wkłady
punktowe i porównania sprzed 30 i 90 dni. Wcześniej dostępny jest wynik wstępny względem
przynajmniej dwóch historycznych okresów odtworzonych z wersji ogłoszeń portali.
Każdy odczyt wykorzystuje tylko zapisane do tego dnia ceny, statusy, metraże i liczbę pokoi.
Ogłoszenia między portalami mogą się powtarzać. W rankingu zestawiamy dzielnice z tej
samej serii o takim samym zestawie dostępnych składowych.
Mediany łącznej przeceny w złotych i procentach liczymy osobno dla tych samych przecenionych
aktywnych ofert z historią od pierwszego dnia. Tabela wieku obejmuje też oferty archiwalne.

W zakładce **Statystyki** mieszkania trzy osobne oceny opisują presję całego monitorowanego
rynku, zachowanie konkretnego ogłoszenia (**Negotiation Score**) i pozycję jego ceny w grupie
porównawczej (**Value Score**). Cena względem sąsiadów nie jest składnikiem oceny negocjacyjnej.
Przy sortowaniu według przesłanek negocjacyjnych lista pokazuje konkretne powody.
W szczegółach mieszkania otwartego z dashboardu wybierz **Statystyki**, obok **Przeglądu**.
W sekcji **Cena na tle podobnych mieszkań** półkolista skala porządkuje ceny za m² od najtańszych po lewej do najdroższych po prawej. Wskazówka pokazuje pozycję mieszkania. Oferty o identycznej cenie dzielą środkową pozycję swojej grupy. Najedź na fragment łuku, dotknij go lub wybierz klawiaturą, aby odczytać przedział cen. Pod wykresem można rozwinąć grupę porównawczą i otworzyć podobne ogłoszenia.
Mediana i różnica procentowa wymagają co najmniej 5 innych aktywnych ogłoszeń.
Grupy 5–9 mieszkań są oznaczone jako małe. Przy braku obniżki i obserwacji krótszej niż
14 dni ocena negocjacyjna podaje „Krótka obserwacja”. Brak porównania wieku przy braku
obniżek także nie uprawnia do przyznania zera.
Dashboard uwzględnia także tańsze oferty oraz część ogłoszeń z brakującymi danymi.
Statystyki stosują pełne warunki ceny, metrażu i liczby pokoi wskazane pod licznikiem.

## Potencjalne wcześniejsze oferty

W **Duplikatach** są zakładki **Duplikaty** i **Oferty wystawione ponownie**.
Pierwsza zawiera weryfikację grup oraz **Znajdź i połącz**. Druga ma podzakładki
**Połączone oferty** (już zapisane powiązania) i **Potencjalne powiązania** (pary czekające
na decyzję). Listy wczytują zapisane wyniki także po odświeżeniu strony, po 20 par na stronę.
**Odśwież listę** odczytuje aktualny zapis; **Sprawdź oferty** uruchamia nowe porównanie aktywnych
ogłoszeń z archiwum, łączy mocne dopasowania i zapisuje pozostałe propozycje.
W **Połączonych ofertach** można użyć **Potwierdź powiązanie**, aby zatwierdzić automatyczne
dopasowanie, albo **Rozłącz oferty**, aby usunąć błędne powiązanie. Rozłączenie zachowuje
oba ogłoszenia, ich ceny i historię; zapisuje też odrzucenie, więc kolejny skan nie łączy
tej pary ponownie. Potwierdzenie i rozłączenie aktualizują tylko daną kartę, bez pobierania listy.
Propozycja może pojawić się mimo zmienionego
opisu, gdy zgadzają się ulica, metraż, pokoje i piętro albo opis i lokalizacja są
dostatecznie podobne. Archiwalna oferta musi poprzedzać obecną. Samo podobieństwo
dzielnicy nie wystarcza. Sprzeczne piętra lub numery budynków wykluczają automatyczne
połączenie; przy mocnej zgodności opisu para może trafić do ręcznej weryfikacji.

W szczegółach **Historia ogłoszenia i ceny** grupuje zdarzenia według dnia, od najnowszego. Widać osobno publikację na portalu, pierwszy zapis w aplikacji, zmiany ceny i moment odnotowania zdjęcia oferty. Oś obejmuje również najwcześniejsze powiązane ogłoszenie archiwalne. Przycisk **Archiwum** z nazwą portalu otwiera jego szczegóły. Możesz rozwinąć pozostałe wcześniejsze ogłoszenia. Gdy brakuje daty zdjęcia, przy odnośniku do archiwum widać informację o braku daty.

Karty pokazują zdjęcia, obie ceny, adresy, parametry, daty i powody podobieństwa. Kliknięcie
zdjęcia lub tytułu otwiera szczegóły nad bieżącą listą. W szczegółach można przeglądać
i powiększać zdjęcia. Zamknięcie szczegółów zachowuje zakładkę, filtry, stronę i pozycję
listy. Decyzja odświeża propozycje bez nowego skanu i bez zmiany zakładki, także gdy
zapiszesz ją w szczegółach. Decyzja usuwa rozstrzygniętą parę z widoku miejscowo,
bez ponownego pobierania kolejki ani przeładowania pozostałych kart.
Różnica cen propozycji jest porównaniem dwóch
ogłoszeń, a nie potwierdzoną zmianą ceny tego samego mieszkania.

Propozycje zapisują się po skanie. Szczegóły aktywnej oferty wyszukują też wcześniejsze
ogłoszenia na żądanie. **Powiąż tę ofertę** zapisuje jedną parę i pozostawia pozostałe
propozycje do rozstrzygnięcia. W zakładce **Duplikaty** sekcja **Powiązane wcześniejsze
ogłoszenia** pokazuje historię z linkami i połączonymi kopiami. Każdą parę można
rozłączyć osobno. Ręcznie odrzucone pary są pomijane podczas kolejnych skanów.

W widoku połączonych duplikatów **Rozłącz** przy ogłoszeniu odłącza tylko tę ofertę.
Jeśli w grupie zostały co najmniej dwie oferty, możesz od razu porównać je ponownie.
**Wróć do listy grup** przywraca poprzednie filtry i stronę. **Rozłącz całą grupę**
pyta o potwierdzenie, przywraca każdej ofercie jej cenę źródłową i zapisuje odrzucenie
wszystkich par z tej grupy.

Etykiety **Nieuregulowany grunt** i **Cesja mieszkania** pojawiają się na podstawie
treści ogłoszenia. W ocenie wymarzonego mieszkania pierwsza odejmuje 12 punktów
surowych, druga 5. Rozpiska oceny pokazuje je w pozycji **Warunki transakcji**.
Podstawą do oznaczenia cesji jest informacja o transakcji dotyczącej mieszkania.

Automatyczne powiązanie wymaga mocnych zgodności, wyniku co najmniej 90% i braku
sprzeczności w piętrze/numerze budynku. Niższe wyniki, np. 70%, sprawdź przyciskami
**Połącz jako ponowne wystawienie** albo **To inne mieszkania**. Decyzje są trwałe:
skan nie nadpisuje ręcznego potwierdzenia ani nie przywraca odrzuconej pary.
Połączenie wiąże aktywną ofertę z archiwalną i zachowuje oba rekordy oraz ich ceny.
Nie usuwa wcześniejszego ogłoszenia ani jego historii.

W widokach **Połączone** i **Propozycje** menu **Kolejność ponownych wystawień**
sortuje całą kolejkę po dacie dodania aktualnej oferty, podobieństwie, największej
procentowej zmianie ceny lub obniżce. Każdy widok ma własną kolejność.
Przycisk **Sprawdź oferty** znajdziesz w sekcji **Skan ponownych wystawień**.

### Kolejka duplikatów i zdjęcia

W **Powiązaniach ofert** wybierz **Duplikaty**, a potem **Do weryfikacji** albo
**Propozycje**. Wyszukiwarka grup sprawdza tytuł, adres, portal i identyfikator.
Menu **Filtry i sortowanie** pozwala ograniczyć wyniki do portalu lub grup
z rozbieżnościami i zmienić kolejność. Wyszukiwanie i sortowanie obejmują całą kolejkę.
Propozycje domyślnie pokazują najwyższe podobieństwo z zakresu **80–100%**. Możesz
zawęzić zakres do **60–79%** lub wyświetlić wszystkie pasujące pary. Komunikat
**Rozbieżne adresy w ogłoszeniach** wskazuje różnicę wartą sprawdzenia.

**Do weryfikacji** zawiera scalone duplikaty oczekujące na kontrolę.
Zatwierdzenie usuwa grupę z kolejki. Karty pokazują porównanie statusu, adresu, metrażu,
piętra, pokoi i cen źródłowych. Przy propozycji widać przewidywaną ofertę główną,
liczbę dołączanych ogłoszeń i rozmiar grupy po połączeniu. Otwieranie i zamykanie oferty
z miniatury lub przycisku zachowuje wybraną podzakładkę, filtry i stronę propozycji.
**To nie duplikat** usuwa wyłącznie odrzuconą parę z bieżącego widoku. Pozostałe
karty pozostają na miejscu; kolejka nie jest ponownie pobierana, także po odrzuceniu
w szczegółach. Następna strona uwzględnia usunięte pary, aby nie pomijać propozycji.

W szczegółach oferty i w potencjalnych powiązaniach użyj **Połącz duplikaty** albo
**To nie duplikat**. Nie trzeba wybierać, którą ofertę zostawić. Aplikacja wybiera
główną spośród całej grupy: aktywna ma pierwszeństwo przed archiwalną, następnie
Otodom, a potem portal z największą liczbą ogłoszeń w lokalnej bazie. Przy remisie
pozostaje starszy rekord. Linki źródłowe, zdjęcia i historia połączonych ofert są zachowane.
Po połączeniu w szczegółach otwiera się automatycznie wybrana oferta główna.

Miniatury korzystają ze zdjęć danej oferty: najpierw z dostępnych plików lokalnych,
potem z adresów źródłowych. Niedostępne zdjęcie jest zastępowane kolejnym.
**Pobierz zdjęcia** ponawia pobranie kilku obrazów. Jeśli nie ma zapisanych adresów,
otwórz ofertę i wybierz **Pobierz dane**. Panel nie podstawia zdjęcia innego ogłoszenia
w miejsce brakującego — mogłoby to ukryć błędne połączenie.

## Notatki i przeglądanie ofert

**Notatki** zawierają notatkę, kompas ekspozycji oraz korekty windy, garażu, komórki
i dopłat. Pola etapów, kontaktu, negocjacji i informacji od sprzedającego zostały
usunięte z formularza. Wcześniej zapisane dane pozostają zachowane.

Strzałki po bokach szczegółów przełączają oferty w kolejności bieżących wyników,
z tymi samymi filtrami i sortowaniem. Działają również klawisze **← / →**, z wyjątkiem
pisania w polach, obsługi mapy i podglądu zdjęć. Nawigacja i licznik są dostępne tylko
na laptopach i PC (szerokość powyżej 900 px). Na telefonie szczegóły zajmują pełną
wysokość, bez przycisków i skrótów do przełączania ofert.

Na końcu strony **Następna strona · pierwsza oferta** otwiera pierwszą ofertę kolejnej
strony. Z jej początku **Poprzednia strona · ostatnia oferta** pozwala wrócić.
Na początku i końcu całych wyników odpowiednia strzałka jest nieaktywna.
Zmiany w Notatkach zapisują się przed przejściem strzałką; błąd zapisu lub pobrania
pozostawia bieżącą ofertę otwartą i pozwala spróbować ponownie.

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
liter i interpunkcję. Różnica metrażu nie może przekroczyć 2% mniejszego metrażu
(np. 50 i 51 m² — tak, 50 i 60 m² — nie), również po połączeniu całych grup.
Bez znanego dodatniego metrażu automat nie łączy ofert. Limit 2% znanych metraży
obowiązuje także przy ręcznym zatwierdzaniu duplikatu. Jeśli łączysz archiwalne
ogłoszenie lub archiwalną grupę z aktualną ofertą, kliknij **Połącz duplikaty**.
Gdy różnica przekracza 2%, zobaczysz zakres metraży i liczbę ogłoszeń w obu grupach.
Potwierdzenie dołącza całą grupę do aktywnej oferty. Możesz też anulować operację.
Pary oznaczone jako różne oferty pozostają rozdzielone.
Reguła działa podczas przetwarzania ofert i skanowania w zakładce **Duplikaty**.

W szczegółach oferty zakładka **Duplikaty** pokazuje połączone ogłoszenia i kandydatów.
Aktywne i archiwalne ogłoszenia są w osobnych sekcjach. W **Przeglądzie** wiersz
**Portale** zawiera linki do aktywnych ogłoszeń.
**Potencjalne duplikaty** są też dostępne w **Przeglądzie**, nad dojazdami do pracy,
z tymi samymi przyciskami do rozstrzygania kandydatów.
Wyniki są pamiętane przez 5 minut w bieżącej sesji (do 100 ofert), także gdy lista
jest pusta. Powrót do obejrzanej oferty korzysta z zapisanej listy lub już trwającego
zapytania. Decyzja o duplikacie, rozłączenie, import lub pobranie danych z portalu
czyści cache; przeładowanie aplikacji również rozpoczyna nową sesję.
Zakładka skupia się na powiązaniach; sekcja działki i planowania nie jest w niej wyświetlana.
Przycisk **Rozłącz duplikat** przywraca osobną ofertę wraz z jej ceną źródłową.
Rozłączanie zapamiętuje odrzucenie względem wszystkich pozostałych członków grupy,
aby kolejne automatyczne skanowanie nie cofnęło decyzji. Można też otworzyć stronę
źródłową każdego ogłoszenia i sprawdzić, czy rzeczywiście dotyczy tego samego mieszkania.

W zakładce **Notatki** kompas **Ekspozycja mieszkania** pozwala ręcznie wskazać
kierunki okien. Bez ręcznej korekty zaznacza kierunki rozpoznane w opisie i oznacza
je jako **Z opisu**. Zatwierdź korektę przyciskiem **Zapisz notatki do oferty**. Zapisany wybór
ma pierwszeństwo przed opisem w kompasie, ocenie i filtrze kierunków w statystykach.
Ponowne pobranie danych portalu zachowuje ustalenia. **Przywróć odczyt z opisu**
i zapis notatek usuwa ręczną korektę. Samo zaznaczenie kierunków bez zapisu nie
zmienia danych mieszkania. Podgląd w zakładce **Ocena** przelicza się od razu po
zmianie kierunków lub przywróceniu odczytu z opisu. Do aktualizacji oceny na liście
ofert potrzebny jest zapis notatek.

Dane M1/M2/M3, planowanych odcinków metra oraz 28 stacji WKD są częścią aplikacji: są dostępne także przy pustej lub zaimportowanej bazie ofert. Planowane lokalizacje M4/M5 i przedłużenia M2 do Ursusa są orientacyjne. Źródła: [metro i WKD](../reference/metro-map-sources.md).

### Ogrzewanie i sieć ciepłownicza

Linie warstwy są pogrubione na ekranie bez skalowania mapy ani zmiany położenia sieci.

Na mapie ofert i w mapie mieszkania zaznacz **Sieć ciepłownicza (GESUT)**.
Ustaw środek mapy na interesującym budynku i wybierz **Przybliż do sieci**.
Kafle są pobierane dopiero przy dużym zbliżeniu. W razie błędu użyj **Ponów warstwę**.
Warstwa pokazuje dane udostępniane przez powiaty, w tym sieci projektowane.
Pusta mapa nie oznacza braku sieci; linia przy budynku nie potwierdza przyłącza.

Przy mapie mieszkania znajduje się odczyt źródła ogrzewania z opisu ogłoszenia.
Rozwiń **Źródło: opis ogłoszenia**, aby zobaczyć fragment będący podstawą odczytu.
Informacja pozostaje **Do potwierdzenia u zarządcy budynku**. Samo „centralne
ogrzewanie”, brak opisu i niejednoznaczne wzmianki dają **Ogrzewanie nieustalone**.
Wynik aktualizuje się razem z opisem; nie jest potwierdzeniem urzędowym ani ręczną
deklaracją użytkownika. Szczegóły: [źródła danych o ogrzewaniu](../reference/heating-networks.md).

## Zapisana analiza okolicy

Pełna analiza w sekcji **Okolica** zapisuje się przy ofercie. Przy ponownym otwarciu
tej samej lokalizacji aplikacja odczytuje wynik z bazy, także po restarcie.
Odległość do metra jest mierzona w linii prostej od pinezki do stacji z lokalnego
katalogu. Zmiana pinezki powoduje odczyt lub analizę nowej lokalizacji. Przycisk
**Odśwież analizę okolicy** pobiera aktualne dane mapowe. Jeśli serwer zwróci błąd
lub niepełną odpowiedź, ostatnia pełna analiza pozostaje dostępna.

## Rozstrzygnięcia w duplikatach i wydruk porównania

W **Duplikatach** rozwiń **Zapisz rozstrzygnięcie i źródło**, następnie wczytaj
ustalenia. Można zapisać poprawną powierzchnię, liczbę pokoi, piętro i wyjaśnienie
historii/tożsamości mieszkania. Są powiązane z główną ofertą. To zapis weryfikacji, nie automatyczne nadpisanie danych portali
ani rankingu. Potwierdzenie lub rozdzielenie grupy nadal wykonuje się istniejącymi
przyciskami po sprawdzeniu ogłoszeń. Sam konflikt nie dowodzi błędnego scalenia.
Przy równoczesnej edycji starszy formularz zostanie odrzucony; odczytaj aktualny
zapis przed ponowną zmianą.

W **Porównaniu** przycisk **Drukuj / zapisz PDF** otwiera wydruk wszystkich cech
wybranych ofert, także gdy na ekranie włączono „Tylko różnice”. W oknie drukowania
wybierz zapis do PDF. Wydruk zawiera cenę z rozpoznanymi dodatkami, niewiadome,
datę eksportu i linki do źródeł, również scalonych ofert. Opcja dołączenia prywatnych
notatek jest domyślnie wyłączona. Eksport odzwierciedla aktualnie wczytane dane;
nie odświeża ogłoszeń z portali i nie wylicza brakujących kosztów.

Kopie danych i odtwarzanie opisuje [osobna instrukcja](backup.md).

Na stronie **Duplikaty**, w potencjalnych powiązaniach, przycisk **Połącz duplikaty**
łączy parę bez otwierania szczegółów. Lista obejmuje również oferty archiwalne.
Jeśli jedna z łączonych ofert jest aktywna, pozostaje ofertą główną.
**Pobierz zdjęcia** ponawia pobieranie zapisanych adresów zdjęć także dla archiwum.
Podgląd wykorzystuje własne zdjęcia oferty, a w razie ich braku zdjęcia z jej już
połączonej grupy z podpisem **Zdjęcie z połączonej oferty**. Nie pobiera zdjęć
z drugiej, jeszcze niepotwierdzonej strony proponowanej pary.

Ekspozycja z wyraźnym określeniem **dwustronna**, np. „dwustronna ekspozycja
południowo-zachodnia”, oznacza **południe i zachód**. Reguła działa również dla
pozostałych par kierunków, filtrów i oceny ofert. Sama „ekspozycja południowo-zachodnia”
oznacza kierunek SW. Dwie osobno wymienione ekspozycje ukośne (np. NE i SW) pozostają
dwoma kierunkami ukośnymi. Ręczna korekta ma pierwszeństwo.

W statystykach mieszkania potwierdzenie ponownego wystawienia rozszerza historię używaną przez Negotiation Score. Wiek oznacza czas od pierwszej obserwacji w aplikacji i może obejmować przerwy między publikacjami. Data publikacji na portalu jest pokazana osobno na osi czasu.

Karta „Rzeczywiste przeceny” bierze ostatnią obniżkę każdej aktywnej oferty w wybranym okresie. Przy potwierdzonym ponownym wystawieniu porównuje pierwszy zapis ceny nowego ogłoszenia z ostatnim dostępnym zapisem ceny poprzednika sprzed tej daty. Data ręcznego powiązania nie przesuwa obniżki w czasie. Techniczna synchronizacja ceny między portalami nie jest obniżką.

Licznik obniżek w podsumowaniu rynku, wykres dzielnic i karta rzeczywistych przecen korzystają ze wspólnej historii zmian. Wliczane są również różnice między kolejnymi zapisami ceny tej samej publikacji oraz wcześniejsze obniżki z potwierdzonego łańcucha wystawień w wybranym okresie. Na dashboardzie „Zmiany cen” obejmują oba kierunki. Kliknięcie otwiera listę dla tego samego okresu i zakresu dashboardu.
