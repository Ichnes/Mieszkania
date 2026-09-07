import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type ExternalJsonOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string | URLSearchParams;
  timeoutMs: number;
  maxBufferBytes?: number;
};

export async function fetchExternalJson<T>(url: string | URL, options: ExternalJsonOptions): Promise<T> {
  const body = options.body instanceof URLSearchParams ? options.body.toString() : options.body;
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body,
      signal: AbortSignal.timeout(options.timeoutMs)
    });
    if (!response.ok) throw new ExternalHttpError(response.status);
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ExternalHttpError) throw error;
    return JSON.parse(await fetchTextWithSystemCurl(url.toString(), { ...options, body })) as T;
  }
}

export async function fetchExternalText(url: string | URL, options: ExternalJsonOptions): Promise<string> {
  const body = options.body instanceof URLSearchParams ? options.body.toString() : options.body;
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body,
      signal: AbortSignal.timeout(options.timeoutMs)
    });
    if (!response.ok) throw new ExternalHttpError(response.status);
    return await response.text();
  } catch (error) {
    if (error instanceof ExternalHttpError) throw error;
    return fetchTextWithSystemCurl(url.toString(), { ...options, body });
  }
}

class ExternalHttpError extends Error {
  constructor(readonly status: number) {
    super(`EXTERNAL_HTTP_${status}`);
  }
}

async function fetchTextWithSystemCurl(url: string, options: Omit<ExternalJsonOptions, "body"> & { body?: string }) {
  const marker = "\n__MIESZKANIA_HTTP_STATUS__:";
  const executable = process.platform === "win32" ? "curl.exe" : "curl";
  const args = [
    "--silent",
    "--show-error",
    "--max-time",
    String(Math.max(1, Math.ceil(options.timeoutMs / 1_000))),
    "--request",
    options.method ?? "GET"
  ];
  for (const [name, value] of Object.entries(options.headers ?? {})) args.push("--header", `${name}: ${value}`);
  if (options.body !== undefined) args.push("--data-binary", options.body);
  args.push("--write-out", `${marker}%{http_code}`, url);

  const result = await execFileAsync(executable, args, {
    encoding: "utf8",
    timeout: options.timeoutMs + 2_000,
    maxBuffer: options.maxBufferBytes ?? 24 * 1024 * 1024,
    windowsHide: true
  });
  const markerIndex = result.stdout.lastIndexOf(marker);
  if (markerIndex < 0) throw new Error("EXTERNAL_CURL_INVALID_RESPONSE");
  const status = Number(result.stdout.slice(markerIndex + marker.length).trim());
  if (status < 200 || status >= 300) throw new ExternalHttpError(status);
  return result.stdout.slice(0, markerIndex);
}
