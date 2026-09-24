import { createLatestRequest } from "../shared/lib/latest-request";

export type RemoteSectionState<T> = {
  status: "idle" | "loading" | "ready" | "error";
  data: T | null;
  error: string | null;
};

/** Each section owns its request and can fail or retry independently. */
export function createRemoteSection<T>(
  load: (signal: AbortSignal) => Promise<T>,
  errorMessage: string,
) {
  let state: RemoteSectionState<T> = { status: "idle", data: null, error: null };
  const listeners = new Set<() => void>();
  const request = createLatestRequest();
  const publish = (next: RemoteSectionState<T>) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reload: () =>
      request.run(load, {
        start: () => publish({ ...state, status: "loading", error: null }),
        success: (data) => publish({ data, status: "ready", error: null }),
        error: () => publish({ ...state, status: "error", error: errorMessage }),
        finish: () => {},
      }),
    cancel() {
      request.cancel();
      if (state.status === "loading")
        publish({ ...state, status: state.data === null ? "idle" : "ready" });
    },
    updateData(update: (data: T) => T) {
      if (state.data !== null) publish({ ...state, data: update(state.data) });
    },
  };
}
