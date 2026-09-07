# MVP produktu

## Cel

Zbudowac lokalna aplikacje dla regionu Warszawy i okolic, ktora:

1. tworzy wlasna baze ogloszen,
2. zapisuje historie zmian,
3. archiwizuje zdjecia i artefakty ofert,
4. laczy dane ofertowe z transakcjami RCN,
5. pokazuje oferty na mapie.

## Aktualny zakres MVP

### Zaimplementowane

1. region `Warszawa i okolica`,
2. backend i frontend lokalny,
3. PostgreSQL jako baza,
4. podstawowy collector `Otodom collect-one`,
5. masowe `Otodom collect-page`,
5. archiwum `storage/offers/...`,
6. lokalny cache obrazow,
7. dashboard ofert, sekcja ostatnio zaciagnietych i klikany szczegol oferty,
8. filtry ofertowe oraz reczny shortlist,
9. zakladka mapy z naniesionymi ofertami po geokodzie,
10. ustawienia rodziny: miejsca pracy oraz wagi ocen,
11. tabela ocen mieszkania (funkcja historyczna, wycofana z interfejsu), pozioma i na suwakach,
12. ranking ofert liczony z wag i ocen,
13. pierwsza warstwa importu RCN,
14. udostepnienie aplikacji w LAN.

### Nadal do dopracowania

1. mocniejsze wykrywanie duplikatow miedzy zrodlami, nie tylko w ramach `source_id + external_id`,
2. pelniejsze wyciaganie strukturalnych cech oferty z payloadu, nie tylko z opisu,
3. stabilny importer RCN dla powiatow regionu warszawskiego,
4. lepsze parsowanie stron wynikow Otodom i kolejnych portali,
5. rozszerzenie mapy o warstwy analityczne i lepsze filtrowanie shortlisty.

## Najwazniejsze scenariusze

1. recznie albo masowo zaciagnac oferty z Otodom i zobaczyc wszystkie zapisane obrazy oraz artefakty,
2. obejrzec ostatnio zaciagniete oferty nawet wtedy, gdy parser zle przypisal region,
3. otworzyc szczegol oferty i zobaczyc cene, zdjecia, mape, ulice, shortlist i historie zmian,
4. zobaczyc dojazdy do pracy oraz podstawowe uslugi wokol oferty,
5. zaznaczyc oferte jako shortlist i odfiltrowac tylko te wpisy na liscie i mapie,
6. porównać oferty i ich dopasowanie do zapisanych preferencji,
7. porownac oferty z danymi RCN dla Warszawy i okolic.

## Priorytety najblizszych iteracji

1. dopracowanie parsera Otodom na kolejnych realnych payloadach,
2. poprawa importera RCN,
3. automat Otodom po wielu stronach wynikow i kolejne portale,
4. mocniejsza deduplikacja miedzy zrodlami,
5. wykres ceny w UI i kolejne filtry produktowe.
