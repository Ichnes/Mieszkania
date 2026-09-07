# Dostęp z innych urządzeń w domu

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
C:\\Windows\\System32\\drivers\\etc\\hosts
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

Adres bez portu, np. `http://otomieszkanie`, wymagałby dodatkowo serwera działającego na porcie 80 lub reverse proxy. Obecna wersja korzysta z portu `5173`, żeby nie wymagać uprawnień administratora.
