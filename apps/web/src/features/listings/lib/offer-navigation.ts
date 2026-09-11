export type OfferStep = {
  page: number;
  listingId?: string;
  edge?: "first" | "last";
  label: string;
};

export function getOfferStep(
  ids: string[],
  currentId: string,
  page: number,
  totalPages: number,
  direction: -1 | 1,
): OfferStep | null {
  const index = ids.indexOf(currentId);
  if (index < 0) return null;
  const listingId = ids[index + direction];
  if (listingId)
    return { page, listingId, label: direction === 1 ? "Następna oferta" : "Poprzednia oferta" };
  const nextPage = page + direction;
  if (nextPage < 1 || nextPage > totalPages) return null;
  return {
    page: nextPage,
    edge: direction === 1 ? "first" : "last",
    label:
      direction === 1 ? "Następna strona · pierwsza oferta" : "Poprzednia strona · ostatnia oferta",
  };
}
