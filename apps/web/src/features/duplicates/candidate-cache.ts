import type { DuplicateCandidate } from "@mieszkania/shared";

export function createCandidateCache(
  fetchCandidates: (id: string, signal: AbortSignal) => Promise<DuplicateCandidate[]>,
  now = Date.now,
  ttl = 5 * 60_000,
  maxEntries = 100,
) {
  const entries = new Map<string, { items: DuplicateCandidate[]; expires: number }>();
  const pending = new Map<
    string,
    { controller: AbortController; promise: Promise<DuplicateCandidate[]> }
  >();
  function peek(id: string) {
    const entry = entries.get(id);
    if (!entry) return undefined;
    if (entry.expires <= now()) {
      entries.delete(id);
      return undefined;
    }
    entries.delete(id);
    entries.set(id, entry);
    return entry.items;
  }
  return {
    peek,
    load(id: string): Promise<DuplicateCandidate[]> {
      const cached = peek(id);
      if (cached !== undefined) return Promise.resolve(cached);
      const existing = pending.get(id);
      if (existing) return existing.promise;
      const controller = new AbortController();
      const promise = Promise.resolve()
        .then(() => fetchCandidates(id, controller.signal))
        .then((items) => {
          if (controller.signal.aborted) throw new DOMException("Cache invalidated", "AbortError");
          entries.set(id, { items, expires: now() + ttl });
          while (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
          return items;
        })
        .finally(() => {
          if (pending.get(id)?.controller === controller) pending.delete(id);
        });
      pending.set(id, { controller, promise });
      return promise;
    },
    clear() {
      entries.clear();
      for (const entry of pending.values()) entry.controller.abort();
      pending.clear();
    },
  };
}
