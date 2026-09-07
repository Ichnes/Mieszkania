import { defaultDownPayment } from "@mieszkania/shared";
import type { WorkspaceState } from "../app/useWorkspaceController";
import { MortgageCalculator } from "../features/mortgage/MortgageCalculator";

export function MortgagePage({
  model,
}: {
  model: Pick<
    WorkspaceState,
    | "settings"
    | "saveSettings"
    | "isSavingSettings"
    | "settingsSaveError"
    | "activeTab"
    | "mortgageDraft"
    | "setActiveTab"
    | "openListing"
  >;
}) {
  const { activeTab, mortgageDraft, setActiveTab, openListing } = model;
  return (
    <>
      {activeTab === "mortgage" ? (
        <MortgageCalculator
          draft={mortgageDraft}
          defaultDownPayment={model.settings.financing?.downPayment ?? defaultDownPayment}
          onSaveDownPayment={(value) =>
            model.saveSettings({ ...model.settings, financing: { downPayment: value } })
          }
          savingSettings={model.isSavingSettings}
          settingsError={model.settingsSaveError}
          onBackToListing={() => {
            if (!mortgageDraft.listingId) return;
            setActiveTab("dashboard");
            void openListing(mortgageDraft.listingId);
          }}
        />
      ) : null}
    </>
  );
}
