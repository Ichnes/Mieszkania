export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (init?.method && !["GET", "HEAD"].includes(init.method.toUpperCase()))
    headers.set("X-App-Request", "1");
  const response = await fetch(input, { ...init, headers, credentials: "same-origin" });
  if (response.status === 401 && !String(input).includes("/api/auth/login"))
    window.dispatchEvent(new Event("auth:required"));
  return response;
}
