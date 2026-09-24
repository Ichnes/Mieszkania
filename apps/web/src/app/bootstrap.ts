import type { FamilySettings, SupportedRegion } from "@mieszkania/shared";

export async function loadWorkspaceBootstrap(fetchData: (path: string) => Promise<Response>) {
  async function read<T>(path: string, label: string): Promise<T> {
    const response = await fetchData(path);
    if (!response.ok)
      throw new Error(`Nie udało się pobrać ${label} (HTTP ${response.status}). Spróbuj ponownie.`);
    return response.json() as Promise<T>;
  }
  const [settings, region] = await Promise.all([
    read<FamilySettings>("/api/settings/family", "ustawień"),
    read<SupportedRegion>("/api/region", "regionu"),
  ]);
  return { settings, region };
}
