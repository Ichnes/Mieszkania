import type { DuplicateReviewEvent } from "./review-state";
import { apiBaseUrl } from "../../shared/lib/api";
import { apiFetch } from "../../shared/lib/http";

export async function saveDuplicateReview({ pair, status }: DuplicateReviewEvent) {
  const submit = (confirmArchiveAreaDifference = false) =>
    apiFetch(`${apiBaseUrl}/api/duplicates/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leftId: pair.left.id,
        rightId: pair.right.id,
        status,
        ...(confirmArchiveAreaDifference && { confirmArchiveAreaDifference }),
      }),
    });

  let response = await submit();
  let data = await response.json().catch(() => null);
  if (
    response.status === 409 &&
    status === "same_listing" &&
    data?.canConfirmArchiveAreaDifference
  ) {
    if (
      !window.confirm(
        `${data.message}\n\nPołączyć wszystkie ogłoszenia z aktywną ofertą mimo różnicy metrażu?`,
      )
    )
      return null;
    response = await submit(true);
    data = await response.json().catch(() => null);
  }
  if (!response.ok || !data)
    throw Error(data?.message ?? "Nie udało się zapisać decyzji o duplikacie.");
  return data as { primaryListingId?: string };
}
