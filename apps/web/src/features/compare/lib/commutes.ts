import type { CommuteSummary } from "@mieszkania/shared";

export type ComparisonCommutes = Record<string, CommuteSummary[] | "error">;

export async function fetchComparisonCommutes(
  ids: string[],
  fetchCommutes: (id: string) => Promise<Response>,
): Promise<ComparisonCommutes> {
  return Object.fromEntries(
    await Promise.all(
      ids.map(async (id) => {
        try {
          const response = await fetchCommutes(id);
          if (!response.ok) throw new Error(String(response.status));
          const data: unknown = await response.json();
          if (
            !Array.isArray(data) ||
            !data.every(
              (item) =>
                item &&
                typeof item.key === "string" &&
                typeof item.label === "string" &&
                (item.durationMinutes === undefined ||
                  (Number.isFinite(item.durationMinutes) && item.durationMinutes >= 0)) &&
                (item.distanceKm === undefined ||
                  (Number.isFinite(item.distanceKm) && item.distanceKm >= 0)),
            )
          ) {
            throw new Error("Invalid commutes");
          }
          return [id, data as CommuteSummary[]] as const;
        } catch {
          return [id, "error"] as const;
        }
      }),
    ),
  );
}
