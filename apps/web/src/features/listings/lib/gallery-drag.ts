export function clearPhotoDrag(track: HTMLElement | null) {
  if (!track) return;
  delete track.dataset.dragging;
  track.style.removeProperty("--photo-drag");
}

export function previewPhotoDrag(track: HTMLElement, activeImageIndex: number, dx: number) {
  const neighbor = track.children[activeImageIndex + (dx < 0 ? 1 : -1)] as
    | HTMLImageElement
    | undefined;
  const width = track.clientWidth;
  const offset =
    neighbor?.complete && neighbor.naturalWidth ? Math.max(-width, Math.min(width, dx)) : 0;
  track.dataset.dragging = "true";
  track.style.setProperty("--photo-drag", offset + "px");
}
