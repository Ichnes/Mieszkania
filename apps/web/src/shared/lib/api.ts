import { resolveApiBaseUrl } from "./api-address";

export const apiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_URL, window.location.hostname);
