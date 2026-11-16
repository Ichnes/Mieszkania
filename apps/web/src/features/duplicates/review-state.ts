import type { DuplicateCandidate, DuplicateCandidatesResponse } from "@mieszkania/shared";

export type DuplicateReviewEvent = {
  pair: DuplicateCandidate;
  status: "same_listing" | "different_listing";
};

export function removeRejectedPair(
  data: DuplicateCandidatesResponse | undefined,
  pair: DuplicateCandidate,
) {
  if (!data) return data;
  const items = data.items.filter(
    (item) =>
      !(
        (item.left.id === pair.left.id && item.right.id === pair.right.id) ||
        (item.left.id === pair.right.id && item.right.id === pair.left.id)
      ),
  );
  return { ...data, items, total: data.total - (data.items.length - items.length) };
}
