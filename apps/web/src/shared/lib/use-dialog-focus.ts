import { useEffect, useRef, type RefObject } from "react";

/** Keeps keyboard navigation in the active dialog, allowing nested map/photo dialogs. */
export function useDialogFocus(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  enabled = true,
) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const elements = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ),
      ).filter((element) => element.getClientRects().length && !element.closest("[inert]"));
    (elements()[0] ?? root).focus();
    const keydown = (event: KeyboardEvent) => {
      const nested = document.querySelector(
        ".fullscreen-frame.is-expanded, .photo-fullscreen, .dismiss-confirm-dialog",
      );
      if (event.defaultPrevented || document.fullscreenElement || (nested && nested !== root))
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      } else if (event.key === "Tab") {
        const items = elements();
        const first = items[0] ?? root;
        const last = items.at(-1) ?? root;
        if (
          !root.contains(document.activeElement) ||
          (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    };
    window.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, [ref, enabled]);
}
