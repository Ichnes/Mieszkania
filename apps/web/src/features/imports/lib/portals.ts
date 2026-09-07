import { apiBaseUrl } from "../../../shared/lib/api";

export function isGratkaUrl(value: string) {
  try {
    return new URL(value).hostname.includes("gratka");
  } catch {
    return false;
  }
}

export function resolveCollectorEndpoint(value: string) {
  try {
    const hostname = new URL(value).hostname;
    if (hostname.includes("nieruchomosci-online")) {
      return `${apiBaseUrl}/api/collectors/nieruchomosci-online/collect-one`;
    }
    if (hostname.includes("domiporta")) {
      return `${apiBaseUrl}/api/collectors/domiporta/collect-one`;
    }
    if (hostname.includes("maxon.pl")) {
      return `${apiBaseUrl}/api/collectors/maxon/collect-one`;
    }
    if (hostname.includes("adresowo.pl")) {
      return `${apiBaseUrl}/api/collectors/adresowo/collect-one`;
    }
    if (hostname.includes("morizon.pl")) {
      return `${apiBaseUrl}/api/collectors/morizon/collect-one`;
    }
    if (hostname.includes("gratka")) {
      return `${apiBaseUrl}/api/collectors/gratka/collect-one`;
    }
    if (hostname.includes("olx")) {
      return `${apiBaseUrl}/api/collectors/olx/collect-one`;
    }
  } catch {
    // fall through to default collector
  }

  return `${apiBaseUrl}/api/collectors/otodom/collect-one`;
}

export function isOutboundNetworkError(error?: string) {
  if (!error) return false;
  return /\bEACCES\b|\bEPERM\b|fetch failed|AggregateError|NETWORK_ACCESS_DENIED|connect [A-Z]+ .*:443|Refusing TLS fallback/i.test(
    error,
  );
}

export function friendlyPortalError(error: string) {
  if (isOutboundNetworkError(error)) return "brak połączenia HTTPS";
  return error.length > 120 ? `${error.slice(0, 117)}…` : error;
}
