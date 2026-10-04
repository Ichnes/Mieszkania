import type { RelistedListingMatch } from "@mieszkania/shared";
import { apiFetch } from "../../shared/lib/http";
import { apiBaseUrl } from "../../shared/lib/api";

export async function saveRelistingReview(
  match: RelistedListingMatch,
  decision: "confirmed" | "rejected",
) {
  const response = await apiFetch(
    `${apiBaseUrl}/api/listings/${match.current.id}/relisting-review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previousId: match.previous.id, decision }),
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message ?? "Nie udało się zapisać decyzji. Spróbuj ponownie.");
  return data as { decision: "confirmed" | "rejected"; match: RelistedListingMatch };
}
