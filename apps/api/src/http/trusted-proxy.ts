import { isIP } from "node:net";

export function parseTrustedProxies(value = process.env.TRUSTED_PROXIES ?? ""): false | string[] {
  const entries = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  for (const entry of entries) {
    const [address, prefix, extra] = entry.split("/");
    const family = isIP(address);
    if (
      !family ||
      extra !== undefined ||
      (prefix !== undefined &&
        (!/^\d+$/.test(prefix) || Number(prefix) > (family === 4 ? 32 : 128)))
    ) {
      throw new Error(
        "TRUSTED_PROXIES: podaj wyłącznie adresy IP lub zakresy CIDR zaufanych proxy.",
      );
    }
  }
  return entries.length ? entries : false;
}
