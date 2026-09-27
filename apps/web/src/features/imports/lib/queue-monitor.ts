import type { OtodomQueueStatusResponse } from "@mieszkania/shared";

export function queuePollDelay(
  statuses: OtodomQueueStatusResponse[],
  unavailable: boolean,
  paused = false,
  now = Date.now(),
) {
  if (
    unavailable ||
    statuses.some(
      (status) =>
        status.counts.processing > 0 ||
        (!paused && (status.readyPending ?? status.counts.pending) > 0),
    )
  )
    return 5_000;
  if (paused) return 30_000;
  const attempts = statuses
    .map((status) => Date.parse(status.nextAttemptAt ?? ""))
    .filter(Number.isFinite);
  return attempts.length
    ? Math.max(5_000, Math.min(30_000, Math.min(...attempts) - now + 750))
    : 30_000;
}

/** One timer, immediate refresh on return to a visible tab, no overlapping reads. */
export function startQueueMonitor(
  refresh: () => Promise<unknown>,
  delay: () => number,
  visibility: Pick<Document, "hidden" | "addEventListener" | "removeEventListener"> = document,
) {
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const poll = async () => {
    if (stopped || running) return;
    clearTimeout(timer);
    running = true;
    try {
      if (!visibility.hidden) await refresh();
    } catch {
      // The request owner displays the error; polling must survive a rejected read.
    } finally {
      running = false;
      if (!stopped) timer = setTimeout(() => void poll(), delay());
    }
  };
  const visible = () => {
    if (!visibility.hidden) void poll();
  };
  visibility.addEventListener("visibilitychange", visible);
  void poll();
  return () => {
    stopped = true;
    clearTimeout(timer);
    visibility.removeEventListener("visibilitychange", visible);
  };
}
