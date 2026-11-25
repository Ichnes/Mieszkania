# Statystyki mieszkań — audyt i projekt widoku

25 listopada 2026 · pierwszy etap redesignu · decyzje do wdrożenia

## Co zobaczyłem w aplikacji

Sprawdziłem lokalne `/statystyki` na danych aplikacji, przy domyślnych filtrach i okresie 30 dni. Playwright zaczekał na Monitor kupującego i wykresy tygodniowe. Pozycje poniżej to początek nagłówka od góry dokumentu, przed wyborem dzielnicy.

| Widok | Wysokość strony | Początek mapy | Początek rankingu |
|---|---:|---:|---:|
| Desktop 1440 × 900 | 9166 px | 4644 px | 4662 px |
| Laptop 1024 × 900 | 12 431 px | 4736 px | 5541 px |
| Telefon 390 × 844 | 22 088 px | 8510 px | 9094 px |

Na każdej szerokości kliknięcie Mokotowa otworzyło 12 numerowanych obszarów MSI. Wybór Augustówki z listy wyróżnił obszar. W ciemnym motywie miedziane granice dobrze odcinają mapę od zielonkawego tła. Wszystkie dzielnice mają jednakowe wypełnienie. Mapa dobrze odpowiada dziś na pytanie „gdzie kliknąć?”, ale cenę lub częstość obniżek odczytuje się z sąsiedniej tabeli. Tabela podaje dla Mokotowa 13 poddzielnic, przy 12 obszarach na mapie. Nazwy lokalizacji z ogłoszeń i oficjalny podział MSI wymagają osobnych etykiet.

### Co zachować i gdzie użytkownik traci orientację

| Element | Wartość obecnego rozwiązania | Problem do rozwiązania |
|---|---|---|
| Filtry i kompas | Można świadomie określić okres, parametry lokalu i światło, a następnie zastosować wybór. | Na telefonie sam nagłówek kompasu zaczyna się około 863 px od góry. Zastosowany zakres powinien być widoczny również przy wynikach. |
| Sygnały i stan rynku | Konkretne liczby dotyczą aktywności sprzedających, ceny i podaży. | Po sygnałach pojawia się sześć równorzędnych kafli, trzy paski i osiem miar monitora. Liczby opisujące różne populacje wyglądają jak jeden zestaw. |
| Monitor | Pokazuje historię, kompletność indeksu i osobne miary przydatne przy zakupie. | Na desktopie 33,3/100 zajmuje jedną z ośmiu podobnych komórek. Kierunek zmiany, pokrycie i brak porównania za 90 dni mieszczą się w jednym drobnym podpisie. |
| Mapa i ranking | Oba wejścia wybierają tę samą dzielnicę. MSI mają rzeczywiste granice, numery i listę nazw. | Na szerokim ekranie ranking ciągnie się poniżej mapy. Przy 1024 px rozpoczyna się pod nią. Na telefonie pełna lista odsuwa kolejne analizy o kilka ekranów. |
| Heatmapa i lista mieszkań | Kliknięcie komórki zawęża segment, a z listy można otworzyć ofertę. | Zmieniają się także inne analizy monitora. Przy przewijaniu znika informacja o przyczynie zmiany. Liczebność komórki i liczba porównań konkretnej oferty mają inne znaczenia. |
| Struktura i źródła | Pokazują kwartyle oraz luki w opisach. Portal może być wspólny dla kilku publikacji mieszkania. | Siedem podobnych zestawień kończy stronę. Czytelnik musi przewinąć nieinteresujące go podziały, aby znaleźć np. czynsz. |

## Docelowa kolejność i układ

| Kolejność | Widoczne od razu | Po wyborze lub rozwinięciu |
|---|---|---|
| 1. Filtry rynku | Okres 30/90/180, grupa „Mieszkanie”, grupa „Udogodnienia”, osobny kompas, Wyczyść i Pokaż wyniki. Na telefonie siatka zakresów od–do. | Przy wynikach krótki opis zastosowanych filtrów i powrót do edycji. Rozróżnić zmiany oczekujące od zastosowanych. |
| 2. Sygnały rynku | Liczba aktywnych i trzy sygnały z jednym zdaniem objaśnienia. Rzeczywista przecena jako sygnał główny, obok kolejna obniżka i najdłuższa obserwacja. | Czwarty sygnał o dzielnicy prowadzi do rankingu obniżek z tym samym okresem. |
| 3. Co dzieje się teraz | Dwa duże KPI — aktywne mieszkania i mediana aktywnych. Obok zestawione w parę wykrycia i archiwizacje. | Jeden wiersz z medianą nowych, ekspozycją i udziałem przecenionych. Każda zmiana podaje okres odniesienia. |
| 4. Monitor kupującego | Po lewej poziomy wskaźnik z pięcioma segmentami, markerem i stałym środkiem 50. Obok interpretacja, zmiana 30 dni, próba, pokrycie i status wstępny. Pod spodem aktywne/archiwalne z obniżką, mediana przeceny w zł i %, kwartyle ekspozycji. | Wkłady składowych, historia 30/90, tabela presji według wieku i metodologia. Na telefonie wskaźnik zajmuje pełną szerokość. |
| 5. Gdzie szukać | Mapa i ranking lokalizacji tworzą jeden blok. Wybór miary dotyczy obu. Po kliknięciu lokalny nagłówek np. „Mokotów · obszary MSI”, liczebność i powrót do Warszawy. | Kliknięcie obszaru pokazuje lokalne ceny i próbę pod mapą. Lista zawiera również lokalizacje o nieustalonym MSI, wyraźnie podpisane. |
| 6. Segmenty i mieszkania do sprawdzenia | Heatmapa dzielnica × metraż, legenda aktualnej miary oraz sortowana lista z wybranego segmentu. Nad listą nazwa segmentu, liczba wyników i reset wyboru. | Szczegóły mieszkania otwierają zakładkę Statystyki. Powrót odtwarza segment, sortowanie i pozycję listy. |
| 7. Rynek w czasie | Przełącznik analizy nad jednym aktywnym wykresem. Domyślnie trend cen ofertowych z wyborem okresu. | Indeks tych samych mieszkań, przeżywalność ofert, tygodniowy bilans, korekty cen w dzielnicach i histogram zł/m². Wskaźniki mają własne jednostki i definicje populacji. |
| 8. Twój rynek, struktura i źródła | Budżet i rezerwa w jednym bloku. Osobny eksplorator struktury z wyborem wymiaru. | Pokoje, metraż, rocznik, rynek, stan i czynsz we wspólnym widoku kwartylowym. Na końcu zasięg i wyłączność portali oraz braki danych. |

Na desktopie skrót monitora i blok lokalizacji powinny sąsiadować w pionie. Długie analizy monitora otwierają się dopiero na życzenie. Na laptopie należy dobierać dwie kolumny według dostępnej szerokości treści. Na telefonie pod mapą pokazujemy pięć pozycji rankingu i przycisk „Pokaż wszystkie 18”; aktualnie wybrana dzielnica zawsze pozostaje widoczna. Żadna akcja na mapie nie powinna przesuwać nagłówka spod palca.

## Mapowanie komponentów

| Obecny kod | Decyzja i zakres |
|---|---|
| `StatisticsPage`, `StatsControls`, `ExposureFilterCompass` | Zachować logikę zastosowania filtrów, okres i kompas. W stronie składać sekcje i trzymać jawny zakres globalny. |
| `MarketPulse` | Zachować obliczenia i akcje, wydzielić `MarketSignalCard` z liczbą, jednostką, mianownikiem i pojedynczym zdaniem. |
| `MarketStatsPanel` | Wydzielić `KPIGrid`, blok lokalizacji i przełączany eksplorator struktury. Przenieść informacje o jakości obok metryki, której dotyczą. |
| `BuyerMarketPanel`, `PressureOverview` | Zachować obliczenia, wydzielić `SegmentedLinearGauge` i `ExpandableMethodologyBlock`. Oddzielić skrót od narzędzi pogłębionej analizy. |
| `StatsDistrictMap` i tabela dzielnic | Użyć istniejącej geometrii i obsługi klawiatury jako podstawy `DistrictDrilldownMap`. Wspólny stan wyboru dla mapy i `RankingTable`; bez drugiego mechanizmu dopasowania nazw. |
| Heatmapa i ranking w `BuyerMarketPanel` | Wydzielić `SegmentHeatmap` i listę ofert. Przekazywać aktywny segment jawnie. Dodać `SampleSizeIndicator` również w szczegółach porównań. |
| `MarketActivityChart`, wykresy w monitorze | Zachować serie i interakcje. Wspólne tooltipy, formatowanie kwot, legenda, punkt odniesienia i niezależna od koloru identyfikacja serii. |
| `BuyerBudget`, źródła i segmenty w `MarketStatsPanel` | Zachować budżet. Przed wpisaniem kwoty pokazać krótką instrukcję; po wpisaniu pokazać dostępny budżet po odjęciu rezerwy, licznik i mianownik. Zero dopasowań odróżnić od braku cen. Źródła przenieść do analizy uzupełniającej. |

## Wizualizacje i wiarygodność danych

- **Indeks presji.** Wskaźnik liniowy ma skalę 0–100 i środek podpisany „typowy poziom dla segmentu”. Dziś 33,3/100 i +4,8 pkt za 30 dni można odczytać jako presję poniżej historycznego odniesienia, która ostatnio wzrosła. Przy braku poprzedniego odczytu pokazać „Brak porównania”. Status wstępny oznacza rekonstrukcję publikacji portali, w której mieszkanie może wystąpić dwukrotnie. Nie nadawać tej próbie etykiety unikalnych nieruchomości. Zakres indeksu jest 30-dniowy również po wybraniu innego okresu strony.
- **Przeceny.** Widoczne w audycie 11,4% oraz 5% leżą blisko siebie i oba dotyczą aktywnych. Przed połączeniem komponentów spisać dla każdej miary definicję zdarzenia, kohortę, zakres i mianownik. „Co najmniej jedna obniżka w okresie” oraz „ostatnia cena niższa od pierwszej” zasługują na osobne podpisy. Mediana procentowych przecen ma być liczona z procentu dla każdego mieszkania.
- **Próby.** `SampleSizeIndicator` pokazuje liczbę i opis: 1–3 bardzo mała, 4–9 mała, 10–29 ograniczona, 30–99 średnia, 100+ duża. Dla zera rozróżnić brak ofert i brak pomiaru. Liczyć surowe liczebności od jednego mieszkania, prostą lokalną medianę można pokazać od czterech znanych cen, porównania ofert od pięciu podobnych lokali. Przy udziałach pokazać np. „1 z 5 · 20%”. Liczba mieszkań w segmencie może być większa od liczby znanych cen. Nie szacować mianownika z zaokrąglonego procentu.
- **Ranking lokalizacji.** Początkowo sortować surowe dane z widocznym n i możliwością sortowania po liczebności. Rozważyć wygładzanie wyłącznie dla rankingu udziałów po sprawdzeniu wpływu pojedynczego mieszkania na kolejność. Ewentualną wartość wygładzoną podpisać oddzielnie i zachować surowy ułamek.
- **Mapa i heatmapa.** Ciągła skala dla zł/m², dni lub udziałów, osobny neutralny wzór „brak danych”, wyraźny kontur wyboru. Na mapie MSI zachować numery oraz listę nazw. Obszar bez dopasowanych obserwacji pozostaje klikalny. Określić zgodność MSI z nazwami portalowymi przed agregacją.
- **Wykresy czasu.** Dwie serie cenowe w zł/m² mają jedną oś; liczebność pokazać wyrównanymi słupkami z osobną skalą. Indeks tych samych ofert zaczyna się od 100 i pokazuje liczbę par, również bez zmiany ceny. Brak ceny historycznej tworzy lukę. Krzywa ekspozycji ma postać schodkową, z liczebnością obserwowanych na kolejnych progach. Archiwizacja oznacza zniknięcie ogłoszenia. Dla pierwszej obniżki jawnie opisać sposób traktowania archiwizacji bez przeceny.
- **Bilans, obniżki i struktura.** Wykrycia i archiwizacje oraz obniżki i podwyżki rysować po przeciwnych stronach wspólnego zera. Oddzielić pierwsze napełnienie bazy od późniejszego przepływu. Histogram pokazuje liczbę ofert w jednoznacznych przedziałach zł/m². W eksploratorze segmentów zaznaczyć medianę punktem na odcinku Q1–Q3, na wspólnej skali dla widocznych grup. Tooltip dostępny myszą, dotykiem i klawiaturą podaje miarę, okres i n.
- **Warstwa danych.** Przed wdrożeniem potwierdzić dla każdego endpointu jednostkę (nieruchomość, publikacja, zdarzenie), liczbę prawidłowych obserwacji i zakres czasu. Dodać jawne liczniki do odpowiedzi API tam, gdzie klient otrzymuje tylko agregat. Porównania z rynkiem bez filtrów i zmiany w czasie muszą mieć różne podpisy. Cena ofertowa oraz transakcyjna RCN wymagają osobnych serii i prób.

## Etapy wdrożenia i kryteria odbioru

1. **Kontrakt danych i punkt odniesienia.** Spisać definicje wszystkich KPI oraz zachować zrzuty referencyjne. Testy dla n = 0, 1, 3, 4, 5, 9, 10, 29, 30, 99, 100, nieznanej ceny, rzeczywistego zera oraz braku poprzedniego okresu. Przy tych samych filtrach przed i po redesignie liczby muszą się zgadzać, a każda celowa zmiana definicji ma opis.
2. **Filtry, sygnały, snapshot i skrót monitora.** Wprowadzić hierarchię i gauge bez zmiany źródeł danych. Sprawdzić zastosowanie oraz reset filtrów i kompasu dla 30/90/180 dni. Odczyt, interpretacja, pokrycie i n dostępne bez rozwijania metodologii. Rozwinięcie klawiaturą i dotykiem nie zmienia położenia kontrolki.
3. **Lokalizacje i przejście do mieszkania.** Mapa i tabela wybierają tę samą dzielnicę w obu kierunkach. Test przejścia Warszawa → Mokotów → Augustówka → Warszawa, także klawiaturą. Sprawdzić małą próbę, brak MSI, reset i zmianę sortowania. Kliknięcie heatmapy określa segment listy, a powrót z oferty zachowuje wybór. Na telefonie dostęp do mapy przez skrót sekcji i bez przewijania analiz szczegółowych.
4. **Trendy, budżet i struktura.** Jedna wybrana analiza w każdej rodzinie wykresów; wszystkie dotychczasowe miary osiągalne z opisanych przełączników. Zweryfikować jednostki, tooltipy i luki w danych. Budżet ma osobne stany przed wpisaniem kwoty, przy braku dopasowań oraz przy znalezionych ofertach.
5. **Odbiór porównawczy.** Powtórzyć pomiar na 1440, 1024 i 390 px w obu motywach, także po zastosowaniu restrykcyjnych filtrów. Brak poziomego przewijania całej strony, zasłoniętych elementów i skaczącej mapy. Tabele mogą przewijać się wewnątrz swojej sekcji. Cel projektowy: co najmniej o połowę krótsza domyślna strona na telefonie względem 22 088 px, z zachowaniem dojścia do każdej analizy. Sprawdzić kontrast drobnego tekstu i tooltipów oraz czas od kliknięcia do otwarcia szczegółów na tych samych danych.
