# Ocena AI mieszkań — eksperyment wstrzymany

Status na 22.09.2026: **użytkownik zatrzymał eksperyment i nie akceptuje jakości ocen**.
Pozostawiamy istniejące dane i widok; nie analizujemy kolejnych ofert, nie poprawiamy
punktacji i nie uruchamiamy automatyzacji. Nowy start wymaga nowego zlecenia.

## Rzeczywisty cel i błąd podejścia

Użytkownik oczekiwał zaawansowanego porównania zdjęć: czy widoczne mieszkanie jest
przeciętne, dobrze wykończone czy „topowe”, z konkretnym rozpoznaniem jakości.
W pierwszej próbie za duży wpływ miał opis sprzedawcy. Ogólna punktacja obejmująca
lokalizację, budżet i deklarowane cechy nie odpowiadała na to pytanie.

Analiza GPT-6 Luna była zbyt powierzchowna. Część rzeczywistych fotografii uznano
za możliwe wizualizacje bez dobrych podstaw. Ręczna kontrola kolażu nr 3 potwierdziła
spójne fotografie urządzonego wnętrza i tarasu, których nie należało dyskwalifikować
jako materiału projektowego. Sam render rzutu nie świadczy o rodzaju pozostałych zdjęć.
Próbka zawierała też podobne kadry mimo deduplikacji po skrócie pliku.

Nie przyjmować, że zmiana modelu sama naprawi problem. Trzeba oddzielić ocenę obrazu
od opisu, zapewnić odpowiednie zbliżenia i skalibrować wynik na małej próbce.

## Stan pozostawiony w aplikacji

- Dziesięć ofert wybrano z `GET /api/listings?sort=dream_desc&pageSize=10`, bez dodatkowych filtrów. Jest to migawka rankingu z czasu eksportu; aktualny ranking może się zmieniać.
- GPT-6 Luna obejrzała 10 kolaży, do 6 zdjęć/rzutów każdy. Dane i obrazy są lokalne w `.local/ai-review/`, poza Git.
- Zapisano 10 ocen w `listing_ai_assessments`, ze skrótem wejścia, modelem, datą, źródłową ceną i informacjami o zdjęciach. Nie wywołano płatnego API AI.
- W szczegółach działa zakładka **Ocena AI**, między **Ocena** a **Duplikaty**; fioletowe kółko AI pojawia się na karcie obok dotychczasowej punktacji.
- Otwarcie widoku nie uruchamia analizy. Nie ma automatycznego skanowania w tle.
- Obecna skala: lokalizacja 25%, cena 20%, stan 20%, układ 15%, budynek 10%, światło/przestrzeń zewnętrzna 10%. To **niezaakceptowany eksperyment**, nie docelowa ocena wizualna.
- Po sygnale zatrzymania przerwano dodatkową kontrolę Luny. Ewentualny plik `reviews-checked.json` jest roboczy i nie został zaimportowany; nie traktować go jako zatwierdzonej poprawki.

## Pliki pozwalające wrócić do pracy

- [Skill oceny zdjęć](../skills/apartment-photo-review/SKILL.md) — zapis docelowego podejścia.
- [Typy i wagi](../packages/shared/src/ai-assessment.ts).
- [Walidacja](../apps/api/src/services/listings/ai-assessment-validation.ts) i [odczyt ocen](../apps/api/src/services/listings/ai-assessment-repository.ts).
- [Eksport materiałów](../scripts/prepare-ai-review.mjs) i [import gotowych ocen](../apps/api/src/scripts/maintenance/import-ai-assessments.ts).
- [Panel szczegółów AI](../apps/web/src/features/listings/components/ListingAiAssessment.tsx) i [style](../apps/web/src/styles/ai-assessment.css).
- [Instrukcja obsługi](guides/application.md#dodatkowa-ocena-ai) oraz [instrukcja techniczna](guides/maintenance.md#oceny-ai-bez-wywołań-api-modelu).

## Co zostało sprawdzone przed zatrzymaniem

- Typecheck i build wszystkich pakietów zakończyły się poprawnie.
- 370 testów zaliczonych, 7 środowiskowych pominiętych; w tym testy stałych wag, braków danych i walidacji importu AI.
- Import zapisał 10 ocen; powtórzenie pominęło 10 istniejących wpisów.
- Odczyt API potwierdził wszystkie 10 ocen i zgodność z zapisanymi plikami analiz.
- Kontrola przeglądarkowa przy 1440/1280/390/320 px potwierdziła 10 kółek, układ obok starej oceny, brak poziomego przepełnienia, sześć kryteriów i stan bez oceny. Obejrzano zrzuty PC i telefonu.
- Potem dodano przewinięcie pod przyklejony pasek zakładek. Build i aktualizacja kontenerów po tej poprawce przeszły; ponowna kontrola wizualna tej ostatniej korekty nie została wykonana przed zatrzymaniem.
- Lokalne API, web i baza były healthy. Logi i zrzuty pozostały w `.local/`.

## Kierunek dopiero po wznowieniu

1. Najpierw ocena zdjęć bez opisu, ceny, lokalizacji i dotychczasowej punktacji.
2. Widoczny standard i widoczny stan jako osobne wyniki; lokalizacja i cena w osobnej analizie kontekstowej.
3. Konkretne cechy ze wskazaniem zdjęcia, nie powtarzanie „wysoki standard” z ogłoszenia.
4. Dobór różnych ujęć oraz pojedyncze zdjęcia/zbliżenia, gdy kolaż nie pokazuje detali; niepewność zamiast zgadywania materiałów.
5. Pilot na 2–3 mieszkaniach i ocena trafności z użytkownikiem przed kolejną partią lub zmianą modelu.
6. Nie używać obecnych ocen jako prawdy referencyjnej; ponowny import wymaga świadomej decyzji o zastąpieniu starej opinii.

Orientacyjny szacunek dla Luny wynosił 0,3–1 kredytu za same analizy dziesięciu ofert.
Nie odczytano rzeczywistego zużycia kredytów. Szacunek nie obejmuje pracy nad kodem,
narzędziami ani późniejszej kontroli; nie przedstawiać go jako rozliczenia.
