import { apiBaseUrl } from "../../shared/lib/api";

export async function decisionRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: "include", ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || "Nie udało się odczytać danych. Spróbuj ponownie.");
  }
  return response.json() as Promise<T>;
}
