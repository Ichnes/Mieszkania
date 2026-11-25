export function discoveryRange(start: string, count: string) {
  const startPage = Number(start || 1);
  const maxPages = Number(count || 50);
  if (
    !Number.isInteger(startPage) ||
    startPage < 1 ||
    startPage > 100_000 ||
    !Number.isInteger(maxPages) ||
    maxPages < 1 ||
    maxPages > 5000
  )
    return null;
  return { startPage, maxPages, endPage: startPage + maxPages - 1 };
}
