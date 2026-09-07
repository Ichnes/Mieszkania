# Dokumentacja

## Uruchomienie i obsługa

- [Start lokalny i rozwiązywanie problemów](guides/getting-started.md)
- [Obsługa aplikacji](guides/application.md)
- [Dostęp z innych urządzeń w domu](guides/local-network.md)
- [Utrzymanie danych i narzędzia naprawcze](guides/maintenance.md)

## Kod i dane

- [Architektura i układ katalogów](architecture/overview.md)
- [Model danych i inicjalizacja bazy](architecture/data-model.md)
- [Obsługiwany region](reference/regions.md)
- [Źródło granic MSI](reference/warsaw-msi-boundaries.md)

[TODO.md](TODO.md) zawiera aktualny stan prac. `archive/` przechowuje wcześniejsze
raporty i nieaktualne założenia — nie są instrukcją uruchomienia obecnej wersji.
W katalogu głównym repo pozostają tylko README oraz AGENTS.md z zasadami pracy nad kodem.

Zasady dla narzędzi i osób zmieniających kod: [AGENTS.md](../AGENTS.md).
Ten plik pozostaje w katalogu repo; przeniesienie do `docs/` ograniczyłoby automatyczne
wykrywanie jego zasad dla kodu w `apps/` i `packages/`.
