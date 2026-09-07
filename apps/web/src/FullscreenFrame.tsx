import { useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

export function FullscreenFrame({ children, label, className = "", modal = false }: { children: ReactNode; label: string; className?: string; modal?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const nativeEntered = useRef(false);
  useEffect(() => {
    const sync = () => {
      if (document.fullscreenElement === ref.current) nativeEntered.current = true;
      else if (nativeEntered.current) { nativeEntered.current = false; setExpanded(false); }
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    if (!expanded && !modal) return;
    const overflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    buttonRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); void close(); }
      if (event.key === "Tab") {
        const focusable = [...(ref.current?.querySelectorAll<HTMLElement>('button, a[href], input, select, [tabindex="0"]') ?? [])].filter((element) => element.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", keydown, true);
    const openListing = () => void close();
    window.addEventListener("mieszkania:open-listing", openListing);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", keydown, true); window.removeEventListener("mieszkania:open-listing", openListing); previouslyFocused?.focus(); };
  }, [expanded, modal]);
  async function close() {
    if (document.fullscreenElement === ref.current) await document.exitFullscreen().catch(() => undefined);
    setExpanded(false);
  }
  async function toggle() {
    if (expanded) return close();
    setExpanded(true);
    try { await ref.current?.requestFullscreen?.(); } catch { /* Full viewport remains available on mobile browsers. */ }
  }
  return <div ref={ref} className={`fullscreen-frame ${className}${expanded ? " is-expanded" : ""}`} role={expanded ? "dialog" : undefined} aria-modal={expanded || undefined} aria-label={label}>
    {children}
    <button ref={buttonRef} className="fullscreen-toggle" type="button" onClick={(event) => { event.stopPropagation(); void toggle(); }} aria-label={expanded ? `Zamknij pełny ekran: ${label}` : `Pełny ekran: ${label}`} title={expanded ? "Zamknij pełny ekran" : "Pełny ekran"}>
      {expanded ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
    </button>
  </div>;
}

export function useMapResize(container: { current: HTMLDivElement | null }, map: { current: any }, ready: boolean) {
  useEffect(() => {
    if (!ready || !container.current) return;
    const resize = () => map.current?.invalidateSize({ pan: false });
    const observer = new ResizeObserver(resize);
    observer.observe(container.current);
    window.addEventListener("orientationchange", resize);
    window.visualViewport?.addEventListener("resize", resize);
    return () => { observer.disconnect(); window.removeEventListener("orientationchange", resize); window.visualViewport?.removeEventListener("resize", resize); };
  }, [ready, container, map]);
}
