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

export function resolveApiBaseUrl(configured: string | undefined, _pageHostname: string) {
  const value = configured?.trim().replace(/\/$/, "") ?? "";
  if (!value) return "";
  try {
    const url = new URL(value);
    // Older .env files used a separate localhost API. Always use the proxy for
    // loopback, also on the desktop: auth cookies and writes are same-origin.
    if (isLoopback(url.hostname)) return "";
  } catch {
    // Relative API prefixes are already resolved against the current host.
  }
  return value;
}
