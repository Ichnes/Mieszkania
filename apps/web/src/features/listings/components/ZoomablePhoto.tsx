import { useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function ZoomablePhoto({
  src,
  alt,
  rotation,
  onPrevious,
  onNext,
}: {
  src: string;
  alt: string;
  rotation: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const swipe = useRef<Point | null>(null);
  const pinched = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  useEffect(() => {
    const reset = () => {
      if (!stage.current) return;
      setSize({ width: stage.current.clientWidth, height: stage.current.clientHeight });
      setView({ scale: 1, x: 0, y: 0 });
      pointers.current.clear();
      swipe.current = null;
    };
    const observer = new ResizeObserver(reset);
    if (stage.current) observer.observe(stage.current);
    reset();
    return () => observer.disconnect();
  }, [rotation]);
  const clamp = (scale: number, x: number, y: number) => ({
    scale,
    x:
      scale === 1
        ? 0
        : Math.max((-size.width * (scale - 1)) / 2, Math.min((size.width * (scale - 1)) / 2, x)),
    y:
      scale === 1
        ? 0
        : Math.max((-size.height * (scale - 1)) / 2, Math.min((size.height * (scale - 1)) / 2, y)),
  });
  return (
    <div
      ref={stage}
      className="photo-gesture-stage"
      data-zoom={view.scale.toFixed(2)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={() => setView((current) => ({ scale: current.scale > 1 ? 1 : 2, x: 0, y: 0 }))}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = { x: event.clientX, y: event.clientY };
        pointers.current.set(event.pointerId, point);
        if (pointers.current.size === 1) {
          swipe.current = point;
          pinched.current = view.scale > 1;
        } else {
          pinched.current = true;
          swipe.current = null;
        }
      }}
      onPointerMove={(event) => {
        const previous = pointers.current.get(event.pointerId);
        if (!previous) return;
        const before = [...pointers.current.values()];
        const point = { x: event.clientX, y: event.clientY };
        pointers.current.set(event.pointerId, point);
        const after = [...pointers.current.values()];
        if (before.length === 2) {
          const ratio = distance(after[0], after[1]) / Math.max(1, distance(before[0], before[1]));
          const rect = event.currentTarget.getBoundingClientRect();
          const oldCenter = {
            x: (before[0].x + before[1].x) / 2 - rect.left - rect.width / 2,
            y: (before[0].y + before[1].y) / 2 - rect.top - rect.height / 2,
          };
          const newCenter = {
            x: (after[0].x + after[1].x) / 2 - rect.left - rect.width / 2,
            y: (after[0].y + after[1].y) / 2 - rect.top - rect.height / 2,
          };
          setView((current) => {
            const scale = Math.max(1, Math.min(5, current.scale * ratio));
            const factor = scale / current.scale;
            return clamp(
              scale,
              newCenter.x - (oldCenter.x - current.x) * factor,
              newCenter.y - (oldCenter.y - current.y) * factor,
            );
          });
        } else if (after.length === 1 && view.scale > 1) {
          setView((current) =>
            clamp(
              current.scale,
              current.x + point.x - previous.x,
              current.y + point.y - previous.y,
            ),
          );
        }
      }}
      onPointerUp={(event) => {
        pointers.current.delete(event.pointerId);
        const start = swipe.current;
        if (!pointers.current.size && start && !pinched.current && view.scale === 1) {
          const dx = event.clientX - start.x,
            dy = event.clientY - start.y;
          if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.25) {
            if (dx < 0) onNext();
            else onPrevious();
          }
        }
        if (!pointers.current.size) swipe.current = null;
      }}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        swipe.current = null;
        pinched.current = true;
      }}
    >
      <img
        className="image-lightbox-image"
        src={src}
        alt={alt}
        draggable={false}
        style={{
          maxWidth: size.width ? (rotation % 180 ? size.height : size.width) : "100%",
          maxHeight: size.height ? (rotation % 180 ? size.width : size.height) : "100%",
          transform: `translate(${view.x}px, ${view.y}px) rotate(${rotation}deg) scale(${view.scale})`,
        }}
      />
    </div>
  );
}
