# Model danych

## Zasady

1. `listing` przechowuje aktualny stan pojedynczego ogłoszenia z konkretnego portalu.
2. `listing_snapshot` przechowuje historyczny stan oferty tylko wtedy, gdy zmieniły się jej istotne dane; techniczne odświeżenie bez zmian nie tworzy kopii.
3. `listing_images` przechowuje logiczne zdjęcia przypięte do ogłoszenia.
4. `listing_media_assets` reprezentuje lokalny cache fizycznych plików obrazów.
5. `transaction_rcn` przechowuje dane transakcyjne z importu RCN.
6. `app_settings` przechowuje ustawienia rodziny, w tym kontrakt collectora i profil `wymarzone mieszkanie`.
7. `listing_manual_overrides` przechowuje ręczne ustalenia z rozmów, status kontaktu i etap procesu.
8. `listing_contact_events` przechowuje timeline telefonów, wiadomości, negocjacji i innych zdarzeń.
9. `listing_scores` przechowuje oceny mieszkań (funkcja historyczna, wycofana z interfejsu).
10. `listing_duplicate_reviews`, `listing_duplicate_groups` i `listing_duplicate_group_members` przechowują review duplikatów między portalami oraz ręczne łączenie tych samych ofert.

## Encje kluczowe

### listing

- `external_id`
- `canonical_url`
- `source_id`
- `title`
- `description`
- `price_amount`
- `price_per_sqm`
- `area_sqm`
- `rooms`
- `floor`
- `total_floors`
- `year_built`
- `latitude`
- `longitude`
- `address_text`
- `district`
- `neighborhood`
- `city`
- `is_shortlisted`
- `status`

### app_settings

- `key`
- `value`
- `updated_at`

`family-settings.value` zawiera:

- `workplaces`
- `searchContract`
- `dreamProfile`
- `weights`
- `maxWeightTotal`

### dreamProfile

Profil `wymarzone mieszkanie` w `family-settings.value` zawiera:

- `label`
- `preferredDistricts`
- `minArea`
- `maxArea`
- `minRooms`
- `maxPrice`
- `maxPricePerSqm`
- `requiresGarage`
- `prefersBalcony`

Na podstawie tych pól frontend wylicza `dreamScore` dla każdej oferty i oznacza karty dopasowanych mieszkań.

### listing_manual_overrides

- `listing_id`
- `contact_status`
- `decision_stage`
- `contact_name`
- `contact_phone`
- `contact_role`
- `negotiated_price_amount`
- `asking_price_override`
- `notes`
- `source_notes`
- `last_contact_at`
- `updated_at`

### listing_contact_events

- `id`
- `listing_id`
- `event_type`
- `occurred_at`
- `title`
- `notes`
- `contact_name`
- `amount`
- `created_at`

### listing_scores

- `listing_id`
- `rater_key`
- `dimension_key`
- `score`
- `note`
- `updated_at`

### listing_duplicate_reviews

- `pair_key`
- `listing_id_left`
- `listing_id_right`
- `status`
- `notes`
- `reviewed_at`

### listing_duplicate_groups

- `id`
- `created_at`

### listing_duplicate_group_members

- `listing_id`
- `group_id`
- `created_at`

### ukryte duplikaty

- `listings.hidden_duplicate_of_id` wskazuje ofertę główną, pod którą ukryto ten rekord jako duplikat.
- `listing_duplicate_group_members.is_primary` oznacza aktualnie wybraną ofertę główną w grupie.
- Ukryty duplikat zostaje w bazie i może być dalej odświeżany przez collectory, ale nie trafia do zwykłych list i statystyk aktywnych ofert.

### archiwalne oferty

- `listings.status = 'removed'` oznacza ofertę archiwalną/usuniętą z portalu.
- `listings.removed_at` przechowuje moment pierwszego oznaczenia jako archiwalna.
- Rekord archiwalny zostaje w bazie i szczegół oferty nadal jest dostępny po ID, ale domyślnie nie liczy się do puli aktywnych ofert.
- `listings.content_checksum` pozwala odróżnić realną zmianę treści od identycznego odświeżenia collectora.
- Surowy HTML i kompaktowy JSON są kompresowane gzip oraz deduplikowane po sumie SHA-256 w `storage/offers/objects`; manifest oferty wskazuje ostatnią zachowaną wersję.

### listing_parcel_context

- Jeden cache identyfikacji działki na ofertę: współrzędne, identyfikator i numer działki, obręb, gmina, źródło oraz geometria GeoJSON.
- Zmiana współrzędnych unieważnia cache; standardowy czas odświeżenia wynosi 30 dni.

### listing_neighborhood_context

- Trwały cache analizy okolicy OpenStreetMap dla współrzędnych oferty.
- `insights_json` zawiera liczby obiektów w promieniu 500 m, 1 km i 2 km, najbliższe nazwane miejsca oraz obiekty oznaczone jako planowane lub w budowie.
- Cache ma wersję formatu i jest odświeżany po 7 dniach; nieudane odpowiedzi z publicznego API nie nadpisują ostatniego poprawnego wyniku.

### listing_planning_context

- Cache dopasowania działki do publicznych aktów Rejestru Urbanistycznego: MPZP, planu ogólnego i planów inwestycyjnych.
- Zawiera też analizę bezpośredniego otoczenia w promieniu 50 m z małego wycinka OSM: przemysł, hale, budowy, odpady, energetyka, stacje paliw, tory, główne drogi i lokale nocne.
- Przechowuje ostatni poprawny wynik przez 7 dni; przy czasowej awarii RU aplikacja może pokazać starszy wynik z wyraźnym oznaczeniem.

### listing_relistings

- `previous_listing_id` wskazuje wcześniejszą, archiwalną wersję ogłoszenia.
- `current_listing_id` wskazuje aktywną ofertę wykrytą po archiwizacji poprzedniej wersji.
- `previous_price_amount` i `relisted_price_amount` zachowują ceny z momentu wykrycia relistingu.
- `confidence_score` i `reason_summary` opisują siłę oraz podstawy automatycznego dopasowania.
- Relisting jest osobną relacją od duplikatu: aktywna oferta pozostaje widoczna i nie jest ukrywana pod rekordem archiwalnym.

## Założenia multi-portal

1. Surowe rekordy per portal są trzymane osobno. Otodom i Gratka nie nadpisują sobie danych.
2. Gdy uznasz dwa ogłoszenia za to samo mieszkanie, aplikacja łączy je relacją grupy duplikatów zamiast niszczyć źródła.
3. Kandydaci duplikatów są zawężani do mocnych przypadków: ten sam adres, prawie ten sam punkt geograficzny albo bardzo zbliżone parametry w tej samej dzielnicy.
4. Po połączeniu ofert szczegół oferty może pokazać powiązane ogłoszenia z innych portali.

## Założenia collectora

1. Kontrakt collectora nie blokuje frontendowych filtrów listy.
2. Kontrakt collectora jest wykorzystywany przy `discover`, `discoverAll` i `collectPage`.
3. `processQueue` przetwarza tylko URL-e, które wcześniej trafiły do kolejki.
4. Model jest przygotowany pod wiele portali: wspólne wytyczne biznesowe, osobny adapter i parser per portal.
