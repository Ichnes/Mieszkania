import { useEffect, useRef } from "react";
import { warsawDreamDistrictCatalog } from "../../settings/districts";

export function DistrictFilter({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) root.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  const options = [
    { district: "__none__", label: "Bez dzielnicy" },
    ...warsawDreamDistrictCatalog.map((item) => ({
      district: item.district,
      label: item.district,
    })),
  ];
  return (
    <div className="filter-field">
      <span>Dzielnice</span>
      <details
        ref={root}
        className="district-multiselect"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            root.current?.removeAttribute("open");
            root.current?.querySelector("summary")?.focus();
          }
        }}
      >
        <summary
          aria-label="Wybierz dzielnice"
          title={value.map((item) => (item === "__none__" ? "Bez dzielnicy" : item)).join(", ")}
        >
          {value.length ? `Wybrane dzielnice: ${value.length}` : "Wszystkie dzielnice"}
        </summary>
        <div
          className="district-multiselect-menu"
          role="group"
          aria-label="Dzielnice do wyszukania"
        >
          <button
            type="button"
            className="action-button secondary-button"
            onClick={() => onChange([])}
          >
            Wszystkie dzielnice
          </button>
          {options.map((option) => (
            <label key={option.district}>
              <input
                type="checkbox"
                checked={value.includes(option.district)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...value, option.district]
                      : value.filter((item) => item !== option.district),
                  )
                }
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
