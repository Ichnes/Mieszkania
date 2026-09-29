// Docker Desktop exposes host binds in one of these forms. Named volumes must stay in Docker.
export function windowsStorageSource(mounts, platform) {
  if (platform !== "win32") return undefined;
  const source = mounts.find(
    (mount) => mount.Type === "bind" && mount.Destination === "/app/storage",
  )?.Source;
  if (typeof source !== "string") return undefined;
  const path = source
    .replace(/^\/run\/desktop\/mnt\/host\/([a-z])\//i, (_, drive) => `${drive.toUpperCase()}:/`)
    .replace(/^\/host_mnt\/([a-z])\//i, (_, drive) => `${drive.toUpperCase()}:/`);
  return /^[a-z]:[/\\]/i.test(path) ? path : undefined;
}
