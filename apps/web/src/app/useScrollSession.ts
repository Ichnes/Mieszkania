import { useEffect, useRef } from "react";

const key = "mieszkania-scroll-y";

export function useScrollSession(ready: boolean, pathname: string) {
  const initial = useRef<{ path: string; y: number } | null>(null);
  if (!initial.current) {
    let y = 0;
    try {
      y = Number(sessionStorage.getItem(key)) || 0;
    } catch {}
    initial.current = { path: pathname, y: Math.max(0, y) };
  }
  useEffect(() => {
    if (!ready) return;
    let restoring = initial.current?.path === pathname && initial.current.y > 0;
    const target = restoring ? initial.current!.y : 0;
    const save = () => {
      if (restoring) return;
      try {
        sessionStorage.setItem(key, String(window.scrollY));
      } catch {}
    };
    const observer = new ResizeObserver(() => restore());
    const finish = () => {
      restoring = false;
      initial.current = { path: pathname, y: 0 };
      observer.disconnect();
      save();
    };
    const restore = () => {
      if (!restoring) return;
      // Lazy routes and API data must render before the saved position fits.
      if (document.documentElement.scrollHeight - innerHeight < target) return;
      window.scrollTo({ top: target, behavior: "instant" });
      finish();
    };
    if (restoring) {
      observer.observe(document.documentElement);
      restore();
    }
    const onVisibility = () => {
      if (document.hidden) save();
    };
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("pagehide", save);
    window.addEventListener("pageshow", restore);
    // User navigation takes precedence over pending restoration.
    window.addEventListener("touchstart", finish, { passive: true });
    window.addEventListener("wheel", finish, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      save();
      observer.disconnect();
      window.removeEventListener("scroll", save);
      window.removeEventListener("pagehide", save);
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("touchstart", finish);
      window.removeEventListener("wheel", finish);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ready, pathname]);
}
