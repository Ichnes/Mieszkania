export function toOptionalNumber(value: string) {
  const numeric = Number(value);
  return value === "" || Number.isNaN(numeric) ? undefined : numeric;
}

export function stringValue(value?: number) {
  return value === undefined ? "" : String(value);
}
