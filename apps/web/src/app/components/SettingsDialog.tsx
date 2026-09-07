import { SettingsPanel } from "../../features/settings/SettingsPanel";
import type { WorkspaceState } from "../useWorkspaceController";

export function SettingsDialog({
  model,
}: {
  model: Pick<
    WorkspaceState,
    | "settingsOpen"
    | "settings"
    | "setSettingsSaveError"
    | "setSettingsOpen"
    | "saveSettings"
    | "isSavingSettings"
    | "settingsSaveError"
  >;
}) {
  const {
    settingsOpen,
    settings,
    setSettingsSaveError,
    setSettingsOpen,
    saveSettings,
    isSavingSettings,
    settingsSaveError,
  } = model;
  return (
    <>
      {settingsOpen ? (
        <SettingsPanel
          settings={settings}
          onClose={() => {
            setSettingsSaveError(null);
            setSettingsOpen(false);
          }}
          onSave={saveSettings}
          isSaving={isSavingSettings}
          saveError={settingsSaveError}
        />
      ) : null}
    </>
  );
}
