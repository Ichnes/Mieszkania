# Opcjonalne logowanie

Domyślnie `AUTH_ENABLED=false`: aplikacja otwiera się bez konta. Włączenie logowania
chroni całą wspólną bazę, ustawienia, notatki, zdjęcia i operacje importu. Wszystkie
konta mają te same uprawnienia; nie tworzą osobnych kopii danych.

## Konto i hasło

Przy działającej aplikacji Docker uruchom w terminalu:

```sh
docker compose exec api npm run auth:user
```

Bez Dockera: `npm run auth:user`. Podaj email i dwukrotnie hasło (12–128 znaków).
Hasło nie jest wyświetlane ani przekazywane jako argument polecenia. Email służy
wyłącznie jako login: aplikacja nie wysyła poczty, nie potwierdza adresu i nie wymaga integracji.
Ponowne uruchomienie polecenia z tym samym emailem ustawia nowe hasło.

Konta są w lokalnym `storage/auth/accounts.json` jako sole i skróty scrypt, bez
hasła jawnego. Plik jest poza Git i nie jest dostępny przez endpoint zdjęć. Zabezpiecz
kopię katalogu storage tak jak bazę danych. Nie uruchamiaj dwóch edycji kont jednocześnie.

## Włączenie w domu

Ustaw w głównym `.env`:

```dotenv
AUTH_ENABLED=true
AUTH_COOKIE_SECURE=false
APP_ORIGIN=
```

Następnie `docker compose up -d api`. Nowe zmienne wymagają odtworzenia kontenera;
samo `docker compose restart api` ich nie wczyta. Przy pracy bez Dockera uruchom
ponownie API. Brak poprawnego pliku kont przy włączonym logowaniu blokuje start API.

Po zmianie samego hasła wystarczy `docker compose restart api` — wczyta plik kont
i unieważni dotychczasowe sesje. Wylogowanie jest dostępne w górnym pasku aplikacji.
Sesja wygasa po 8 godzinach i po restarcie API. Odpowiedź 401 otwiera formularz
logowania ponownie, zachowując adres oferty.

## Dostęp przez internet

Przed udostępnieniem ustaw HTTPS na reverse proxy lub tunelu, a w `.env`:

```dotenv
AUTH_ENABLED=true
AUTH_COOKIE_SECURE=true
APP_ORIGIN=https://ADRES-TWOJEJ-STRONY
```

`APP_ORIGIN` to dokładny adres strony bez końcowego ukośnika, ze schematem i portem,
jeśli występuje. Po jego zmianie wykonaj `docker compose up -d api`. Logowanie
przez lokalne HTTP nie działa z ciasteczkiem Secure; używaj wtedy adresu HTTPS.
Przy zmiennym adresie tunelu trzeba zaktualizować również APP_ORIGIN.

Logowanie ma limit 10 prób na 15 minut z jednego adresu widzianego przez API.
W Dockerze reverse proxy jest jednym adresem dla wszystkich klientów, więc limit
jest współdzielony. Nie ufamy dowolnemu nagłówkowi X-Forwarded-For.
Cookies są HttpOnly/SameSite=Strict; zapisy wymagają nagłówka aplikacji i zgodnego Origin.

To dostęp do wspólnego panelu z prawem edycji, także dla osoby, której dasz konto.
Wariant tylko do oglądania jest osobnym zadaniem w [audycie](../audit-2026-09-08.md).
Nie wystawiaj serwera Vite ani portu PostgreSQL do internetu. Obecny stan i pozostałe
problemy bezpieczeństwa są opisane w tym samym raporcie.

Parametry scrypt (`N=32768, r=8, p=3`) są jednym z wariantów opisanych przez
[OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt).
