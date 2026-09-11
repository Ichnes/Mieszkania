let revision = 0;
export function invalidateMarketStatsCache() {
  revision += 1;
}
export function createStatsCache<T>(ttlMs = 30000, maxEntries = 12, now = Date.now) {
  const results = new Map<string, { value: T; expiresAt: number }>();
  const pending = new Map<string, Promise<T>>();
  return async (key: string, compute: () => Promise<T>): Promise<T> => {
    key = `${revision}:${key}`;
    const cached = results.get(key);
    if (cached && cached.expiresAt > now()) return cached.value;
    if (pending.has(key)) return pending.get(key)!;
    const work = Promise.resolve()
      .then(compute)
      .then((value) => {
        results.delete(key);
        results.set(key, { value, expiresAt: now() + ttlMs });
        while (results.size > maxEntries) results.delete(results.keys().next().value!);
        return value;
      })
      .finally(() => pending.delete(key));
    pending.set(key, work);
    return work;
  };
}
