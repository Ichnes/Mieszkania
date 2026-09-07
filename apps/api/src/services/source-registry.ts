import type { Pool, PoolClient } from "pg";

type SourceKind = "portal" | "public_registry";
type SourceAccessMode = "crawler" | "import";

const knownSources: Record<string, { name: string; kind: SourceKind; accessMode: SourceAccessMode }> = {
  otodom: {
    name: "Otodom",
    kind: "portal" as const,
    accessMode: "crawler" as const
  },
  gratka: {
    name: "Gratka",
    kind: "portal" as const,
    accessMode: "crawler" as const
  },
  olx: {
    name: "OLX",
    kind: "portal" as const,
    accessMode: "crawler" as const
  },
  nieruchomosci_online: {
    name: "Nieruchomosci-online",
    kind: "portal" as const,
    accessMode: "crawler" as const
  },
  domiporta: {
    name: "Domiporta",
    kind: "portal" as const,
    accessMode: "crawler" as const
  },
  maxon: {
    name: "Maxon",
    kind: "portal" as const,
    accessMode: "crawler" as const
  },
  adresowo: {
    name: "Adresowo",
    kind: "portal" as const,
    accessMode: "crawler" as const
  },
  morizon: {
    name: "Morizon",
    kind: "portal" as const,
    accessMode: "crawler" as const
  },
  deweloperuch_rcn: {
    name: "RCN import",
    kind: "public_registry" as const,
    accessMode: "import" as const
  }
};

export async function ensureSource(
  db: Pick<Pool | PoolClient, "query">,
  key: string,
  fallback?: {
    name: string;
    kind: SourceKind;
    accessMode: SourceAccessMode;
  }
) {
  const existing = await db.query<{ id: string }>(`select id from sources where key = $1 limit 1`, [key]);

  if (existing.rows[0]?.id) {
    return existing.rows[0].id;
  }

  const definition = knownSources[key] ?? fallback;

  if (!definition) {
    throw new Error(`Unknown source definition: ${key}`);
  }

  const inserted = await db.query<{ id: string }>(
    `
      insert into sources (key, name, kind, access_mode)
      values ($1, $2, $3, $4)
      on conflict (key)
      do update set
        name = excluded.name,
        kind = excluded.kind,
        access_mode = excluded.access_mode
      returning id
    `,
    [key, definition.name, definition.kind, definition.accessMode]
  );

  return inserted.rows[0].id;
}
