import { lookup } from "node:dns/promises";
import { request, type RequestOptions } from "node:https";
import type { IncomingMessage } from "node:http";
import { BlockList, isIP } from "node:net";
import { gunzipSync, inflateSync, brotliDecompressSync } from "node:zlib";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const)
  blocked.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
for (const [address, prefix] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
] as const)
  blocked.addSubnet(address, prefix, "ipv6");

export function isPublicAddress(address: string) {
  const family = isIP(address);
  return family === 4
    ? !blocked.check(address, "ipv4")
    : family === 6 && globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}

export function validatePublicUrl(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    (isIP(hostname) && !isPublicAddress(hostname))
  )
    throw new Error("Dozwolone są wyłącznie publiczne adresy HTTPS.");
  return url;
}

export function publicHttpsRequest(
  value: string | URL,
  options: RequestOptions,
  callback: (response: IncomingMessage) => void,
) {
  const url = validatePublicUrl(String(value));
  return request(
    url,
    {
      ...options,
      rejectUnauthorized: true,
      agent: false,
      lookup: (hostname, lookupOptions, done) => {
        void lookup(hostname, { all: true })
          .then((addresses) => {
            if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address)))
              throw new Error("Niedozwolony adres źródła.");
            const selected = addresses.find((item) => item.family === 4) ?? addresses[0];
            if (lookupOptions.all) done(null, [selected]);
            else done(null, selected.address, selected.family);
          })
          .catch((error) => done(error, "", 4));
      },
    },
    callback,
  );
}

/** DNS is checked once per hop and the verified address is pinned to the connection. */
export const publicHttp = { fetch: fetchPublicResource };
export function publicFetch(value: string, options: RequestInit = {}): Promise<Response> {
  return publicHttp.fetch(value, options);
}
async function fetchPublicResource(
  value: string,
  options: RequestInit = {},
  redirects = 4,
): Promise<Response> {
  const url = validatePublicUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address)))
    throw new Error("Adres źródła wskazuje na sieć prywatną lub zastrzeżoną.");
  const selected = addresses.find((item) => item.family === 4) ?? addresses[0];
  const headers = new Headers(options.headers);
  headers.delete("host");
  headers.set("accept-encoding", "identity");
  const signal = options.signal ?? AbortSignal.timeout(30_000);
  signal.throwIfAborted();
  return new Promise<Response>((resolve, reject) => {
    const req = request(
      url,
      {
        method: options.method ?? "GET",
        headers: Object.fromEntries(headers),
        rejectUnauthorized: true,
        agent: false,
        signal,
        lookup: (_host, lookupOptions, callback) => {
          if (lookupOptions.all) callback(null, [selected]);
          else callback(null, selected.address, selected.family);
        },
      },
      (response) => {
        const status = response.statusCode ?? 502;
        if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
          response.destroy();
          if (redirects === 0) return reject(new Error("Zbyt wiele przekierowań."));
          const target = new URL(response.headers.location, url);
          if (target.origin !== url.origin) {
            headers.delete("authorization");
            headers.delete("cookie");
          }
          void fetchPublicResource(
            target.href,
            { ...options, headers, signal },
            redirects - 1,
          ).then(resolve, reject);
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 25 * 1024 * 1024)
            response.destroy(new Error("Odpowiedź źródła przekracza 25 MB."));
          else chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => {
          try {
            let bytes = Buffer.concat(chunks);
            const limits = { maxOutputLength: 25 * 1024 * 1024 };
            if (response.headers["content-encoding"] === "gzip") bytes = gunzipSync(bytes, limits);
            if (response.headers["content-encoding"] === "deflate")
              bytes = inflateSync(bytes, limits);
            if (response.headers["content-encoding"] === "br")
              bytes = brotliDecompressSync(bytes, limits);
            const responseHeaders = new Headers();
            for (const [name, v] of Object.entries(response.headers))
              if (v !== undefined && name !== "content-encoding" && name !== "content-length")
                responseHeaders.set(name, Array.isArray(v) ? v.join(", ") : v);
            const result = new Response(
              [204, 205, 304].includes(status) ? null : new Uint8Array(bytes),
              { status, headers: responseHeaders },
            );
            Object.defineProperty(result, "url", { value: url.href });
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on("error", reject);
    req.end(options.body ?? undefined);
  });
}
