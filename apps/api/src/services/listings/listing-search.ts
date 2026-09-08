import { normalizePolish } from "../geography/address-normalization";

export function listingSearchPatterns(query: string) {
  const normalized = normalizePolish(query)
    .trim()
    .replace(/^(?:ul\.?|ulica|ulicy)\s+/, "");
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      // Polish adjective street names: Okopowa/Okopowej, Gwiaździsta/Gwiaździstej.
      const street = token.match(/^([a-z]{3,})(?:a|ej)$/);
      if (street) return `\\m${street[1]}(?:a|ej|e)\\M`;
      return token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    });
}

export function buildListingSearch(query: string, firstParameter: number) {
  const values = listingSearchPatterns(query);
  const text = `translate(lower(concat_ws(' ',l.title,l.description,l.address_text,l.district,l.neighborhood)), 'ąćęłńóśźż', 'acelnoszz')`;
  return {
    clause: values.map((_, index) => `${text} ~ $${firstParameter + index}`).join(" and "),
    values,
  };
}
