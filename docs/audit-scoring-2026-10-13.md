# Audyt punktacji „Wymarzone mieszkanie” — 2026-10-13

Zakres: przegląd algorytmu, wag, braków danych i progów; materiał do wspólnego ustalenia zmian. Sekcja problemów opisuje **stan przed zmianami z tej sesji**. Liczby w niej wynikają z kodu przed zmianą i syntetycznych przykładów, z domyślnym profilem aplikacji (377 punktów maksimum), a nie z odczytu prywatnych ustawień lub pomiaru rzeczywistego rankingu. Punkty surowe i punkty procentowe wyniku to różne jednostki.

Ostateczne doprecyzowanie użytkownika: **parking jest konieczny, ale może być zewnętrzny; garaż +15; winda jest konieczna; bez drastycznego osłabienia tych kryteriów**. Zastępuje to wcześniejszy pomysł wyzerowania kary za brak parkingu.

## Zmiany uzgodnione po audycie

- Garaż +15 zamiast +24 przy wymaganym parkingu (+16 bez wymogu). Brak zarówno garażu, jak i parkingu zewnętrznego zachowuje karę −36 przy wymaganym parkingu, inaczej −10.
- Parking zewnętrzny bez garażu daje dotychczasowe +8 i znosi karę za brak garażu. Obecna punktacja windy +21 / −20 (z dotychczasowym wyjątkiem parteru) oraz premia garażu z windą +12 pozostają. Są to silne preferencje rankingu, nie nowe automatyczne filtry odrzucające oferty.
- Domyślny mianownik po zmianie premii garażu wynosi 368; pozostałe uwagi o konstrukcji maksimum nadal wymagają decyzji. Różnica garażu i windy wobec braku obu spada ze 113 do 104 pkt surowych. Garaż z windą ma 19 pkt przewagi nad parkingiem zewnętrznym z windą.
- Karty zasad są domyślnym widokiem Oceny, z pogrubionym warunkiem zastosowanym do oferty; tabela i szczegółowe objaśnienia są w „Dane rozwinięte”.
- Naprawiono globalną walidację formularza ponownego wystawienia (`previousId`, `decision`). Zwykłe łączenie duplikatów i ponowne wystawienia objęto testami HTTP z prawdziwą walidacją i izolowaną bazą testową.
- Ulubione mają grubszą, stale pulsującą ramkę i złoty tytuł; ocena procentowa jest większa o 1 px na laptopie/PC. Ustawienie ograniczenia animacji jest respektowane.

Pozostałe propozycje poniżej nie zostały wdrożone.

## Potwierdzone problemy i propozycje

### 1. Garaż i winda dominują w różnicy ocen

Przy wymaganym garażu: garaż +24 / brak −36, winda +21 / brak −20 poza parterem, oba razem +12. Przejście od obu udogodnień do braku obu to 113 pkt różnicy, około 30 punktów procentowych przy domyślnym profilu. Sam brak garażu przy zachowanej windzie kosztuje 72 pkt, około 19 punktów procentowych. Dla porównania cała preferowana lokalizacja daje 20 pkt, metraż 20, metro maksymalnie 13.

Wyłączenie „wymaganego” garażu nadal oznacza +16 / −10 i premię wspólną +12; nie wyłącza kryterium. Brak garażu przy windzie nadal kosztuje 38 pkt względem posiadania garażu.

Pierwotna propozycja wyzerowania kary i usunięcia premii wspólnej została odrzucona po doprecyzowaniu potrzeb. Uzgodniona mniejsza korekta jest opisana powyżej. Do dalszego rozważenia: ocena windy zależnie od piętra i faktycznej dostępności; obecny bonus nie dowodzi połączenia windy z garażem.

### 2. Brak danych bywa traktowany jak potwierdzona wada

Brak informacji o garażu może dawać −36, o windzie −20, balkonie −8, roku −3, dojeździe −5, czynszu −2. Równocześnie brak ekspozycji to 0, a potwierdzona północ −15. Panel pokazuje pokrycie danych, ale nie usuwa tych kar. Ocena częściowo mierzy szczegółowość ogłoszenia.

Propozycja: jawnie rozróżnić „jest”, „nie ma”, „nie wiadomo”. Nie karać braku informacji tak jak potwierdzonego braku. Zachować wspólną skalę oraz osobne pokrycie/zakres niepewności; samo usuwanie nieznanych kryteriów z mianownika mogłoby sztucznie premiować ubogie ogłoszenia. Ostateczna metoda wymaga sprawdzenia na ofertach o różnym pokryciu.

### 3. Premie za opis są zbyt łatwe do uzyskania

Uruchomiony kod potwierdził:

| Opis                                     | Należna według kodu premia | Problem                                           |
| ---------------------------------------- | -------------------------: | ------------------------------------------------- |
| Jasne meble.                             |      +5 „Jasne mieszkanie” | Kolor mebli nie potwierdza doświetlenia.          |
| Budynek zaprojektowany przez architekta. |             +8 „Architekt” | Nie potwierdza projektu wnętrza ani jego jakości. |
| Wysoka jakość obsługi.                   |       +4 „Wysoki standard” | Opis dotyczy obsługi sprzedającego.               |

Same hasła o jasności, standardzie i architekcie mogą dać razem +17, więcej niż maksymalna premia za metro (+13) albo dwie łazienki (+4) i garderobę (+5) razem. Blat daje do +8, czyli dwukrotnie więcej niż dwie łazienki. Ocena stanu, materiałów, remontu, architekta i standardu może też wielokrotnie premiować ten sam aspekt mieszkania.

Propozycja: doprecyzować kontekst rozpoznawania; „architekt” 0–2 zamiast 8, ogólny „wysoki standard” 0 zamiast 4, blat 2–3 zamiast 8. Jasność oprzeć na ekspozycji i potwierdzonych informacjach o mieszkaniu. Rozważyć wspólny limit premii za wykończenie, żeby obszerny opis nie wypierał podstawowych potrzeb.

### 4. Ekspozycja ma nielogiczne relacje

Pojedynczy kierunek SW daje −5, choć sam S i sam W po +4. Dwie strony S/W dają +20, ale dodanie trzeciej strony E zmniejsza wynik do +18. Są to dwa różne problemy: kierunek ukośny nie powinien udawać dwóch stron, ale nie powinien wpadać do kategorii nieznanego kierunku. Dodanie korzystnej strony nie powinno automatycznie obniżać wyniku.

Propozycja: osobna ocena pojedynczych kierunków ukośnych oraz konsekwentna premia za liczbę stron, z limitem całej kategorii. Nie utożsamiać deklaracji „jasne” z pomiarem światła.

### 5. Mianownik obejmuje wzajemnie wykluczające się premie

Maksimum zawiera +24 za garaż i +8 za parking zewnętrzny, ale te drugie punkty są dostępne wyłącznie bez garażu. Już to uniemożliwia osiągnięcie 100%. Przy domyślnym profilu i wszystkich innych maksimach górna granica wynikająca z tego konfliktu wynosi 369/377, zaokrąglone 98%; inne ograniczenia mogą ją jeszcze obniżyć. Ponadto przy minimum pięciu pokoi maksima liczby pokoi i układu nadal odpowiadają czterem pokojom, choć cztery nie spełniają minimum.

Propozycja: maksimum powinno opisywać osiągalny ideał. Połączyć alternatywy parkingu w jedną kategorię i wyliczać maksimum zgodnie z aktywnymi preferencjami. To zmieni interpretację procentów, nawet bez zmiany kolejności ofert dla danego profilu.

### 6. Pokoje są liczone podwójnie, „układ” nie bada układu

Trzy pokoje na 80 m² otrzymują +11 za liczbę pokoi i +4 za układ, razem 15. Cztery otrzymują +18 i +8, razem 26. „Układ” nie sprawdza przechodnich pokoi, osobnej kuchni, korytarzy ani rozmiarów sypialni. To druga premia za tę samą liczbę pokoi. Ustawienie minimum dwóch pokoi nadal nie daje premii lokalowi dwupokojowemu; stała preferencja minimum trzech jest zaszyta w kodzie.

Propozycja: jedna kategoria pokoi/metrażu albo rzeczywista ocena funkcjonalności, gdy są dane. Wyższa ocena czterech pokoi może być celowa, ale powinna być jawna i zgodna z profilem.

### 7. Ceny mają gwałtowne progi i różne podstawy

Przy domyślnym limicie 1 800 000 zł: dokładnie limit daje +15, a 1 800 001 zł daje −5. Jedna złotówka różnicy kosztuje 20 pkt. Podobny skok istnieje dla ceny za m² (+10 → −5), a szacowana rata przechodzi z około 0 do −10 po przekroczeniu 7500 zł.

„Cena zakupu” korzysta z `priceLabel`; rata preferuje `totalAcquisitionPrice`. Syntetyczna oferta z ceną bazową 1,5 mln i kosztem całkowitym 2 mln nadal dostaje +15 za cenę zakupu. To potwierdza różne podstawy w algorytmie; nie przesądza, ile rzeczywistych ofert ma tak duże dopłaty. Jednocześnie cena wpływa na cenę całkowitą, cenę/m², ratę, a przy niewykończonym lokalu również ocenę stanu. Progi stanu 17–21 tys. zł/m² i raty 7500 zł są stałe, niezależne od limitów profilu. Rata używa stałych 5,8% i 360 miesięcy; są to parametry aplikacji, nie zweryfikowana oferta finansowania.

Propozycja: płynne przejście przy granicy budżetu, spójna jawna definicja ceny z wymaganymi dopłatami, ograniczenie wielokrotnego wpływu tej samej ceny. Parametry finansowania i ewentualny twardy limit budżetu ustalić osobno.

### 8. Piętro automatycznie premiuje wysokość

Drugie piętro ma +2, trzynaste +12, ostatnie dodatkowo +5. To preferencja wysokich pięter, nie ogólna ocena jakości. Winda na parterze daje +21, choć brak windy na parterze daje 0. Brak windy na pierwszym i trzynastym piętrze karany jest jednakowo (−20).

Propozycja: preferowany przedział pięter i kara za brak windy zależna od piętra. Premia za ostatnie piętro wymaga osobistej decyzji; algorytm nie bada izolacji dachu, temperatur ani widoku.

### 9. Dojazd nie oznacza czasu podróży

Punkty wynikają ze średniej odległości w linii prostej, a nie z czasu dojazdu. Średnia maskuje nierówny dojazd dwóch osób. Brak jakiegokolwiek miejsca pracy nadal daje −5 i zachowuje 12 pkt w maksimum. Przy częściowych współrzędnych wynik jest liczony z dostępnych miejsc, chociaż pokrycie jest niepełne.

Propozycja: wyłączyć kategorię, jeśli nie skonfigurowano pracy; przy danych częściowych nie udawać pełnej oceny. Docelowo używać czasów podróży albo jawnie nazwać kryterium odległością i ustalić, czy liczy się średnia, czy gorszy dojazd.

### 10. Atrakcyjność mieszkania miesza się z warunkami ogłoszenia

Obniżka ceny daje do +7, świeżość od +2 do −2, oferta prywatna +10, prowizja −15. To może być przydatne przy wyborze, z kim się kontaktować, ale dwie identycznie wycenione nieruchomości różnią się oceną przez wcześniejszą zawyżoną cenę lub wiek ogłoszenia. Prywatna oferta ma +10, a pośrednik jawnie bez prowizji 0.

Propozycja: świeżość i obniżkę traktować jako osobne sygnały do kontaktu. Warunki zakupu opierać na faktycznym koszcie, a premię za bezpośredni kontakt utrzymać tylko jako świadomą preferencję.

## Proponowana kolejność dalszych prac

1. Naprawić oczywiste niespójności: fałszywe premie tekstowe, kierunki ukośne, nieosiągalne maksimum, nieaktywne dojazdy.
2. Ustalić semantykę braku danych i granic budżetu.
3. Dobrać pozostałe wagi wykończenia, pokoi i pięter. Parking i winda zachowują dużą wagę zgodnie z końcową decyzją użytkownika.
4. Porównać stary i proponowany ranking na znanych użytkownikowi ofertach; sprawdzić przyczyny awansów i spadków przed wdrożeniem.

## Weryfikacja i źródła

Przeczytano wszystkie reguły `computeDreamEvaluation` i pomocnicze funkcje budynku/ekspozycji, analizę opisów, wartości domyślne profilu oraz istniejące testy opisujące część intencjonalnych zachowań. Lokalny skrypt na źródłach sprzed zmian wykonał 11 asercji dla różnic garażu/windy, premii opisowych, ekspozycji, granicy budżetu, podstawy ceny, niewymaganego garażu i minimum pokoi. Osobno wyświetlił trzy powtarzalne fałszywe premie tekstowe. To audyt reguł, nie pomiar wpływu na rzeczywistą bazę ofert. Końcowa weryfikacja zmian jest zapisana w [TODO](TODO.md).

- [Algorytm i reguły](../packages/shared/src/dream-score.ts)
- [Piętro, rok i ekspozycja](../packages/shared/src/dream-building.ts)
- [Rozpoznawanie cech opisu](../packages/shared/src/dream-description.ts)
- [Profil domyślny](../packages/shared/src/index.ts)
- [Istniejące testy punktacji](../apps/web/src/features/listings/lib/dream-profile.test.ts)

Skrypt roboczy: `.local/runs/2026-10-13-scoring-audit/audit.ts` (poza Git).
