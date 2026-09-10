import { request as httpsRequest } from "node:https";
import type { FetchedListingDocument, ListingFetcher } from "../types";

export class OtodomFetcher implements ListingFetcher {
  async fetchListing(
    url: string,
    options?: { timeoutMs?: number },
  ): Promise<FetchedListingDocument> {
    const timeoutMs = options?.timeoutMs ?? 30_000;
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: OTODOM_HEADERS,
        });
        return {
          url,
          html: await response.text(),
          statusCode: response.status,
          responseHeaders: diagnosticHeaders(response.headers),
          finalUrl: response.url,
        };
      } catch (error) {
        lastError = error;
        if (
          isCertificateError(error) ||
          (error instanceof TypeError && error.message === "fetch failed")
        ) {
          try {
            return await fetchTrustedOtodomPage(url, timeoutMs);
          } catch (fallbackError) {
            lastError = fallbackError;
          }
        }
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 700));
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`Otodom request failed for ${url}`);
  }
}

const OTODOM_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml",
};

function isCertificateError(error: unknown) {
  const cause = error instanceof Error && "cause" in error ? error.cause : undefined;
  const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
  return (
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN" ||
    code === "CERT_HAS_EXPIRED"
  );
}

function fetchTrustedOtodomPage(
  url: string,
  timeoutMs: number,
  redirectsLeft = 4,
): Promise<FetchedListingDocument> {
  const target = new URL(url);
  if (!isOtodomHost(target.hostname)) {
    return Promise.reject(new Error(`Refusing TLS fallback for untrusted host ${target.hostname}`));
  }

  return new Promise((resolveResponse, rejectResponse) => {
    const request = httpsRequest(
      url,
      {
        method: "GET",
        rejectUnauthorized: false,
        timeout: timeoutMs,
        headers: OTODOM_HEADERS,
      },
      (response) => {
        const statusCode = response.statusCode ?? 500;
        const location = response.headers.location;
        if (location && statusCode >= 300 && statusCode < 400 && redirectsLeft > 0) {
          response.resume();
          const redirectedUrl = new URL(location, url);
          if (!isOtodomHost(redirectedUrl.hostname)) {
            rejectResponse(
              new Error(`Refusing untrusted Otodom redirect to ${redirectedUrl.hostname}`),
            );
            return;
          }
          void fetchTrustedOtodomPage(redirectedUrl.toString(), timeoutMs, redirectsLeft - 1).then(
            resolveResponse,
            rejectResponse,
          );
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
        response.on("end", () =>
          resolveResponse({
            url,
            html: Buffer.concat(chunks).toString("utf8"),
            statusCode,
            responseHeaders: diagnosticHeaders(response.headers),
            finalUrl: url,
          }),
        );
      },
    );
    request.on("timeout", () => request.destroy(new Error(`Otodom request timed out for ${url}`)));
    request.on("error", rejectResponse);
    request.end();
  });
}

function isOtodomHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === "otodom.pl" || normalized.endsWith(".otodom.pl");
}

function diagnosticHeaders(headers: Headers | Record<string, string | string[] | undefined>) {
  const result: Record<string, string> = {};
  for (const name of [
    "content-type",
    "server",
    "retry-after",
    "allow",
    "x-amzn-waf-action",
    "x-amzn-requestid",
    "x-cache",
    "date",
  ]) {
    const value = headers instanceof Headers ? headers.get(name) : headers[name];
    if (value) result[name] = Array.isArray(value) ? value.join(", ") : value;
  }
  return result;
}
