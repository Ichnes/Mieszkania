import { Moon, Settings2, Sun } from "lucide-react";
import type { WorkspaceState } from "../useWorkspaceController";

export function AppHeader({
  model,
}: {
  model: Pick<
    WorkspaceState,
    "setActiveTab" | "setTheme" | "theme" | "setSettingsSaveError" | "setSettingsOpen"
  >;
}) {
  const { setActiveTab, setTheme, theme, setSettingsSaveError, setSettingsOpen } = model;
  return (
    <>
      <header className="app-topbar">
        <button
          className="brand-button"
          type="button"
          onClick={() => setActiveTab("dashboard")}
          aria-label="Przejdź do ofert"
        >
          <span className="brand-mark">M</span>
          <span>
            <strong>Mieszkania</strong>
            <small>Wasze centrum decyzji</small>
          </span>
        </button>
        <div className="topbar-actions">
          <button
            className="icon-button"
            type="button"
            onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
            aria-label={theme === "light" ? "Włącz tryb ciemny" : "Włącz tryb jasny"}
            title={theme === "light" ? "Tryb ciemny" : "Tryb jasny"}
          >
            {theme === "light" ? (
              <Moon size={19} aria-hidden="true" />
            ) : (
              <Sun size={19} aria-hidden="true" />
            )}
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => {
              setSettingsSaveError(null);
              setSettingsOpen(true);
            }}
            aria-label="Otwórz ustawienia"
            title="Ustawienia"
          >
            <Settings2 size={19} aria-hidden="true" />
          </button>
        </div>
      </header>
    </>
  );
}
