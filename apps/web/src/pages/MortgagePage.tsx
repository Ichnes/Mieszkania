import type { WorkspaceState } from "../app/useWorkspaceController";
import { MortgageCalculator } from "../features/mortgage/MortgageCalculator";

export function MortgagePage({
  model,
}: {
  model: Pick<WorkspaceState, "activeTab" | "mortgageDraft" | "setActiveTab" | "openListing">;
}) {
  const { activeTab, mortgageDraft, setActiveTab, openListing } = model;
  return (
    <>
      {activeTab === "mortgage" ? (
        <MortgageCalculator
          draft={mortgageDraft}
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
