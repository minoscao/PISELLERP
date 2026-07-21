import type {
  PlanPreviewAnnotation,
  PlanPreviewExtraState,
  PlanRectAnnotation,
  PlanTextAnnotation,
} from "../types";
import { DEFAULT_UI_APPEARANCE } from "../theme/applyAppearance";

/** 归一化后的文字标注（颜色与数值字段均有确定默认值） */
export type NormalizedPlanTextAnnotation = PlanTextAnnotation & {
  fontFamily: string;
  fontSizePx: number;
  color: string;
  colorOpacityPct: number;
  backgroundColor: string;
  backgroundOpacityPct: number;
  borderColor: string;
  borderOpacityPct: number;
  borderWidthPx: number;
};

/** 归一化后的矩形标注 */
export type NormalizedPlanRectAnnotation = PlanRectAnnotation & {
  strokeColor: string;
  strokeOpacityPct: number;
  strokeWidthPx: number;
  fillColor: string;
  fillOpacityPct: number;
};

export function defaultPlanPreviewExtra(): PlanPreviewExtraState {
  return { scale: 1, rotationDeg: 0, annotations: [] };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** 将 0–100 的百分比夹紧；仅当缺失或非有限数时用 fallback（显式 0 保留） */
function clampPct(n: number | undefined, fallback: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function clampPctFromUnknown(n: unknown, fallback: number): number {
  if (n === null || n === undefined) return fallback;
  if (typeof n === "number") return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
  if (typeof n === "string" && n.trim() !== "") {
    const v = Number(n);
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : fallback;
  }
  return fallback;
}

/** 将 #RRGGBB 与 0–100 不透明度合成 rgba() */
export function rgbaFromHexOpacity(hex: string, opacityPct: number): string {
  const rgb = hexToRgb(hex);
  const a = clampPct(opacityPct, 100) / 100;
  if (!rgb) return rgbaFromHexOpacity(DEFAULT_UI_APPEARANCE.wireframeColor, opacityPct);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}

/** 从 legacy rgba / #RRGGBBAA 取近似 hex + opacity */
function splitColorAndOpacity(raw: string | undefined): { hex: string; opacityPct: number } {
  const s = (raw ?? "").trim();
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s);
  if (m) {
    const r = Math.min(255, parseInt(m[1], 10));
    const g = Math.min(255, parseInt(m[2], 10));
    const b = Math.min(255, parseInt(m[3], 10));
    const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
    const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
    return { hex, opacityPct: Math.round(Math.max(0, Math.min(1, a)) * 100) };
  }
  if (/^#[0-9a-fA-F]{8}$/.test(s)) {
    const hex = `#${s.slice(1, 7)}`;
    const alpha = parseInt(s.slice(7, 9), 16) / 255;
    return { hex, opacityPct: Math.round(alpha * 100) };
  }
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return { hex: s.toLowerCase(), opacityPct: 100 };
  return { hex: DEFAULT_UI_APPEARANCE.wireframeColor, opacityPct: 100 };
}

export function normalizeTextAnnotation(a: PlanTextAnnotation): NormalizedPlanTextAnnotation {
  const cr = (a.color ?? "").trim();
  const fg = /^#[0-9a-fA-F]{6}$/i.test(cr) ? { hex: cr.toLowerCase(), opacityPct: 100 } : splitColorAndOpacity(a.color);
  const br = (a.backgroundColor ?? "").trim();
  const bg = /^#[0-9a-fA-F]{6}$/i.test(br)
    ? { hex: br.toLowerCase(), opacityPct: 88 }
    : splitColorAndOpacity(a.backgroundColor);
  const dr = (a.borderColor ?? "").trim();
  const bd = /^#[0-9a-fA-F]{6}$/i.test(dr)
    ? { hex: dr.toLowerCase(), opacityPct: 100 }
    : splitColorAndOpacity(a.borderColor);
  const borderW =
    typeof a.borderWidthPx === "number" && Number.isFinite(a.borderWidthPx) && a.borderWidthPx >= 0
      ? a.borderWidthPx
      : 1;
  return {
    ...a,
    fontFamily: a.fontFamily ?? "ui-sans-serif, system-ui, sans-serif",
    fontSizePx: typeof a.fontSizePx === "number" && a.fontSizePx > 0 ? a.fontSizePx : 14,
    color: fg.hex,
    colorOpacityPct: clampPctFromUnknown(a.colorOpacityPct, fg.opacityPct),
    backgroundColor: bg.hex,
    backgroundOpacityPct: clampPctFromUnknown(a.backgroundOpacityPct, bg.opacityPct),
    borderColor: bd.hex,
    borderOpacityPct: clampPctFromUnknown(a.borderOpacityPct, bd.opacityPct),
    borderWidthPx: borderW,
  };
}

export function normalizeRectAnnotation(a: PlanRectAnnotation): NormalizedPlanRectAnnotation {
  const sr = (a.strokeColor ?? "").trim();
  const st = /^#[0-9a-fA-F]{6}$/i.test(sr)
    ? { hex: sr.toLowerCase(), opacityPct: 100 }
    : splitColorAndOpacity(a.strokeColor);
  const fr = (a.fillColor ?? "").trim();
  const fl = /^#[0-9a-fA-F]{6}$/i.test(fr)
    ? { hex: fr.toLowerCase(), opacityPct: 12 }
    : splitColorAndOpacity(a.fillColor);
  const strokeW =
    typeof a.strokeWidthPx === "number" && Number.isFinite(a.strokeWidthPx) && a.strokeWidthPx >= 0
      ? a.strokeWidthPx
      : 2;
  return {
    ...a,
    strokeColor: st.hex,
    strokeOpacityPct: clampPctFromUnknown(a.strokeOpacityPct, st.opacityPct),
    strokeWidthPx: strokeW,
    fillColor: fl.hex,
    fillOpacityPct: clampPctFromUnknown(a.fillOpacityPct, fl.opacityPct),
  };
}

export function normalizePlanPreviewExtra(raw: unknown): PlanPreviewExtraState {
  const d = defaultPlanPreviewExtra();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Partial<PlanPreviewExtraState>;
  const scale = typeof o.scale === "number" && o.scale > 0 ? Math.min(3, Math.max(0.25, o.scale)) : d.scale;
  const rotationDeg =
    typeof o.rotationDeg === "number" && Number.isFinite(o.rotationDeg) ? Math.min(180, Math.max(-180, o.rotationDeg)) : 0;
  const annotations: PlanPreviewAnnotation[] = Array.isArray(o.annotations)
    ? o.annotations
        .map((x) => {
          if (!x || typeof x !== "object") return null;
          const ann = x as PlanPreviewAnnotation;
          if (ann.type === "text")
            return normalizeTextAnnotation(ann as PlanTextAnnotation) as PlanPreviewAnnotation;
          if (ann.type === "rect")
            return normalizeRectAnnotation(ann as PlanRectAnnotation) as PlanPreviewAnnotation;
          return null;
        })
        .filter((x): x is PlanPreviewAnnotation => x !== null)
    : [];
  return { scale, rotationDeg, annotations };
}
