import { withDb } from "../../db";
import {
  normalizePolish,
  normalizeWarsawListingCity,
  sanitizeWarsawAddressText,
} from "../geography/address-normalization";
import {
  canonicalWarsawNeighborhood,
  inferWarsawNeighborhood,
} from "../geography/warsaw-neighborhoods";

export async function sanitizeStoredListingAddresses(options?: { dryRun?: boolean }) {
  return withDb(async (db) => {
    const result = await db.query<{
      id: string;
      address_text: string | null;
      district: string | null;
      neighborhood: string | null;
      city: string;
      title: string;
      description: string | null;
    }>(`
      select id, address_text, district, neighborhood, city, title, description
      from listings
      where (address_text is not null and trim(address_text) <> '')
         or (neighborhood is not null and trim(neighborhood) <> '')
    `);
    const changes = result.rows.flatMap((row) => {
      const city = normalizeWarsawListingCity(row.city, row.district, row.address_text);
      if (city !== "Warszawa") return [];
      const inferredNeighborhood =
        canonicalWarsawNeighborhood(row.neighborhood, row.district) ??
        inferWarsawNeighborhood(
          [row.title, row.description, row.address_text].filter(Boolean).join(" "),
          row.district,
        );
      const neighborhood =
        inferredNeighborhood &&
        normalizePolish(inferredNeighborhood) !== normalizePolish(row.district ?? "")
          ? inferredNeighborhood
          : undefined;
      const addressText =
        sanitizeWarsawAddressText(row.address_text, { ...row, neighborhood, city }) ??
        row.address_text;
      return addressText !== row.address_text ||
        city !== row.city ||
        neighborhood !== (row.neighborhood ?? undefined)
        ? [{ id: row.id, addressText, city, neighborhood }]
        : [];
    });
    if (changes.length === 0) return { updated: 0, candidates: 0, samples: [] };
    const samples = changes.slice(0, 10);
    if (options?.dryRun) return { updated: 0, candidates: changes.length, samples };

    await db.query(
      `
        update listings l
        set address_text = item.address_text,
            city = item.city,
            neighborhood = item.neighborhood,
            updated_at = now()
        from jsonb_to_recordset($1::jsonb) as item(id uuid, address_text text, city text, neighborhood text)
        where l.id = item.id
      `,
      [
        JSON.stringify(
          changes.map((change) => ({
            id: change.id,
            address_text: change.addressText,
            city: change.city,
            neighborhood: change.neighborhood ?? null,
          })),
        ),
      ],
    );
    return { updated: changes.length, candidates: changes.length, samples };
  });
}
