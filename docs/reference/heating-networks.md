# Sieci ciepłownicze i źródło ogrzewania

Stan rozpoznania: 2026-09-28. Pierwsza integracja jest warstwą poglądową, bez
automatycznego przypisania przyłącza do budynku.

- [GUGiK: GESUT i KIUT](https://www.geoportal.gov.pl/pl/dane/uzbrojenie-terenu-gesut/):
  sieci istniejące i projektowane; zakres obrazu wynika z powiatowych usług WMS.
  GUGiK opisuje widoczność przy skali 1:500 i większej oraz odpłatne pozyskanie wektorów.
- [WMS KIUT](https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaUzbrojeniaTerenu):
  `przewod_cieplowniczy`, WMS 1.1.1, EPSG:3857, przezroczysty PNG.
  Aplikacja używa zoomu 21–22; podkład OSM powiększa kafle z zoomu 19.
  Nie pobiera sieci w widoku całego miasta. Kafle idą bezpośrednio z przeglądarki
  do publicznego WMS; adres oglądanego wycinka jest przekazywany tej usłudze.
- Rzeczywisty test Chromium: odpowiedzi 200 PNG. Próbka z Warszawy była pusta;
  GetFeatureInfo zwróciło brak danych opisowych dla wybranego obiektu. Sukces
  pobrania obrazu nie dowodzi obecności danych ani kompletności sieci Warszawy.
- [Veolia: mapa sieci](https://www.energiadlawarszawy.pl/strefa-miejska/jak-powstaje-cieplo/mapa-sieci-cieplowniczej/):
  materiał poglądowy operatora; w tym rozpoznaniu nie ustalono publicznego API
  przyłączy przypisanych do adresów.
- [CEEB: raporty](https://zone.gunb.gov.pl/raporty): dane zbiorcze nie wystarczają
  do przypisania źródła ogrzewania do konkretnego mieszkania. Nie zaimplementowano
  odczytu prywatnych deklaracji ani wnioskowania z agregatów.

Odczyt tekstu odbywa się lokalnie z opisu dostępnego w aplikacji, bez dodatkowego
importu lub zapisu do bazy. Rozpoznawane są wyraźne wzmianki o ogrzewaniu miejskim,
kotłowni, gazie, prądzie lub pompie ciepła. Negacje i sformułowania o planach/możliwości
są pomijane; wiele różnych źródeł daje komunikat o niejednoznaczności.
Własna kotłownia może być gazowa, więc te dwie wzmianki nie są uznawane za sprzeczne.
Odczyt może nie objąć nietypowego sformułowania; użytkownik zawsze widzi niepewność
oraz dostępny fragment źródłowy. Nie wyznaczamy odległości do rury ani nie uznajemy
jej za dowód ogrzewania miejskiego. Dokładność punktu oferty może być orientacyjna.
