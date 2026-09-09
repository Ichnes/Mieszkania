export const moduleReloadKey = "mieszkania-module-reload-at-v1";
const reloadCooldownMs = 60_000;

export function recoverModuleError(
  error: unknown,
  environment: {
    online: boolean;
    storage: Pick<Storage, "getItem" | "setItem">;
    reload: () => void;
    now: number;
  },
) {
  const message = error instanceof Error ? error.message : String(error);
  if (
    !environment.online ||
    !/failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|loading chunk .* failed|unable to preload css/i.test(
      message,
    )
  )
    return false;
  try {
    const saved = environment.storage.getItem(moduleReloadKey);
    const lastAttempt = saved === null ? NaN : Number(saved);
    if (Number.isFinite(lastAttempt) && environment.now - lastAttempt < reloadCooldownMs)
      return false;
    // Write before reloading: a second failure must show recovery controls, not loop.
    environment.storage.setItem(moduleReloadKey, String(environment.now));
    environment.reload();
    return true;
  } catch {
    // Without persistent throttling, leave recovery to the visible retry button.
    return false;
  }
}
