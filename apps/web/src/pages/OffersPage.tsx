import { defaultDownPayment } from "@mieszkania/shared";
import { LoaderCircle, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, X } from "lucide-react";
import { defaultFilters } from "../app/session";
import { ListingSortKey } from "../app/types";
import type { WorkspaceState } from "../app/useWorkspaceController";
import { ListingSection } from "../features/listings/components/ListingSection";
import { buildPageNumbers, getActiveFilterBadges } from "../features/listings/lib/filters";
import { warsawDreamDistrictCatalog } from "../features/settings/districts";
import { stringValue, toOptionalNumber } from "../shared/lib/input";

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
    | "setFilters"
    | "applyFilters"
    | "listingSort"
    | "setListingSort"
    | "isLoadingListings"
    | "setFiltersPanelCollapsed"
    | "listingsMainRef"
    | "visibleListings"
    | "openListing"
    | "toggleShortlist"
    | "isUpdatingShortlist"
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
    applyFilters,
    listingSort,
    setListingSort,
    isLoadingListings,
    setFiltersPanelCollapsed,
    listingsMainRef,
    visibleListings,
    openListing,
    toggleShortlist,
    isUpdatingShortlist,
    listingsTotal,
    currentListingsPage,
    totalListingsPages,
  } = model;
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
                  <div className="section-switches">
                    <button
                      className={filters.shortlistedOnly ? "tab-button active" : "tab-button"}
                      type="button"
                      onClick={() => {
                        const nextFilters = {
                          ...filters,
                          shortlistedOnly: true as const,
                          archivedOnly: undefined,
                          hiddenOnly: undefined,
                        };
                        setFilters(nextFilters);
                        void applyFilters(nextFilters, 1);
                      }}
                    >
                      Ulubione
                    </button>
                    <button
                      className={
                        !filters.shortlistedOnly && !filters.archivedOnly && !filters.hiddenOnly
                          ? "tab-button active"
                          : "tab-button"
                      }
                      type="button"
                      onClick={() => {
                        const nextFilters = {
                          ...filters,
                          shortlistedOnly: undefined,
                          archivedOnly: undefined,
                          hiddenOnly: undefined,
                        };
                        setFilters(nextFilters);
                        void applyFilters(nextFilters, 1);
                      }}
                    >
                      Wszystkie
                    </button>
                    <button
                      className={filters.hiddenOnly ? "tab-button active" : "tab-button"}
                      type="button"
                      onClick={() => {
                        const nextFilters = {
                          ...filters,
                          shortlistedOnly: undefined,
                          archivedOnly: undefined,
                          hiddenOnly: true as const,
                        };
                        setFilters(nextFilters);
                        void applyFilters(nextFilters, 1);
                      }}
                    >
                      Tylko ukryte
                    </button>
                  </div>
                </div>
                <form
                  className="filters-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setMobileFiltersOpen(false);
                    void applyFilters(filters, 1);
                  }}
                >
                  <label className="filter-field">
                    <span>Miasto</span>
                    <input
                      className="text-input"
                      value={filters.city ?? ""}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          city: event.target.value || undefined,
                        }))
                      }
                    />
                  </label>
                  <label className="filter-field">
                    <span>Dzielnica</span>
                    <select
                      className="text-input"
                      value={filters.district ?? ""}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          district: event.target.value || undefined,
                        }))
                      }
                    >
                      <option value="">Wszystkie dzielnice</option>
                      <option value="__none__">Bez dzielnicy</option>
                      {warsawDreamDistrictCatalog.map((item) => (
                        <option key={item.district} value={item.district}>
                          {item.district}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="filter-field">
                    <span>Cena od</span>
                    <input
                      className="text-input"
                      inputMode="numeric"
                      value={stringValue(filters.minPrice)}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          minPrice: toOptionalNumber(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <label className="filter-field">
                    <span>Cena do</span>
                    <input
                      className="text-input"
                      inputMode="numeric"
                      value={stringValue(filters.maxPrice)}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          maxPrice: toOptionalNumber(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <label className="filter-field">
                    <span>PLN/m2 od</span>
                    <input
                      className="text-input"
                      inputMode="numeric"
                      value={stringValue(filters.minPricePerSqm)}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          minPricePerSqm: toOptionalNumber(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <label className="filter-field">
                    <span>PLN/m2 do</span>
                    <input
                      className="text-input"
                      inputMode="numeric"
                      value={stringValue(filters.maxPricePerSqm)}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          maxPricePerSqm: toOptionalNumber(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <label className="filter-field">
                    <span>Metraz od</span>
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
                    <span>Metraz do</span>
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
                  <label className="filter-field">
                    <span>Szukaj w ofercie</span>
                    <input
                      className="text-input"
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
                    <select
                      className="text-input listing-sort-select"
                      value={listingSort}
                      onChange={(event) => {
                        const nextSort = event.target.value as ListingSortKey;
                        setListingSort(nextSort);
                      }}
                    >
                      <option value="newest">Sortuj: najnowsze</option>
                      <option value="oldest">Sortuj: najstarsze</option>
                      <option value="price_desc">Sortuj: cena malejaco</option>
                      <option value="price_asc">Sortuj: cena rosnaco</option>
                      <option value="area_desc">Sortuj: metraz malejaco</option>
                      <option value="area_asc">Sortuj: metraz rosnaco</option>
                      <option value="dream_desc">Sortuj: wymarzone mieszkanie</option>
                    </select>
                  </label>
                  <label className={filters.shortlistedOnly ? "check-row is-active" : "check-row"}>
                    <input
                      type="checkbox"
                      checked={filters.shortlistedOnly ?? false}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          shortlistedOnly: event.target.checked || undefined,
                        }))
                      }
                    />
                    <span>Tylko ulubione</span>
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
                          shortlistedOnly: event.target.checked
                            ? undefined
                            : current.shortlistedOnly,
                          hiddenOnly: event.target.checked ? undefined : current.hiddenOnly,
                        }))
                      }
                    />
                    <span>Tylko archiwalne</span>
                  </label>
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
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </form>
                <button
                  className="filters-collapse-button"
                  type="button"
                  aria-label={filtersPanelCollapsed ? "Pokaz filtry" : "Ukryj filtry"}
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

            <div ref={listingsMainRef} className="listings-main">
              <button
                className="mobile-filter-trigger"
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
              >
                <SlidersHorizontal size={18} aria-hidden="true" /> Filtry
                {getActiveFilterBadges(filters).length > 0 ? (
                  <span>{getActiveFilterBadges(filters).length}</span>
                ) : null}
              </button>
              <ListingSection
                title={listingSectionTitle}
                listings={visibleListings}
                onOpen={openListing}
                onToggleShortlist={toggleShortlist}
                downPayment={model.settings.financing?.downPayment ?? defaultDownPayment}
                compareIds={model.compareListingIds}
                onToggleCompare={model.toggleCompareListing}
                updatingShortlistId={isUpdatingShortlist}
                isLoading={isLoadingListings}
              />
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
                        onClick={() => void applyFilters(filters, currentListingsPage - 1)}
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
                            onClick={() => void applyFilters(filters, pageNumber)}
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
                        onClick={() => void applyFilters(filters, currentListingsPage + 1)}
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
