import { useEffect, useState, useSyncExternalStore } from "react";
import { apiBaseUrl } from "../shared/lib/api";
import { apiFetch } from "../shared/lib/http";
import { createRemoteSection } from "./remote-section";

export function useRemoteSection<T>(path: string, enabled: boolean, errorMessage: string) {
  const [section] = useState(() =>
    createRemoteSection<T>(async (signal) => {
      const response = await apiFetch(`${apiBaseUrl}${path}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<T>;
    }, errorMessage),
  );
  const state = useSyncExternalStore(section.subscribe, section.getSnapshot, section.getSnapshot);
  useEffect(() => {
    if (enabled) void section.reload();
    return () => section.cancel();
  }, [enabled, section]);
  return {
    ...state,
    reload: async () => {
      if (enabled) await section.reload();
    },
    updateData: section.updateData,
  };
}
