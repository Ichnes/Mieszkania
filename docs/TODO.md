# Bieżące zadania

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
