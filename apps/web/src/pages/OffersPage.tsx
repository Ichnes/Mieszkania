import { useRef } from "react";
import { PriceInput as FilterPriceInput } from "../shared/components/PriceInput";
import { DistrictFilter } from "../features/listings/components/DistrictFilter";
import { Select } from "../components/Select";
import { defaultDownPayment } from "@mieszkania/shared";
import {
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
  X,
  Star,
  LayoutGrid,
  EyeOff,
} from "lucide-react";
import { defaultFilters, listingsPerPage } from "../app/session";
import { ListingSortKey } from "../app/types";
import type { WorkspaceState } from "../app/useWorkspaceController";
import { ListingSection } from "../features/listings/components/ListingSection";
import { buildPageNumbers, getActiveFilterBadges } from "../features/listings/lib/filters";
import { stringValue, toOptionalNumber } from "../shared/lib/input";
import { LoadError } from "../shared/components/LoadError";
import { SavedSearches } from "../features/listings/components/SavedSearches";

const sortOptions = [
  { value: "newest", label: "Najnowsze" },
  { value: "oldest", label: "Najstarsze" },
  { value: "price_desc", label: "Cena: malejąco" },
  { value: "price_asc", label: "Cena: rosnąco" },
  { value: "price_per_sqm_desc", label: "Cena za m²: malejąco" },
  { value: "price_per_sqm_asc", label: "Cena za m²: rosnąco" },
  { value: "area_desc", label: "Metraż: malejąco" },
  { value: "area_asc", label: "Metraż: rosnąco" },
  { value: "dream_desc", label: "Wymarzone mieszkanie" },
];

export function OffersPage({
  model,
}: {
  model: Pick<
    WorkspaceState,
    | "settings"
    | "compareListingIds"
    | "toggleCompareListing"
    | "activeTab"
    | "filtersPanelCollapsed"
    | "mobileFiltersOpen"
    | "setMobileFiltersOpen"
    | "listingSectionTitle"
    | "filters"
    | "appliedFilters"
    | "appliedListingSort"
    | "hasUnappliedFilters"
    | "listingsError"
    | "retryListings"
    | "setFilters"
    | "applyFilters"
    | "listingSort"
    | "setListingSort"
    | "isLoadingListings"
    | "hasLoadedListings"
    | "commutesPending"
    | "setFiltersPanelCollapsed"
    | "listingsMainRef"
    | "visibleListings"
    | "openListing"
    | "listingsTotal"
    | "currentListingsPage"
    | "totalListingsPages"
  >;
}) {
  const {
    activeTab,
    filtersPanelCollapsed,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    listingSectionTitle,
    filters,
    setFilters,
    applyFilters: submitFilters,
    listingSort,
    setListingSort,
    isLoadingListings,
    setFiltersPanelCollapsed,
    listingsMainRef,
    visibleListings,
    openListing,
    listingsTotal,
    currentListingsPage,
    totalListingsPages,
  } = model;
  const previousVisibility = useRef<
    Pick<typeof filters, "hiddenOnly" | "shortlistedOnly" | "includeArchivedFavorites"> | undefined
  >(undefined);
  const active = model.appliedFilters;
  const favorites = Boolean(active.shortlistedOnly && !active.includeArchivedFavorites);
  const districts = active.districts ?? (active.district ? [active.district] : []);
  const districtLabel =
    (districts[0] === "__none__" ? "Bez dzielnicy" : districts[0]) +
    (districts.length > 1 ? ` +${districts.length - 1}` : "");
  const filterCount = getActiveFilterBadges({
    ...active,
    shortlistedOnly: active.includeArchivedFavorites ? active.shortlistedOnly : undefined,
  }).length;
  function toggleFavorites() {
    if (!favorites)
      previousVisibility.current = {
        hiddenOnly: active.hiddenOnly,
        shortlistedOnly: active.shortlistedOnly,
        includeArchivedFavorites: active.includeArchivedFavorites,
      };
    const visibility = favorites
      ? (previousVisibility.current ?? { shortlistedOnly: undefined })
      : {
          shortlistedOnly: true as const,
          hiddenOnly: undefined,
          includeArchivedFavorites: undefined,
        };
    const next = { ...active, ...visibility };
    setFilters(next);
    void submitFilters(next, 1, model.appliedListingSort);
  }
  const ranges = [
    ["minPrice", "maxPrice", "Cena od jest wyższa niż cena do"],
    ["minPricePerSqm", "maxPricePerSqm", "Cena za m² od jest wyższa niż cena za m² do"],
    ["minArea", "maxArea", "Metraż od jest większy niż metraż do"],
    ["minYearBuilt", "maxYearBuilt", "Rok od jest późniejszy niż rok do"],
    ["roomsMin", "roomsMax", "Liczba pokoi od jest większa niż liczba pokoi do"],
  ] as const;
  function invalidRanges(values: typeof filters) {
    return ranges.filter(([min, max]) => (values[min] ?? -Infinity) > (values[max] ?? Infinity));
  }
  function applyFilters(...args: Parameters<typeof submitFilters>) {
    if (!invalidRanges(args[0] ?? filters).length) return submitFilters(...args);
  }
  const rangeError = (key: string) =>
    invalidRanges(filters)
      .filter(([min]) => min === key)
      .map(([min, max, message]) => (
        <div key={min} role="alert">
          {message}{" "}
          <button
            type="button"
            onClick={() =>
              setFilters((current) => ({ ...current, [min]: current[max], [max]: current[min] }))
            }
          >
            Zamień wartości
          </button>
        </div>
      ));
  return (
    <>
      {activeTab === "dashboard" ? (
        <>
          <div
            className={
              filtersPanelCollapsed ? "listings-workspace filters-collapsed" : "listings-workspace"
            }
          >
            {mobileFiltersOpen ? (
              <button
                className="filters-mobile-backdrop"
                type="button"
                aria-label="Zamknij filtry"
                onClick={() => setMobileFiltersOpen(false)}
              />
            ) : null}
            <aside
              className={mobileFiltersOpen ? "filters-sidebar mobile-open" : "filters-sidebar"}
              aria-label="Filtry ofert"
            >
              <section className="panel filters-panel">
                <div className="panel-header listing-filters-header">
                  <div className="listing-filters-heading">
                    <span className="stats-controls-icon listing-filters-icon">
                      <SlidersHorizontal size={19} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="eyebrow">Filtr</p>
                      <h2>{listingSectionTitle}</h2>
                      <small>Zawęź oferty tak samo jak analizowany rynek.</small>
                    </div>
                  </div>
                  <button
                    className="filter-mobile-close"
                    type="button"
                    aria-label="Zamknij filtry"
                    onClick={() => setMobileFiltersOpen(false)}
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                  <div
                    className="section-switches offer-visibility-switches"
                    role="group"
                    aria-label="Widoczność ofert"
                  >
                    <button
                      className={
                        filters.shortlistedOnly && !filters.includeArchivedFavorites
                          ? "tab-button active"
                          : "tab-button"
                      }
                      aria-pressed={Boolean(
                        filters.shortlistedOnly && !filters.includeArchivedFavorites,
                      )}
                      type="button"
                      onClick={() => {
                        const nextFilters = {
                          ...filters,
                          shortlistedOnly:
                            filters.shortlistedOnly && !filters.includeArchivedFavorites
                              ? undefined
                              : (true as const),
                          includeArchivedFavorites: undefined,
                          hiddenOnly: undefined,
                        };
                        setFilters(nextFilters);
                        void applyFilters(nextFilters, 1, listingSort);
                      }}
                    >
                      <Star size={16} aria-hidden="true" /> Ulubione
                    </button>
                    <button
                      type="button"
                      className={
                        filters.includeArchivedFavorites ? "tab-button active" : "tab-button"
                      }
                      aria-pressed={Boolean(filters.includeArchivedFavorites)}
                      onClick={() => {
                        const next = { shortlistedOnly: true, includeArchivedFavorites: true };
                        setFilters(next);
                        setMobileFiltersOpen(false);
                        void applyFilters(next, 1, listingSort);
                      }}
                    >
                      <Star size={16} aria-hidden="true" /> Wszystkie ulubione
                    </button>
                    <button
                      className={
                        !filters.shortlistedOnly && !filters.archivedOnly && !filters.hiddenOnly
                          ? "tab-button active"
                          : "tab-button"
                      }
                      aria-pressed={
                        !filters.shortlistedOnly && !filters.archivedOnly && !filters.hiddenOnly
                      }
                      type="button"
                      onClick={() => {
                        const nextFilters = {
                          ...filters,
                          shortlistedOnly: undefined,
                          includeArchivedFavorites: undefined,
                          archivedOnly: undefined,
                          hiddenOnly: undefined,
                        };
                        setFilters(nextFilters);
                        void applyFilters(nextFilters, 1, listingSort);
                      }}
                    >
                      <LayoutGrid size={16} aria-hidden="true" /> Wszystkie
                    </button>
                    <button
                      className={filters.hiddenOnly ? "tab-button active" : "tab-button"}
                      aria-pressed={Boolean(filters.hiddenOnly)}
                      type="button"
                      onClick={() => {
                        const nextFilters = {
                          ...filters,
                          shortlistedOnly: undefined,
                          includeArchivedFavorites: undefined,
                          archivedOnly: undefined,
                          hiddenOnly: true as const,
                        };
                        setFilters(nextFilters);
                        void applyFilters(nextFilters, 1, listingSort);
                      }}
                    >
                      <EyeOff size={16} aria-hidden="true" /> Tylko ukryte
                    </button>
                  </div>
                </div>
                <SavedSearches
                  filters={model.appliedFilters}
                  sort={model.appliedListingSort}
                  pending={model.hasUnappliedFilters || isLoadingListings}
                  onApply={(nextFilters, nextSort) => {
                    setFilters(nextFilters);
                    setListingSort(nextSort);
                    setMobileFiltersOpen(false);
                    void applyFilters(nextFilters, 1, nextSort);
                  }}
                />
                <form
                  className="filters-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (invalidRanges(filters).length) return;
                    setMobileFiltersOpen(false);
                    void applyFilters(filters, 1, listingSort);
                  }}
                >
                  <DistrictFilter
                    value={filters.districts ?? (filters.district ? [filters.district] : [])}
                    onChange={(districts) =>
                      setFilters((current) => ({ ...current, district: undefined, districts }))
                    }
                  />
                  <div className="offer-filter-range">
                    <label className="filter-field">
                      <span>Cena od</span>
                      <FilterPriceInput
                        value={filters.minPrice}
                        onChange={(amount) =>
                          setFilters((current) => ({ ...current, minPrice: amount }))
                        }
                      />
                    </label>
                    <label className="filter-field">
                      <span>Cena do</span>
                      <FilterPriceInput
                        value={filters.maxPrice}
                        onChange={(amount) =>
                          setFilters((current) => ({ ...current, maxPrice: amount }))
                        }
                      />
                    </label>
                  </div>
                  {rangeError("minPrice")}
                  <div
                    className="offer-filter-range"
                    role="group"
                    aria-label="Cena za metr kwadratowy"
                  >
                    <label className="filter-field">
                      <span>Cena za m² od (zł)</span>
                      <FilterPriceInput
                        value={filters.minPricePerSqm}
                        onChange={(amount) =>
                          setFilters((current) => ({ ...current, minPricePerSqm: amount }))
                        }
                      />
                    </label>
                    <label className="filter-field">
                      <span>m² do (zł)</span>
                      <FilterPriceInput
                        value={filters.maxPricePerSqm}
                        onChange={(amount) =>
                          setFilters((current) => ({ ...current, maxPricePerSqm: amount }))
                        }
                      />
                    </label>
                  </div>
                  {rangeError("minPricePerSqm")}
                  <div className="offer-filter-range">
                    <label className="filter-field">
                      <span>Metraż od</span>
                      <input
                        className="text-input"
                        inputMode="decimal"
                        value={stringValue(filters.minArea)}
                        onChange={(event) =>
                          setFilters((current) => ({
                            ...current,
                            minArea: toOptionalNumber(event.target.value),
                          }))
                        }
                      />
                    </label>
                    <label className="filter-field">
                      <span>Metraż do</span>
                      <input
                        className="text-input"
                        inputMode="decimal"
                        value={stringValue(filters.maxArea)}
                        onChange={(event) =>
                          setFilters((current) => ({
                            ...current,
                            maxArea: toOptionalNumber(event.target.value),
                          }))
                        }
                      />
                    </label>
                  </div>
                  {rangeError("minArea")}
                  <div className="offer-filter-range">
                    <label className="filter-field">
                      <span>Rok budowy od</span>
                      <input
                        className="text-input"
                        inputMode="numeric"
                        value={stringValue(filters.minYearBuilt)}
                        onChange={(event) =>
                          setFilters((current) => ({
                            ...current,
                            minYearBuilt: toOptionalNumber(event.target.value),
                          }))
                        }
                        placeholder="np. 2000"
                      />
                    </label>
                    <label className="filter-field">
                      <span>Rok budowy do</span>
                      <input
                        className="text-input"
                        inputMode="numeric"
                        value={stringValue(filters.maxYearBuilt)}
                        onChange={(event) =>
                          setFilters((current) => ({
                            ...current,
                            maxYearBuilt: toOptionalNumber(event.target.value),
                          }))
                        }
                        placeholder="np. 2020"
                      />
                    </label>
                  </div>
                  {rangeError("minYearBuilt")}
                  <div className="offer-filter-range">
                    <label className="filter-field">
                      <span>Pokoje od</span>
                      <input
                        className="text-input"
                        inputMode="numeric"
                        value={stringValue(filters.roomsMin)}
                        onChange={(event) =>
                          setFilters((current) => ({
                            ...current,
                            roomsMin: toOptionalNumber(event.target.value),
                          }))
                        }
                      />
                    </label>
                    <label className="filter-field">
                      <span>Pokoje do</span>
                      <input
                        className="text-input"
                        inputMode="numeric"
                        value={stringValue(filters.roomsMax)}
                        onChange={(event) =>
                          setFilters((current) => ({
                            ...current,
                            roomsMax: toOptionalNumber(event.target.value),
                          }))
                        }
                      />
                    </label>
                  </div>
                  {rangeError("roomsMin")}
                  <label className="filter-field">
                    <span>Szukaj w ofercie</span>
                    <input
                      className="text-input"
                      placeholder="Opis, tytuł lub ulica, np. Okopowa"
                      value={filters.search ?? ""}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          search: event.target.value || undefined,
                        }))
                      }
                    />
                  </label>
                  <label className="filter-field">
                    <span>Sortowanie</span>
                    <Select
                      label="Sortowanie"
                      value={listingSort}
                      onChange={(value) => setListingSort(value as ListingSortKey)}
                      options={sortOptions}
                    />
                  </label>
                  <label className={filters.priceChangedOnly ? "check-row is-active" : "check-row"}>
                    <input
                      type="checkbox"
                      checked={filters.priceChangedOnly ?? false}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          priceChangedOnly: event.target.checked || undefined,
                        }))
                      }
                    />
                    <span>Tylko zmiana ceny</span>
                  </label>
                  <label className={filters.archivedOnly ? "check-row is-active" : "check-row"}>
                    <input
                      type="checkbox"
                      checked={filters.archivedOnly ?? false}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          archivedOnly: event.target.checked || undefined,
                          includeArchivedFavorites: event.target.checked
                            ? undefined
                            : current.includeArchivedFavorites,
                          hiddenOnly: event.target.checked ? undefined : current.hiddenOnly,
                        }))
                      }
                    />
                    <span>Tylko archiwalne</span>
                  </label>
                  {filters.archivedOnly && (
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={filters.includeMergedActive ?? false}
                        onChange={(event) =>
                          setFilters((current) => ({
                            ...current,
                            includeMergedActive: event.target.checked || undefined,
                          }))
                        }
                      />
                      <span>Uwzględnij aktualne połączone z archiwalnymi</span>
                    </label>
                  )}
                  <div className="filters-actions">
                    <button className="action-button" type="submit" disabled={isLoadingListings}>
                      {isLoadingListings ? (
                        <>
                          <LoaderCircle size={16} className="icon-spin" aria-hidden="true" />{" "}
                          Ładowanie...
                        </>
                      ) : (
                        "Filtruj"
                      )}
                    </button>
                    <button
                      className="action-button secondary-button"
                      type="button"
                      onClick={() => {
                        setFilters(defaultFilters);
                        setListingSort("newest");
                        void applyFilters(defaultFilters, 1, "newest");
                      }}
                    >
                      Wyczyść filtry
                    </button>
                  </div>
                </form>
                <button
                  className="filters-collapse-button"
                  type="button"
                  aria-label={filtersPanelCollapsed ? "Pokaż filtry" : "Ukryj filtry"}
                  onClick={() => setFiltersPanelCollapsed((current) => !current)}
                >
                  {filtersPanelCollapsed ? (
                    <PanelLeftOpen size={20} aria-hidden="true" />
                  ) : (
                    <PanelLeftClose size={20} aria-hidden="true" />
                  )}
                </button>
              </section>
            </aside>

            <div id="oferty-lista" ref={listingsMainRef} className="listings-main">
              <div className="mobile-list-tools">
                <button
                  className="mobile-filter-trigger"
                  type="button"
                  onClick={() => setMobileFiltersOpen(true)}
                >
                  Filtry
                  {districts.length > 0 && <b className="filter-district"> · {districtLabel}</b>}
                  {filterCount > 0 && (
                    <span className={districts.length ? "count-with-district" : ""}>
                      {filterCount}
                    </span>
                  )}
                </button>
                <button
                  className="mobile-filter-trigger mobile-favorites"
                  type="button"
                  aria-pressed={favorites}
                  onClick={toggleFavorites}
                >
                  Ulubione
                </button>
              </div>
              {model.hasUnappliedFilters && !isLoadingListings ? (
                <p className="load-feedback" role="status">
                  Zmieniono ustawienia filtrów. Kliknij „Filtruj”, aby zastosować je do wyników.
                </p>
              ) : null}
              {model.listingsError ? (
                <LoadError
                  message={model.listingsError}
                  onRetry={model.retryListings}
                  busy={isLoadingListings}
                />
              ) : null}
              {(model.commutesPending ?? 0) > 0 && (
                <p role="status">
                  Obliczamy trasy samochodowe dla {model.commutesPending} lokalizacji. Ranking
                  uwzględni wyniki po automatycznym odświeżeniu. Czasy bez aktualnych korków.
                </p>
              )}
              {model.hasLoadedListings || !model.listingsError || isLoadingListings ? (
                <ListingSection
                  sortControl={
                    <Select
                      label="Sortowanie wyników"
                      value={model.appliedListingSort}
                      options={sortOptions}
                      onChange={(value) => {
                        const next = value as ListingSortKey;
                        setListingSort(next);
                        void submitFilters(active, 1, next);
                      }}
                    />
                  }
                  settings={model.settings}
                  resultRange={
                    visibleListings.length
                      ? `${(currentListingsPage - 1) * listingsPerPage + 1}–${(currentListingsPage - 1) * listingsPerPage + visibleListings.length} z ${listingsTotal} ofert`
                      : "0 ofert"
                  }
                  compareIds={model.compareListingIds}
                  onToggleCompare={model.toggleCompareListing}
                  title={
                    model.appliedFilters.newWithinDays
                      ? `Nowe oferty · ${model.appliedFilters.newWithinDays} dni`
                      : model.appliedFilters.priceChangedWithinDays
                        ? `Zmiany cen · ${model.appliedFilters.priceChangedWithinDays} dni`
                        : listingSectionTitle
                  }
                  listings={visibleListings}
                  onOpen={openListing}
                  downPayment={model.settings.financing?.downPayment ?? defaultDownPayment}
                  isLoading={
                    isLoadingListings || (!model.hasLoadedListings && !model.listingsError)
                  }
                />
              ) : null}
              {listingsTotal > 0 ? (
                <section className="panel">
                  <div className="pagination-row">
                    <span className="muted">
                      Strona {currentListingsPage} z {totalListingsPages} · {listingsTotal} ofert
                    </span>
                    <div className="pagination-pages">
                      <button
                        className="action-button secondary-button"
                        type="button"
                        disabled={isLoadingListings || currentListingsPage <= 1}
                        onClick={() =>
                          void applyFilters(
                            model.appliedFilters,
                            currentListingsPage - 1,
                            model.appliedListingSort,
                          )
                        }
                      >
                        Poprzednia
                      </button>
                      {buildPageNumbers(currentListingsPage, totalListingsPages).map(
                        (pageNumber) => (
                          <button
                            key={pageNumber}
                            className={
                              pageNumber === currentListingsPage
                                ? "tab-button active"
                                : "tab-button"
                            }
                            type="button"
                            onClick={() =>
                              void applyFilters(
                                model.appliedFilters,
                                pageNumber,
                                model.appliedListingSort,
                              )
                            }
                            disabled={isLoadingListings}
                          >
                            {pageNumber}
                          </button>
                        ),
                      )}
                      <button
                        className="action-button secondary-button"
                        type="button"
                        disabled={isLoadingListings || currentListingsPage >= totalListingsPages}
                        onClick={() =>
                          void applyFilters(
                            model.appliedFilters,
                            currentListingsPage + 1,
                            model.appliedListingSort,
                          )
                        }
                      >
                        Nastepna
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
