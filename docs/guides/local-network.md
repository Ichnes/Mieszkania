# Dostęp z innych urządzeń w domu

Dla Dockera otwórz `http://IP-KOMPUTERA:8080/oferty`; kontenery działają w tle po `docker compose up -d`.
Zapora powinna dopuszczać port 8080 w sieci prywatnej. Poniższe przykłady z 5173 dotyczą
uruchomienia bez kontenerów (`npm run dev`). [Logowanie](login.md) można włączyć w obu wariantach.

Aplikacja jest dostępna w tej samej sieci Wi-Fi/LAN. Aby zamiast adresu IP używać stałego, czytelnego linku, ustaw w routerze lokalny rekord DNS:

```
otomieszkanie -> adres IP komputera z aplikacją
```

Po uruchomieniu `npm run dev` otwórz na drugim urządzeniu:

```
http://otomieszkanie:5173
```

Jeżeli router obsługuje domenę `.local`, można użyć także rekordu `otomieszkanie.local` i adresu `http://otomieszkanie.local:5173`.

## Gdy router nie ma lokalnego DNS

Dodaj na każdym urządzeniu, które ma korzystać z aplikacji, wpis mapujący `otomieszkanie` na aktualny adres IP komputera z aplikacją. W Windows jest to plik uruchomiony jako administrator:

```
C:\Windows\System32\drivers\etc\hosts
```

Przykład wpisu:

```
192.168.1.25 otomieszkanie
```

Wtedy adres pozostaje taki sam: `http://otomieszkanie:5173`.

## Jednorazowe wymagania

- Komputery muszą być w tej samej sieci.
- Na komputerze z aplikacją trzeba zezwolić Zaporze Windows na ruch przychodzący do portu `5173` (sieci prywatne).
- Komputer z aplikacją oraz polecenie `npm run dev` muszą pozostać uruchomione.

Adres bez portu, np. `http://otomieszkanie`, wymagałby dodatkowo serwera działającego na porcie 80 lub reverse proxy. Serwer deweloperski korzysta z portu `5173`, żeby nie wymagać uprawnień administratora.

## Link do konkretnej oferty

Otwórz ofertę na urządzeniu korzystającym z adresu LAN i wybierz **Kopiuj link**.
Link zachowuje nazwę lub IP komputera oraz port, np.
`http://192.168.1.25:5173/oferty?listing=UUID`. Nie zamieniaj go na `localhost` —
na telefonie oznaczałoby to sam telefon. Lokalny UUID działa w bazie komputera,
który udostępnia aplikację; osobna instalacja znajomego ma inną bazę.

Gdy strona główna działa, ale oferta nie, sprawdź pełny link wraz z `?listing=`.
Aplikacja wyświetla komunikat przy brakującej ofercie lub błędzie API.
Nie usuwaj bazy ani ustawień w celu naprawienia linku.

## „Nie możemy teraz pobrać danych” tylko na telefonie

Starsza konfiguracja `VITE_API_URL=http://localhost:3001` wskazywała na komputer
przy pracy lokalnej, ale na sam telefon przy wejściu przez Wi-Fi. Obecnie przy wejściu
przez IP lub nazwę LAN aplikacja zastępuje taki adres połączeniem przez proxy na tym
samym adresie co strona. Zalecane ustawienie to puste `VITE_API_URL=`.
Po aktualizacji odśwież stronę na telefonie. Nie trzeba udostępniać portu API `3001`.
