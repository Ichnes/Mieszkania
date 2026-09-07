# Architektura

## Podział modułów

### apps/web

Frontend React odpowiada za:

1. dashboard ofert regionu warszawskiego,
2. filtrowanie, sortowanie i backendową paginację listy ofert,
3. osobne zakładki `Ranking`, `Porównanie`, `Pipeline`, `Mapa`, `Operacje` i `Backfill`,
4. prezentację miniatur, galerii, map OpenStreetMap i porównania ofert,
5. szczegół oferty z zakładkami `Przegląd`, `Notatki`, `Kontakt`, `Ocena`,
6. stałą prawą kolumnę szczegółu oferty dla `Oglądania`, historii cen, dojazdów, okolicy, mapy i powiązanych ofert z innych portali,
7. panel ustawień rodziny z kontraktem collectora, wagami ocen i profilem `wymarzone mieszkanie`.

### apps/api

API odpowiada za:

1. listingi, filtry, shortlistę, szczegóły ofert, CRM kontaktów, porównanie i oceny,
2. ręczny oraz masowy collector Otodom, w tym `discover`, `discoverAll`, `collectPage` i `processQueue`,
3. discovery dla Gratki jako drugi portal pod ten sam kontrakt collectora,
4. import i inspekcję RCN,
5. serwowanie lokalnego cache mediów,
6. zapis snapshotów, historii cen, manualnych notatek, pipeline decyzji, timeline kontaktów i ocen,
7. konserwatywne wykrywanie kandydatów duplikatów między portalami oraz ręczne decyzje `to samo` / `różne`.

### packages/shared

Wspólne typy DTO dla web i API.

## Bieżące moduły backendu

1. `collectors/otodom`
   Pełny collector: fetch, parse, dedupe po `external_id`, storage, media sync i archive. `discover`, `discoverAll` i `collectPage` budują scope z kontraktu collectora zapisanym w `family-settings`.
   Archiwum treści jest kompresowane i adresowane sumą SHA-256. Ponowne pobranie tej samej istotnej wersji oferty wykorzystuje istniejące obiekty zamiast zapisywać kolejny HTML.
2. `collectors/gratka`
   Drugi portal. Ma osobny adapter discovery, parser szczegółu, kolejkę i zapis do tej samej warstwy listings, korzystając z tego samego kontraktu collectora.
3. `collectors/rcn`
   Warstwa importu danych transakcyjnych RCN.
4. `services/listing-repository`
   Dashboard, listy, paginacja, szczegóły ofert, shortlista, media, prawa kolumna w detalu i powiązane oferty z innych portali.
5. `services/family-settings`
   Miejsca pracy, wagi ocen, kontrakt collectora i profil `wymarzone mieszkanie`.
6. `services/listing-evaluation`
   Oceny mieszkań (funkcja historyczna, wycofana z interfejsu) oraz ranking.
7. `services/listing-duplicates`
   Kandydaci duplikatów między portalami, review, grupowanie powiązanych ogłoszeń i liczniki powiązań na kartach ofert.
8. `services/reset-application-data`
   Bezpieczny reset danych ofertowych bez kasowania ustawień rodziny.
9. `services/listing-parcel-context`
   Identyfikacja działki i jej granicy przez ULDK GUGiK, z trwałym cache'em oraz deep-linkiem do Geoportalu.
10. `services/neighborhood-insights`
   Analiza obiektów OpenStreetMap w promieniu 2 km, przedziały 500 m / 1 km, najbliższe miejsca oraz osobna klasyfikacja obiektów planowanych i w budowie. Poprawne wyniki są cache'owane przez 7 dni.

## Bieżące endpointy

1. `GET /health`
2. `GET /api/dashboard`
3. `GET /api/region`
4. `GET /api/listings`
5. `GET /api/listings/recent`
6. `GET /api/listings/:id`
7. `POST /api/listings/:id/shortlist`
8. `GET /api/settings/family`
9. `POST /api/settings/family`
10. `GET /api/listings/:id/evaluation`
11. `POST /api/listings/:id/evaluation`
12. `GET /api/alerts`
13. `POST /api/listings/:id/manual`
14. `POST /api/listings/:id/contact-events`
15. `GET /api/collectors/otodom/discover`
16. `POST /api/collectors/otodom/collect-one`
17. `POST /api/collectors/otodom/collect-page`
18. `POST /api/collectors/otodom/discover-all`
19. `POST /api/collectors/otodom/process-queue`
20. `POST /api/collectors/otodom/retry-failed`
21. `GET /api/collectors/gratka/discover`
22. `POST /api/collectors/gratka/discover-all`
23. `POST /api/collectors/gratka/process-queue`
24. `POST /api/collectors/gratka/retry-failed`
25. `POST /api/collectors/gratka/run-all`
26. `GET /api/duplicates/candidates`
27. `POST /api/duplicates/review`
28. `POST /api/collectors/rcn/import`
29. `GET /api/media/:storageKey`
30. `GET /api/listings/:id/parcel`
31. `GET /api/listings/:id/insights`

## Najważniejsze założenia

1. Kontrakt collectora jest wspólny dla wielu portali, ale adapter URL-i i parser pozostają per portal.
2. Frontendowe filtry listy nie są blokowane przez kontrakt collectora.
3. `processQueue` nie tworzy nowego scope. Przerabia tylko URL-e, które trafiły do kolejki po etapie discovery.
4. Duplikaty między portalami są wykrywane ostrożnie. Kandydat trafia do review tylko przy mocnych sygnałach, takich jak ten sam adres, prawie ten sam punkt na mapie albo bardzo zbliżone parametry w tej samej dzielnicy.
5. Profil `wymarzone mieszkanie` służy do mapowania już zaciągniętych ofert i oznaczania ich wynikiem dopasowania, a nie do blokowania wyników collectora.
