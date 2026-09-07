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
