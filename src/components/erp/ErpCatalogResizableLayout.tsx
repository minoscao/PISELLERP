import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useRef, useState } from "react";

type ErpCatalogResizableLayoutProps = {
  left: ReactNode;
  middle: ReactNode;
  /** When null, right column and its splitter are omitted (e.g. no list row selected). */
  right: ReactNode | null;
  minLeft?: number;
  minMiddle?: number;
  minRight?: number;
  storageKey: string;
};

const SK_LEFT = (k: string) => `${k}-leftW`;
const SK_RIGHT = (k: string) => `${k}-rightW`;

export function ErpCatalogResizableLayout({
  left,
  middle,
  right,
  minLeft = 180,
  minMiddle = 200,
  minRight = 240,
  storageKey,
}: ErpCatalogResizableLayoutProps) {
  const hasRight = right != null;
  const rootRef = useRef<HTMLDivElement>(null);
  const [leftW, setLeftW] = useState(() => {
    if (typeof window === "undefined") return 300;
    const v = Number(window.localStorage.getItem(SK_LEFT(storageKey)));
    return Number.isFinite(v) && v >= minLeft ? v : 300;
  });
  const [rightW, setRightW] = useState(() => {
    if (typeof window === "undefined") return 460;
    const v = Number(window.localStorage.getItem(SK_RIGHT(storageKey)));
    return Number.isFinite(v) && v >= minRight ? v : 460;
  });

  const persist = useCallback(
    (l: number, r: number) => {
      try {
        window.localStorage.setItem(SK_LEFT(storageKey), String(Math.round(l)));
        window.localStorage.setItem(SK_RIGHT(storageKey), String(Math.round(r)));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const onDrag1 = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      (e.target as HTMLDivElement).setPointerCapture?.(e.pointerId);
      const el = rootRef.current;
      if (!el) return;
      const w = el.getBoundingClientRect().width;
      const x0 = e.clientX;
      const l0 = leftW;
      const r0 = hasRight ? rightW : 0;
      const splitter = 8;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - x0;
        const next = l0 + dx;
        const splitters = hasRight ? splitter * 2 : splitter;
        const maxL = w - r0 - splitters - minMiddle;
        setLeftW(Math.min(maxL, Math.max(minLeft, next)));
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const dx = ev.clientX - x0;
        const next = l0 + dx;
        const splitters = hasRight ? splitter * 2 : splitter;
        const maxL = w - r0 - splitters - minMiddle;
        const l = Math.min(maxL, Math.max(minLeft, next));
        setLeftW(l);
        persist(l, r0);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    },
    [leftW, rightW, minLeft, minMiddle, persist, hasRight],
  );

  const onDrag2 = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      (e.target as HTMLDivElement).setPointerCapture?.(e.pointerId);
      const el = rootRef.current;
      if (!el) return;
      const w = el.getBoundingClientRect().width;
      const x0 = e.clientX;
      const l0 = leftW;
      const r0 = rightW;
      const splitter = 8;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - x0;
        const next = r0 - dx;
        const maxR = w - l0 - splitter * 2 - minMiddle;
        setRightW(Math.min(maxR, Math.max(minRight, next)));
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const dx = ev.clientX - x0;
        const next = r0 - dx;
        const maxR = w - l0 - splitter * 2 - minMiddle;
        const r = Math.min(maxR, Math.max(minRight, next));
        setRightW(r);
        persist(l0, r);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    },
    [leftW, rightW, minMiddle, minRight, persist],
  );

  return (
    <div ref={rootRef} className="flex h-full min-h-0 min-w-0 flex-1">
      <div
        className="flex h-full min-h-0 min-w-0 shrink-0 flex-col overflow-hidden"
        style={{ width: leftW, maxWidth: "50%" }}
      >
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={onDrag1}
        className="group relative z-10 w-2 shrink-0 cursor-col-resize"
      >
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-app-line-mid group-hover:bg-app-primary/55 group-active:bg-app-primary" />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden" style={{ minWidth: minMiddle }}>
        {middle}
      </div>
      {hasRight ? (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            onPointerDown={onDrag2}
            className="group relative z-10 w-2 shrink-0 cursor-col-resize"
          >
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-app-line-mid group-hover:bg-app-primary/55 group-active:bg-app-primary" />
          </div>
          <div
            className="min-h-0 min-w-0 shrink-0 overflow-hidden"
            style={{ width: rightW, minWidth: minRight, maxWidth: "60%" }}
          >
            {right}
          </div>
        </>
      ) : null}
    </div>
  );
}
