# Kalibracja DreamScore — ustalenia z 13 października 2026

Ten dokument opisuje drugą rundę rozmowy. Pierwszy [audyt](audit-scoring-2026-10-13.md)
pokazuje wcześniejsze zasady; sama naprawa formularzy i zmiana garażu nie kończyły kalibracji.

## Preferencje i przyjęte reguły

| Kryterium           | Ustalenie i realizacja                                                                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parking             | Konieczny, także zewnętrzny. Garaż +15 albo zewnętrzny +8, wspólne maksimum 15. Potwierdzony brak obu −36, niepełne dane −18. Przy niewymaganym parkingu −10 / −5. Premia garażu z windą +12 zachowana.                    |
| Winda               | Konieczna: +21, potwierdzony brak −20, brak informacji −10; parter bez kary.                                                                                                                                               |
| Pokoje              | Cztery idealne, trzy dobrym kompromisem. Jedno kryterium: 4 → 25; 3 → 18, z rozpoznaną sypialnią/pokojem dziecięcym ponad 12 m² → 23. Salon wykluczony. Więcej niż 4 → 23, przy minimum profilu ponad 4 → 25.              |
| Piętro              | Względem wysokości bloku: zaokrąglone 9 × piętro / liczba pięter oraz +3 za ostatnie. 4/5 → 7, 5/5 i 13/13 → 12. Parter −4. Bez wysokości brak premii, chyba że ostatnie piętro potwierdza opis.                           |
| Wykończenie         | Gotowe zdecydowanie lepsze; wykończenie tylko przy dużej oszczędności. Dotychczasowa przewaga gotowego (+16) i progi tańszego stanu deweloperskiego zachowane.                                                             |
| Konkretne materiały | Architekt wnętrza 5, blat maks. 7 (drewno 5), podłoga drewniana 8. Slogan standardu 1. Armatura łazienkowa max 2, z konkretnym rodzajem/marką i kontekstem łazienki.                                                       |
| WC / pralnia        | Jedno wspólne kryterium: dwie łazienki 4 albo osobne WC / pralnia 3. Bez sumowania. Nie dodano punktów za pomieszczenie gospodarcze ani brak pokoi przechodnich. Komórka nadal 9.                                          |
| Zakup               | Limit dotyczy samego mieszkania. Do limitu 15, potem −3 za każdy 1% przekroczenia; 5% → 0, od 10% → −15.                                                                                                                   |
| Cena za m²          | Premia za rabat zachowana: limit 10, 25% poniżej 20. Powyżej płynnie: 5% → 0, od 10% → −10.                                                                                                                                |
| Rata                | Limit edytowalny, początkowo 7500 zł. Premia maleje do 0 przy limicie; kara rośnie do −10 przy przekroczeniu o 20%. Podstawa obejmuje znane dodatki do zakupu.                                                             |
| Ekspozycja          | Dwie strony najważniejsze. S/W 20, S/E i E/W 18, S/N 15, N/W 13, N/E 11. Pojedynczy SW dodatni (6); dodatkowy kierunek nie obniża dobrej pary.                                                                             |
| Braki danych        | Połowa kary za niepotwierdzony brak parkingu, windy, balkonu. Sam brak garażu nie dowodzi braku parkingu zewnętrznego.                                                                                                     |
| Lokalizacja         | Dzielnice, metro i dojazd pozostają trzema istotnymi elementami.                                                                                                                                                           |
| Dojazdy             | Preferowana komunikacja; zaakceptowany pierwszy etap samochodem po drogach, bez aktualnych korków. Do 35 min 12, 45 min 8, 55 min 4, od 70 min −5, płynnie pomiędzy.                                                       |
| Tryb pracy          | Osoba pracująca z domu nie wpływa na dojazd. Jedna dojeżdżająca — jej czas; kilka — średnia. Bez dojeżdżających kryterium wyłączone. Brak którejkolwiek trasy oznacza częściową karę −3, bez średniej z niepełnych danych. |
| Sygnały ogłoszenia  | Na życzenie zachowano obniżkę do 7 i świeżość do 2. Obniżka jest preferencją negocjacyjną, nie dowodem możliwości kolejnego rabatu.                                                                                        |

## Dane i ograniczenia

- Metraż sypialni jest odczytywany ostrożnie z jednoznacznego pomiaru w opisie. Brak pomiaru nie dowodzi małego pokoju; premia czeka na dane. Wstępne przeszukanie opisów znajdowało kandydatów w około 20% ofert trzypokojowych, nie była to miara trafności parsera.
- Trasy samochodowe pobierane są macierzami OSRM, kolejno z odstępem ponad sekundę. Cache na 30 dni uwzględnia oba końce trasy; restart go nie usuwa. Błędy i brak trasy nie są zastępowane odległością w linii prostej.
- Ranking przygotowuje brakujące trasy w tle. Przed końcem obliczeń ocena dojazdu może być niepełna; lista informuje o postępie i odświeża się automatycznie.
- Komunikacja publiczna pozostaje możliwym osobnym rozszerzeniem wymagającym źródła rozkładów/routingu. Nie podłączano płatnego konta ani usługi.

## Zgłoszony filtr zmian ceny

Warunek oparty wyłącznie na typie zdarzenia przepuszczał uzupełnienie nieznanej ceny jako
podwyżkę. W lokalnej diagnostyce było 15 takich aktywnych widocznych ofert spośród 788
pasujących do starego warunku. Ponadto 17 miało na końcu historii inny typ zdarzenia,
który mógł zasłaniać zmianę na karcie.

Nowy filtr wymaga dwóch dodatnich, różnych kwot. Lista, mapa i szczegóły odczytują ostatnią
rzeczywistą zmianę ceny; pełna historia pozostaje zachowana. Bardzo mała rzeczywista zmiana
nie zaokrągla się do zera. Nie modyfikowano zapisanej historii użytkownika.

Wyniki końcowej weryfikacji i pozostały zakres są zapisane w [TODO](TODO.md).
