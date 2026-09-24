import { useEffect, useState } from "react";
import type { FamilySettings } from "@mieszkania/shared";
import { apiBaseUrl } from "../../shared/lib/api";
import { apiFetch } from "../../shared/lib/http";
import { createLatestRequest } from "../../shared/lib/latest-request";
import { fetchComparisonCommutes, type ComparisonCommutes } from "./lib/commutes";
import type { ComparisonListing } from "./lib/types";

export function useComparisonCommutes(
  listings: ComparisonListing[],
  workplaces: FamilySettings["workplaces"],
) {
  const key = JSON.stringify([
    listings.map(({ id, latitude, longitude }) => [id, latitude, longitude]),
    workplaces,
  ]);
  const [request] = useState(createLatestRequest);
  const [state, setState] = useState<{ key: string; loading: boolean; values: ComparisonCommutes }>(
    { key: "", loading: false, values: {} },
  );
  useEffect(() => () => request.cancel(), [key, request]);
  const current: { loading: boolean; values: ComparisonCommutes } =
    state.key === key ? state : { loading: false, values: {} };
  const load = () =>
    request.run(
      (signal) =>
        fetchComparisonCommutes(
          listings.map(({ id }) => id),
          (id) =>
            apiFetch(`${apiBaseUrl}/api/listings/${encodeURIComponent(id)}/commutes`, {
              signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
            }),
        ),
      {
        start: () => setState({ key, loading: true, values: {} }),
        success: (values) => setState({ key, loading: false, values }),
        error: () =>
          setState({
            key,
            loading: false,
            values: Object.fromEntries(listings.map(({ id }) => [id, "error"])),
          }),
        finish: () => {},
      },
    );
  return { ...current, load };
}
