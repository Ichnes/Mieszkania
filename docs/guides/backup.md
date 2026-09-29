# Kopia zapasowa i odtwarzanie

Polecenia uruchamiaj w katalogu projektu. Wymagają Node.js 22.14+, Docker Desktop,
wolnego miejsca na kopię i, przy pierwszym uruchomieniu, pobrania oficjalnego obrazu
PostgreSQL. Wersja klienta jest dobierana do rzeczywistej bazy działającego API,
również gdy `compose.override.yaml` wskazuje PostgreSQL na Windows.

## Utworzenie kopii

```sh
npm run backup:create
```

Skrypt odczytuje konfigurację działającego API i wykonuje kopię **bez zatrzymywania
aplikacji**. Baza i liczby wierszy pochodzą z jednego snapshotu PostgreSQL
(`REPEATABLE READ` i `pg_export_snapshot`). Można nadal przeglądać oferty i zapisywać
notatki; zmiany po dacie snapshotu trafią dopiero do kolejnej kopii.
Podczas kopiowania nie uruchamiaj czyszczenia/usuwania plików, migracji ani dużych
importów. Pliki są kopiowane online, nie stanowią atomowego snapshotu dysku;
wykryta zmiana lub błąd odczytu podczas pakowania przerywa tworzenie kopii.
Na Windows katalog podłączony do API jest pakowany lokalnym `tar`, aby uniknąć
powolnego odczytu setek tysięcy plików przez Docker Desktop.

Wynik trafia do `.local/backups/<data-identyfikator>/`:

- `database.dump`: cała baza aplikacji, w tym notatki, kontakty, terminy, ustawienia i konta;
- `storage.tar.gz`: skompresowane dane i oryginalne zdjęcia z katalogu storage API;
- `counts.txt`: liczby wierszy w tabelach schematu public;
- `SHA256SUMS`: sumy kontrolne danych;
- `manifest.json`: wersja formatu, PostgreSQL i data utworzenia.

Gzip działa strumieniowo: nie powstaje dodatkowe duże, rozpakowane archiwum.
Pominięte są `cache`, `map-thumbnails`, `logs`, `qa`, `audits`, `backups` i `maintenance`:
odtwarzalne cache, miniatury, diagnostyka i starsze kopie techniczne. Oryginalne zdjęcia
w `media-cache`, archiwum ofert, ustawienia, konta i dane geograficzne są zachowywane.
`snapshot.json` zapisuje datę snapshotu i liczby wierszy tabel. Zdjęcia nie są
przeskalowywane ani ponownie kodowane; JPEG/WebP i już spakowane dane mogą niewiele
zyskać na dodatkowej kompresji. Zrzut PostgreSQL również używa kompresji.

Brak manifestu oznacza nieukończoną kopię. Skrypt nie usuwa poprzednich kopii.
Repozytorium, `.env` i konfiguracja Dockera nie są częścią archiwum danych;
do uruchomienia potrzebna jest też kopia kodu. Archiwum zawiera prywatne dane
i nie jest szyfrowane. Przechowuj kompletny katalog kopii także na osobnym nośniku
lub w swoim szyfrowanym backupie. `.local/` pozostaje poza Git.

## Sprawdzenie odtwarzania

```sh
npm run backup:verify -- ".local/backups/<data-identyfikator>"
```

Polecenie sprawdza sumy, odtwarza bazę w nowym kontenerze bez sieci, porównuje
liczby wierszy wszystkich tabel, wypakowuje pliki do osobnego wolumenu i porównuje
je z archiwum. Nie łączy się z bazą aplikacji. Po sukcesie zapisuje
`verification.json`; tymczasowy kontener i wolumeny są usuwane.
Potrzebne jest dodatkowe miejsce na pełną odtworzoną bazę i pliki.
Podczas sprawdzania dużych plików i przesyłania archiwum skrypt pokazuje co 15 sekund
procent odczytanych danych oraz ich rozmiar. Zakończenie potwierdza dopiero komunikat
powodzenia i plik `verification.json`; samo 100% odczytu nie oznacza zakończenia kontroli.
Pozostaw terminal uruchomiony do końca. Restart edytora może przerwać zapis wyniku,
nawet gdy operacja w kontenerze nadal działa.

## Odtworzenie do nowej instalacji

```sh
npm run backup:restore -- ".local/backups/<data-identyfikator>"
```

Wykonuje te same kontrole co `backup:verify`, ale zachowuje odtworzone dane
w nowych, osobno nazwanych wolumenach. Nie nadpisuje bieżącej bazy ani storage.
Tworzy prywatną konfigurację w `.local/recovery/<identyfikator>/`.

Otwórz wygenerowany `START.txt` i wykonaj podane polecenie PowerShell z katalogu
projektu. Uruchamia ono osobny projekt Compose pod
`http://127.0.0.1:8081/oferty`, z wyłączonymi automatycznymi importami.
Port 8081 musi być wolny. Jawnie podane pliki Compose pomijają lokalny override,
aby odtworzona aplikacja nie połączyła się omyłkowo ze starą bazą.
Polecenie ustawia port i adres wyłącznie w bieżącym terminalu; późniejsze
uruchamianie oryginalnej instalacji wykonuj w nowym terminalu.

Sprawdź oferty, zdjęcia, ustawienia, notatki i terminy. Dopiero po tej kontroli
zdecyduj, która instalacja ma być dalej używana. Starej instalacji i kopii nie trzeba
usuwać. Konta bazy są odtwarzane razem z danymi, ale ustawienia logowania/HTTPS
z plików środowiskowych trzeba skonfigurować osobno przed udostępnieniem.

Skrypt nie drukuje danych dostępowych. Plik `compose.recovery.json` zawiera
losowe hasło odtworzonej bazy: nie dodawaj go do Git ani nie wysyłaj innym.
