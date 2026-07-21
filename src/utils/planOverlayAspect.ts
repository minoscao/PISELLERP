import type { CSSProperties } from "react";

/** 将 "16:9" 转为 CSS aspect-ratio 的 "16 / 9" */
export function planOverlayAspectStyle(aspect: string | null | undefined): CSSProperties | undefined {
  if (!aspect) return undefined;
  const m = aspect.trim().match(/^(\d+):(\d+)$/);
  if (!m) return undefined;
  return { aspectRatio: `${m[1]} / ${m[2]}` };
}
