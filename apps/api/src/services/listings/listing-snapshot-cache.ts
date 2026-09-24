type Payload = Record<string, unknown>;
export type SnapshotVersion = { snapshot_id?: string | null; snapshot_version?: string | null };
type LoadedSnapshot = { id: string; version: string; payload: Payload };

// The list only needs these structured fields. Detail views keep their full payload.
export const listingSnapshotPayloadSql = `jsonb_build_object(
  'portalFeatures', payload_raw->'portalFeatures',
  'jsonLd', payload_raw->'jsonLd',
  'nextData', jsonb_build_object('props', jsonb_build_object('pageProps', jsonb_build_object('ad', jsonb_build_object('attributes', payload_raw#>'{nextData,props,pageProps,ad,attributes}'))))
)`;

/** Every request reads the current snapshot ID and xmin from PostgreSQL first. */
export function createListingSnapshotCache(maxBytes = 32 * 1024 * 1024, maxEntries = 5000) {
  const entries = new Map<string, LoadedSnapshot & { bytes: number }>();
  let bytes = 0;
  return {
    async load(
      versions: SnapshotVersion[],
      fetchMissing: (ids: string[]) => Promise<LoadedSnapshot[]>,
    ): Promise<Map<string, Payload>> {
      const result = new Map<string, Payload>();
      const missing = new Set<string>();
      for (const { snapshot_id: id, snapshot_version: version } of versions) {
        if (!id || !version) continue;
        const cached = entries.get(id);
        if (cached?.version === version) {
          entries.delete(id);
          entries.set(id, cached);
          result.set(id, cached.payload);
        } else missing.add(id);
      }
      if (!missing.size) return result;
      // Use the version returned with the payload, including an update racing with the first read.
      for (const snapshot of await fetchMissing([...missing])) {
        result.set(snapshot.id, snapshot.payload);
        const previous = entries.get(snapshot.id);
        if (previous) {
          entries.delete(snapshot.id);
          bytes -= previous.bytes;
        }
        const size = Buffer.byteLength(JSON.stringify(snapshot.payload), "utf8");
        if (size > maxBytes || maxEntries <= 0) continue;
        while (entries.size && (entries.size >= maxEntries || bytes + size > maxBytes)) {
          const oldest = entries.keys().next().value!;
          bytes -= entries.get(oldest)!.bytes;
          entries.delete(oldest);
        }
        entries.set(snapshot.id, { ...snapshot, bytes: size });
        bytes += size;
      }
      return result;
    },
  };
}
