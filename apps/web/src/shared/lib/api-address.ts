function isLoopback(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "[::1]" ||
    hostname === "::1" ||
    hostname === "0.0.0.0" ||
    /^127\./.test(hostname)
  );
}

export function resolveApiBaseUrl(configured: string | undefined, pageHostname: string) {
  const value = configured?.trim().replace(/\/$/, "") ?? "";
  if (!value) return "";
  try {
    const url = new URL(value);
    // A loopback URL embedded by an older local configuration points at the
    // phone itself. LAN clients must use the frontend's same-origin API proxy.
    if (isLoopback(url.hostname) && !isLoopback(pageHostname)) return "";
  } catch {
    // Relative API prefixes are already resolved against the current host.
  }
  return value;
}
