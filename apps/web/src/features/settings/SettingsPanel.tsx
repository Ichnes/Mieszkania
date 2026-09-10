import { WorkplaceEditor } from "./WorkplaceEditor";
import { Select } from "../../components/Select";
import { defaultDownPayment } from "@mieszkania/shared";
import type { FamilySettings } from "@mieszkania/shared";
import {
  CircleAlert,
  ClipboardCheck,
  LoaderCircle,
  MapPin,
  Search,
  Settings2,
  Star,
  X,
} from "lucide-react";
import { useState } from "react";
import { warsawDreamDistrictCatalog } from "./districts";

export function SettingsPanel(input: {
  settings: FamilySettings;
  onClose: () => void;
  onSave: (settings: FamilySettings) => void | Promise<void>;
  isSaving: boolean;
  saveError: string | null;
}) {
  const [local, setLocal] = useState<FamilySettings>(input.settings);
  const [selectedDreamDistrict, setSelectedDreamDistrict] = useState<string>("");
  const [selectedDreamSubdivision, setSelectedDreamSubdivision] = useState<string>("__district__");
  const activeDreamDistrict = warsawDreamDistrictCatalog.find(
    (item) => item.district === selectedDreamDistrict,
  );

  function getSelectedDreamLocation() {
    return selectedDreamSubdivision === "__district__"
      ? selectedDreamDistrict
      : selectedDreamSubdivision;
  }

  function settingsWithPendingDreamLocation() {
    const value = getSelectedDreamLocation();
    if (!value || local.dreamProfile.preferredDistricts.includes(value)) {
      return local;
    }

    return {
      ...local,
      dreamProfile: {
        ...local.dreamProfile,
        preferredDistricts: [...local.dreamProfile.preferredDistricts, value],
      },
    };
  }

  function addPreferredDreamLocation() {
    const value = getSelectedDreamLocation();
    if (!value) {
      return;
    }

    setLocal((current) => ({
      ...current,
      dreamProfile: {
        ...current.dreamProfile,
        preferredDistricts: current.dreamProfile.preferredDistricts.includes(value)
          ? current.dreamProfile.preferredDistricts
          : [...current.dreamProfile.preferredDistricts, value],
      },
    }));
    setSelectedDreamDistrict("");
    setSelectedDreamSubdivision("__district__");
  }

  function removePreferredDreamLocation(value: string) {
    setLocal((current) => ({
      ...current,
      dreamProfile: {
        ...current.dreamProfile,
        preferredDistricts: current.dreamProfile.preferredDistricts.filter(
          (item) => item !== value,
        ),
      },
    }));
  }

  return (
    <aside className="detail-overlay" onClick={input.onClose}>
      <section className="detail-panel settings-panel" onClick={(event) => event.stopPropagation()}>
        <div className="panel-header settings-header">
          <div className="settings-title">
            <div>
              <p className="settings-kicker">
                <Settings2 size={15} aria-hidden="true" /> Ustawienia aplikacji
              </p>
              <h2>Preferencje wyszukiwania</h2>
              <p>W jednym miejscu ustaw dojazdy, zakres ofert i profil wymarzonego mieszkania.</p>
            </div>
          </div>
          <button className="icon-button" onClick={input.onClose} aria-label="Zamknij ustawienia">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <section className="settings-section">
          <div className="settings-section-heading">
            <div>
              <h3>Finansowanie zakupu</h3>
              <p>
                Ten sam wkład własny wykorzystujemy w kalkulatorze oraz przy szacowaniu rat na
                ofertach.
              </p>
            </div>
          </div>
          <label className="field-label">
            <span>Planowany wkład własny (zł)</span>
            <input
              className="text-input"
              type="number"
              min="0"
              step="1000"
              value={local.financing?.downPayment ?? defaultDownPayment}
              onChange={(event) =>
                setLocal((current) => ({
                  ...current,
                  financing: { downPayment: Math.max(0, Number(event.target.value)) },
                }))
              }
            />
          </label>
        </section>

        <section className="settings-section">
          <div className="settings-section-heading">
            <span className="settings-section-icon">
              <MapPin size={19} aria-hidden="true" />
            </span>
            <div>
              <h3>Dojazdy do pracy</h3>
              <p>Adresy używane do liczenia czasu i wygody codziennych dojazdów.</p>
            </div>
          </div>
          <div className="settings-workplaces-grid">
            {local.workplaces.map((workplace) => (
              <WorkplaceEditor
                key={workplace.key}
                value={workplace}
                onChange={(next) =>
                  setLocal((current) => ({
                    ...current,
                    workplaces: current.workplaces.map((item) =>
                      item.key === workplace.key ? next : item,
                    ),
                  }))
                }
                onRemove={() =>
                  setLocal((current) => ({
                    ...current,
                    workplaces: current.workplaces.filter((item) => item.key !== workplace.key),
                  }))
                }
              />
            ))}
          </div>
          <p>
            Podaj ulicę, numer budynku i miejscowość, bez numeru lokalu. Przy niejednoznacznym
            adresie dopisz dzielnicę. Wybierz wynik i sprawdź punkt na mapie.
          </p>
          <button
            type="button"
            className="action-button secondary-button"
            disabled={local.workplaces.length >= 6}
            onClick={() =>
              setLocal((current) => ({
                ...current,
                workplaces: [
                  ...current.workplaces,
                  {
                    key: `workplace-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    label: `Praca ${current.workplaces.length + 1}`,
                    address: "",
                  },
                ],
              }))
            }
          >
            Dodaj miejsce pracy
          </button>
          {local.workplaces.some(
            (item) =>
              !item.address.trim() ||
              !Number.isFinite(item.latitude) ||
              !Number.isFinite(item.longitude),
          ) && (
            <p role="status">
              Uzupełnij adres i wybierz punkt dla każdego miejsca pracy albo usuń niepotrzebny wpis.
            </p>
          )}
        </section>

        <section className="settings-section">
          <div className="settings-section-heading">
            <span className="settings-section-icon">
              <Search size={19} aria-hidden="true" />
            </span>
            <div>
              <h3>Zakres pobieranych ofert</h3>
              <p>
                Te zasady sterują wyszukiwaniem na portalach. Miasto, minimalny metraż i maksymalna
                cena wyznaczają też podstawowy zakres listy i mapy.
              </p>
            </div>
          </div>
          <div className="ops-form">
            <label className="field-label">
              <span>Miasto</span>
              <small className="field-hint">
                Bazowa lokalizacja, dla której collector buduje URL-e wyników.
              </small>
              <input
                className="text-input"
                value={local.searchContract.city}
                onChange={(event) =>
                  setLocal((current) => ({
                    ...current,
                    searchContract: {
                      ...current.searchContract,
                      city: event.target.value,
                      districts: [],
                    },
                  }))
                }
                placeholder="Miasto"
              />
            </label>
            <fieldset className="import-districts">
              <legend>Dzielnice</legend>
              <p className="field-hint">
                Brak wyboru oznacza całe miasto. Dzielnice Warszawy dotyczą wszystkich portali.
                Morizon i Gratka są przeszukiwane po 3 dzielnice, OLX i Nieruchomości-online po
                jednej. Adresowo nie udostępnia Wesołej w katalogu dzielnic Warszawy.
              </p>
              <div className="import-district-options">
                {[
                  ...warsawDreamDistrictCatalog.map((item) => item.district),
                  "Rembertów",
                  "Targówek",
                ]
                  .sort((a, b) => a.localeCompare(b, "pl"))
                  .map((district) => (
                    <label key={district}>
                      <input
                        type="checkbox"
                        disabled={local.searchContract.city.trim().toLowerCase() !== "warszawa"}
                        checked={(local.searchContract.districts ?? []).includes(district)}
                        onChange={(event) =>
                          setLocal((current) => ({
                            ...current,
                            searchContract: {
                              ...current.searchContract,
                              districts: event.target.checked
                                ? [...(current.searchContract.districts ?? []), district]
                                : (current.searchContract.districts ?? []).filter(
                                    (item) => item !== district,
                                  ),
                            },
                          }))
                        }
                      />
                      {district}
                    </label>
                  ))}
              </div>
            </fieldset>
            <label className="field-label">
              <span>Min metraż</span>
              <small className="field-hint">
                Dolna granica powierzchni. Mniejsze mieszkania nie wpadają do discovery.
              </small>
              <input
                className="text-input"
                value={String(local.searchContract.minArea)}
                onChange={(event) =>
                  setLocal((current) => ({
                    ...current,
                    searchContract: {
                      ...current.searchContract,
                      minArea: Number(event.target.value) || 0,
                    },
                  }))
                }
                placeholder="Min metraż"
              />
            </label>
            <label className="field-label">
              <span>Cena od</span>
              <small className="field-hint">
                Dolna granica budżetu dla discover i collect page.
              </small>
              <input
                className="text-input"
                value={String(local.searchContract.minPrice)}
                onChange={(event) =>
                  setLocal((current) => ({
                    ...current,
                    searchContract: {
                      ...current.searchContract,
                      minPrice: Number(event.target.value) || 0,
                    },
                  }))
                }
                placeholder="Cena od"
              />
            </label>
            <label className="field-label">
              <span>Cena do</span>
              <small className="field-hint">
                Górna granica budżetu dla discover i collect page.
              </small>
              <input
                className="text-input"
                value={String(local.searchContract.maxPrice)}
                onChange={(event) =>
                  setLocal((current) => ({
                    ...current,
                    searchContract: {
                      ...current.searchContract,
                      maxPrice: Number(event.target.value) || 0,
                    },
                  }))
                }
                placeholder="Cena do"
              />
            </label>
            <label className="field-label">
              <span>Min pokoje</span>
              <small className="field-hint">
                Minimalna liczba pokoi, od której collector bierze oferty.
              </small>
              <input
                className="text-input"
                value={String(local.searchContract.roomsMin)}
                onChange={(event) =>
                  setLocal((current) => ({
                    ...current,
                    searchContract: {
                      ...current.searchContract,
                      roomsMin: Math.max(1, Number(event.target.value) || 1),
                    },
                  }))
                }
                placeholder="Min pokoje"
              />
            </label>
          </div>
          <p className="settings-footnote">
            Zmiana zadziała przy następnym sprawdzaniu portali. Przygotowane już adresy pozostaną w
            kolejce.
          </p>
        </section>

        <section className="settings-section dream-profile-panel">
          <div className="settings-section-heading">
            <span className="settings-section-icon">
              <Star size={19} aria-hidden="true" />
            </span>
            <div>
              <h3>Wymarzone mieszkanie</h3>
              <p>
                Profil dopasowania, z którego powstaje procentowy wynik widoczny na kartach ofert.
              </p>
            </div>
          </div>
          <div className="ops-form dream-profile-form">
            <label className="field-label">
              <span>Nazwa profilu</span>
              <small className="field-hint">Etykieta badge na kartach ofert.</small>
              <input
                className="text-input"
                value={local.dreamProfile.label}
                onChange={(event) =>
                  setLocal((current) => ({
                    ...current,
                    dreamProfile: { ...current.dreamProfile, label: event.target.value },
                  }))
                }
                placeholder="Nazwa profilu"
              />
            </label>
            <div className="settings-grid">
              <label className="field-label">
                <span>Dzielnica</span>
                <small className="field-hint">
                  Wybierasz bazową dzielnicę Warszawy do dodania do profilu.
                </small>
                <Select
                  label="Dzielnica"
                  value={selectedDreamDistrict}
                  onChange={(value) => {
                    setSelectedDreamDistrict(value);
                    setSelectedDreamSubdivision("__district__");
                  }}
                >
                  <option value="" disabled>
                    Wybierz dzielnicę
                  </option>
                  {warsawDreamDistrictCatalog.map((item) => (
                    <option key={item.district} value={item.district}>
                      {item.district}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="field-label">
                <span>Poddzielnica / osiedle</span>
                <small className="field-hint">
                  Możesz dodać całą dzielnicę albo konkretną poddzielnicę, np. Gocław.
                </small>
                <Select
                  label="Poddzielnica / osiedle"
                  value={selectedDreamSubdivision}
                  disabled={!selectedDreamDistrict}
                  onChange={(value) => setSelectedDreamSubdivision(value)}
                >
                  <option value="__district__">
                    {selectedDreamDistrict
                      ? `Cała dzielnica: ${selectedDreamDistrict}`
                      : "Najpierw wybierz dzielnicę"}
                  </option>
                  {(activeDreamDistrict?.subdistricts ?? []).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <div className="panel-inline-actions">
              <button
                className="action-button secondary-button"
                type="button"
                disabled={!selectedDreamDistrict}
                onClick={addPreferredDreamLocation}
              >
                <MapPin size={16} aria-hidden="true" /> Dodaj lokalizację
              </button>
            </div>
            <div className="preferred-location-list" aria-label="Preferowane lokalizacje">
              {local.dreamProfile.preferredDistricts.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="preferred-location-item"
                  onClick={() => removePreferredDreamLocation(item)}
                  aria-label={`Usun lokalizacje ${item}`}
                >
                  <span>{item}</span>
                  <X size={15} aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="settings-grid">
              <label className="field-label">
                <span>Metraż od</span>
                <small className="field-hint">
                  Dolna granica optymalnej powierzchni dla mieszkania docelowego.
                </small>
                <input
                  className="text-input"
                  value={String(local.dreamProfile.minArea)}
                  onChange={(event) =>
                    setLocal((current) => ({
                      ...current,
                      dreamProfile: {
                        ...current.dreamProfile,
                        minArea: Number(event.target.value) || 0,
                      },
                    }))
                  }
                  placeholder="Metraż od"
                />
              </label>
              <label className="field-label">
                <span>Metraż do</span>
                <small className="field-hint">
                  Górna granica optymalnej powierzchni dla mieszkania docelowego.
                </small>
                <input
                  className="text-input"
                  value={String(local.dreamProfile.maxArea)}
                  onChange={(event) =>
                    setLocal((current) => ({
                      ...current,
                      dreamProfile: {
                        ...current.dreamProfile,
                        maxArea: Number(event.target.value) || 0,
                      },
                    }))
                  }
                  placeholder="Metraż do"
                />
              </label>
              <label className="field-label">
                <span>Pokoje od</span>
                <small className="field-hint">
                  Minimalna liczba pokoi dla sensownego dopasowania do Waszego celu.
                </small>
                <input
                  className="text-input"
                  value={String(local.dreamProfile.minRooms)}
                  onChange={(event) =>
                    setLocal((current) => ({
                      ...current,
                      dreamProfile: {
                        ...current.dreamProfile,
                        minRooms: Number(event.target.value) || 0,
                      },
                    }))
                  }
                  placeholder="Pokoje od"
                />
              </label>
              <label className="field-label">
                <span>Cena do</span>
                <small className="field-hint">
                  Maksymalna łączna cena mieszkania, po której nadal ma wysoki wynik.
                </small>
                <input
                  className="text-input"
                  value={String(local.dreamProfile.maxPrice)}
                  onChange={(event) =>
                    setLocal((current) => ({
                      ...current,
                      dreamProfile: {
                        ...current.dreamProfile,
                        maxPrice: Number(event.target.value) || 0,
                      },
                    }))
                  }
                  placeholder="Cena do"
                />
              </label>
              <label className="field-label">
                <span>Cena za m2 do</span>
                <small className="field-hint">
                  Górny limit ceny jednostkowej za metr kwadratowy.
                </small>
                <input
                  className="text-input"
                  value={String(local.dreamProfile.maxPricePerSqm)}
                  onChange={(event) =>
                    setLocal((current) => ({
                      ...current,
                      dreamProfile: {
                        ...current.dreamProfile,
                        maxPricePerSqm: Number(event.target.value) || 0,
                      },
                    }))
                  }
                  placeholder="Cena za m2 do"
                />
              </label>
              <label className="field-label">
                <span>Metro do</span>
                <small className="field-hint">
                  Odległość po linii prostej do najbliższej stacji metra, domyślnie 1000 m.
                </small>
                <input
                  className="text-input"
                  value={String(local.dreamProfile.maxMetroDistanceMeters)}
                  onChange={(event) =>
                    setLocal((current) => ({
                      ...current,
                      dreamProfile: {
                        ...current.dreamProfile,
                        maxMetroDistanceMeters: Number(event.target.value) || 0,
                      },
                    }))
                  }
                  placeholder="Metro do, m"
                />
              </label>
            </div>
            <div className="dream-preferences" aria-label="Dodatkowe wymagania">
              <label className="dream-toggle">
                <input
                  type="checkbox"
                  checked={local.dreamProfile.requiresGarage}
                  onChange={(event) =>
                    setLocal((current) => ({
                      ...current,
                      dreamProfile: {
                        ...current.dreamProfile,
                        requiresGarage: event.target.checked,
                      },
                    }))
                  }
                />
                <span>Garaż</span>
              </label>
              <label className="dream-toggle">
                <input
                  type="checkbox"
                  checked={local.dreamProfile.prefersBalcony}
                  onChange={(event) =>
                    setLocal((current) => ({
                      ...current,
                      dreamProfile: {
                        ...current.dreamProfile,
                        prefersBalcony: event.target.checked,
                      },
                    }))
                  }
                />
                <span>Balkon</span>
              </label>
            </div>
          </div>
        </section>

        {input.saveError ? (
          <div className="settings-save-error" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <span>
              <strong>Nie udało się zapisać ustawień.</strong>
              {input.saveError}
            </span>
          </div>
        ) : null}
        <div className="settings-save-bar">
          <p>Zmiany zaczną obowiązywać po zapisaniu.</p>
          <div>
            <button
              className="action-button secondary-button"
              type="button"
              onClick={input.onClose}
            >
              <X size={17} aria-hidden="true" /> Anuluj
            </button>
            <button
              className="action-button"
              disabled={
                input.isSaving ||
                local.workplaces.some(
                  (item) =>
                    !item.address.trim() ||
                    !Number.isFinite(item.latitude) ||
                    !Number.isFinite(item.longitude) ||
                    Math.abs(item.latitude!) > 90 ||
                    Math.abs(item.longitude!) > 180,
                )
              }
              onClick={() => void input.onSave(settingsWithPendingDreamLocation())}
            >
              {input.isSaving ? (
                <LoaderCircle size={17} className="icon-spin" aria-hidden="true" />
              ) : (
                <ClipboardCheck size={17} aria-hidden="true" />
              )}{" "}
              {input.isSaving ? "Zapisywanie…" : "Zapisz ustawienia"}
            </button>
          </div>
        </div>
      </section>
    </aside>
  );
}
