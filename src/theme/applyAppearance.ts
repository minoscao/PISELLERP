import type { AppThemeMode, AppUiAppearance } from "../types";

/**
 * 默认：深色毛玻璃（冷灰线框 + 低对比描边 + 大圆角；与 glassApp.css :root 同步）
 */
export const DEFAULT_UI_APPEARANCE: AppUiAppearance = {
  mode: "dark",
  backgroundColor: "#0d1017",
  backgroundOpacityPct: 100,
  primaryColor: "#7c6cf0",
  /** 与 ui-stage 大外框默认一致（偏冷蓝灰，不随主色换橙/紫） */
  shellFrameColor: "#5a6d94",
  wireframeColor: "#3f4a5c",
  wireframeOpacityPct: 78,
  panelFillColor: "#151b24",
  panelFillOpacityPct: 50,
  panelBorderColor: "#283040",
  panelBorderOpacityPct: 26,
  textColor: "#d0c4e8",
  textMutedColor: "#948ab0",
  textSubtleColor: "#736892",
  infoColor: "#38bdf8",
  infoOpacityPct: 100,
  successColor: "#4ade80",
  dangerColor: "#fb7185",
  warningColor: "#fbbf24",
  inputFillColor: "#0a0e14",
  inputFillOpacityPct: 80,
  onPrimaryColor: "#15091f",
  radiusSmPx: 12,
  radiusMdPx: 14,
  radiusLgPx: 18,
  radiusXlPx: 22,
  radius2xlPx: 28,
  radius3xlPx: 36,
  borderHairlinePx: 1,
  borderEmphasisPx: 2,
  previewDecorRingOpacityPct: 100,
};

/** 壳层运行时：面板 alpha 与 blur 相对配色表 / 滑块的缩放（由 chrome 写入） */
export type AppearanceChromeRuntime = {
  panelFillAlphaScalePct?: number;
};

/** 混亮用：淡薰衣草灰（刻意不用近白，避免暗底上像白字） */
const NEUTRAL_LIFT = "#c4b2dd";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  if (!A || !B) return a;
  const u = (x: number, y: number) => Math.round(x + (y - x) * t);
  return rgbToHex(u(A.r, B.r), u(A.g, B.g), u(A.b, B.b));
}

function darkenRgb(hex: string, amount: number): { r: number; g: number; b: number } | null {
  const c = hexToRgb(hex);
  if (!c) return null;
  const u = (x: number) => Math.round(x * (1 - amount));
  return { r: u(c.r), g: u(c.g), b: u(c.b) };
}

function rgbTriplet(rgb: { r: number; g: number; b: number }): string {
  return `${rgb.r} ${rgb.g} ${rgb.b}`;
}

/** sRGB 0–255 → 线性分量，用于 WCAG 相对亮度 */
function linearChannel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  return 0.2126 * linearChannel(rgb.r) + 0.7152 * linearChannel(rgb.g) + 0.0722 * linearChannel(rgb.b);
}

/** 深色主色块上：在浅色字与深色字之间自动选对比更高的一侧（修正近黑字+深紫主色） */
function pickOnPrimaryRgb(
  mode: AppThemeMode,
  primaryHex: string,
  paletteOnPrimaryHex: string,
): { r: number; g: number; b: number } {
  const pr = hexToRgb(primaryHex);
  const paletteInk = hexToRgb(paletteOnPrimaryHex);
  if (!pr) return paletteInk ?? { r: 248, g: 250, b: 252 };
  if (mode !== "dark") {
    return paletteInk ?? { r: 15, g: 23, b: 42 };
  }
  const L = relativeLuminance(pr);
  const white = { r: 248, g: 250, b: 252 };
  const black = { r: 16, g: 16, b: 20 };
  const contrastWhite = (relativeLuminance(white) + 0.05) / (L + 0.05);
  const contrastBlack = (L + 0.05) / (relativeLuminance(black) + 0.05);
  return contrastWhite >= contrastBlack ? white : black;
}

function clampOpacityPct(n: unknown, fallback: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function clampPx(n: unknown, fallback: number, minPx: number, maxPx: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.max(minPx, Math.min(maxPx, n));
}

function rgbaFromRgb(rgb: { r: number; g: number; b: number }, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}

function clampHex6(hex: string, fallback: string): string {
  const h = hex.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(h)) return h.toLowerCase();
  return fallback.toLowerCase();
}

export function normalizeUiAppearance(raw: Partial<AppUiAppearance> | undefined): AppUiAppearance {
  const d = DEFAULT_UI_APPEARANCE;
  const mode: AppThemeMode = raw?.mode === "light" ? "light" : "dark";
  const defaultBg = mode === "light" ? "#e8edf5" : d.backgroundColor;
  const defaultWire = mode === "light" ? "#64748b" : d.wireframeColor;
  const defaultPanelFill = mode === "light" ? "#eef2f8" : d.panelFillColor;
  const defaultPanelBorder = mode === "light" ? "#9eb0c8" : d.panelBorderColor;
  const defaultInfo = mode === "light" ? "#0369a1" : d.infoColor;
  const defaultText = mode === "light" ? "#0f172a" : d.textColor;
  const defaultMuted = mode === "light" ? "#475569" : d.textMutedColor;
  const defaultSubtle = mode === "light" ? "#64748b" : d.textSubtleColor;
  const defaultSuccess = mode === "light" ? "#047857" : d.successColor;
  const defaultDanger = mode === "light" ? "#be123c" : d.dangerColor;
  const defaultWarning = mode === "light" ? "#b45309" : d.warningColor;
  const defaultInputFill = mode === "light" ? "#f4f6fb" : d.inputFillColor;
  const defaultOnPrimary = mode === "light" ? "#0c1224" : d.onPrimaryColor;
  const defaultShellFrame = mode === "light" ? "#7c8cac" : d.shellFrameColor;

  const primary = clampHex6(raw?.primaryColor ?? "", d.primaryColor);
  const shellFrame = clampHex6(raw?.shellFrameColor ?? "", defaultShellFrame);
  return {
    mode,
    backgroundColor: clampHex6(raw?.backgroundColor ?? "", defaultBg),
    backgroundOpacityPct: clampOpacityPct(raw?.backgroundOpacityPct, d.backgroundOpacityPct),
    primaryColor: primary,
    shellFrameColor: shellFrame,
    wireframeColor: clampHex6(raw?.wireframeColor ?? "", defaultWire),
    wireframeOpacityPct: clampOpacityPct(raw?.wireframeOpacityPct, d.wireframeOpacityPct),
    panelFillColor: clampHex6(raw?.panelFillColor ?? "", defaultPanelFill),
    panelFillOpacityPct: clampOpacityPct(raw?.panelFillOpacityPct, d.panelFillOpacityPct),
    panelBorderColor: clampHex6(raw?.panelBorderColor ?? "", defaultPanelBorder),
    panelBorderOpacityPct: clampOpacityPct(raw?.panelBorderOpacityPct, d.panelBorderOpacityPct),
    textColor: clampHex6(raw?.textColor ?? "", defaultText),
    textMutedColor: clampHex6(raw?.textMutedColor ?? "", defaultMuted),
    textSubtleColor: clampHex6(raw?.textSubtleColor ?? "", defaultSubtle),
    infoColor: clampHex6(raw?.infoColor ?? "", defaultInfo),
    infoOpacityPct: clampOpacityPct(raw?.infoOpacityPct, d.infoOpacityPct),
    successColor: clampHex6(raw?.successColor ?? "", defaultSuccess),
    dangerColor: clampHex6(raw?.dangerColor ?? "", defaultDanger),
    warningColor: clampHex6(raw?.warningColor ?? "", defaultWarning),
    inputFillColor: clampHex6(raw?.inputFillColor ?? "", defaultInputFill),
    inputFillOpacityPct: clampOpacityPct(raw?.inputFillOpacityPct, d.inputFillOpacityPct),
    onPrimaryColor: clampHex6(raw?.onPrimaryColor ?? "", defaultOnPrimary),
    radiusSmPx: clampPx(raw?.radiusSmPx, d.radiusSmPx, 0, 48),
    radiusMdPx: clampPx(raw?.radiusMdPx, d.radiusMdPx, 0, 48),
    radiusLgPx: clampPx(raw?.radiusLgPx, d.radiusLgPx, 0, 48),
    radiusXlPx: clampPx(raw?.radiusXlPx, d.radiusXlPx, 0, 64),
    radius2xlPx: clampPx(raw?.radius2xlPx, d.radius2xlPx, 0, 80),
    radius3xlPx: clampPx(raw?.radius3xlPx, d.radius3xlPx, 0, 96),
    borderHairlinePx: clampPx(raw?.borderHairlinePx, d.borderHairlinePx, 0.5, 6),
    borderEmphasisPx: clampPx(raw?.borderEmphasisPx, d.borderEmphasisPx, 1, 12),
    previewDecorRingOpacityPct: clampOpacityPct(raw?.previewDecorRingOpacityPct, d.previewDecorRingOpacityPct),
  };
}

function applySemanticPalette(
  root: HTMLElement,
  mode: AppThemeMode,
  key: "danger" | "success" | "warning" | "info",
  baseHex: string,
  bgHex: string,
  opacityScale: number,
): void {
  const base = hexToRgb(baseHex);
  if (!base) return;
  const bg = hexToRgb(bgHex);
  const ink = hexToRgb("#0f172a") ?? { r: 15, g: 23, b: 42 };
  const baseHexNorm = rgbToHex(base.r, base.g, base.b);

  if (mode === "dark") {
    const textSoft = mixHex(baseHexNorm, NEUTRAL_LIFT, 0.35);
    const textRgb = hexToRgb(textSoft) ?? base;
    const bgMix = bg
      ? {
          r: Math.round(base.r * 0.26 + bg.r * 0.74),
          g: Math.round(base.g * 0.26 + bg.g * 0.74),
          b: Math.round(base.b * 0.26 + bg.b * 0.74),
        }
      : { r: Math.round(base.r * 0.4), g: Math.round(base.g * 0.4), b: Math.round(base.b * 0.4) };

    const borderMix = bg
      ? {
          r: Math.round(base.r * 0.28 + bg.r * 0.72),
          g: Math.round(base.g * 0.28 + bg.g * 0.72),
          b: Math.round(base.b * 0.28 + bg.b * 0.72),
        }
      : base;

    root.style.setProperty(`--app-${key}-border`, rgbaFromRgb(borderMix, 0.3 * opacityScale));
    root.style.setProperty(`--app-${key}-bg`, rgbaFromRgb(bgMix, 0.36 * opacityScale));
    root.style.setProperty(`--app-${key}-text`, textSoft);
    root.style.setProperty(`--app-${key}-text-rgb`, rgbTriplet(textRgb));
    root.style.setProperty(`--app-${key}-ring`, rgbaFromRgb(borderMix, 0.18 * opacityScale));
  } else {
    const textDark = mixHex(baseHexNorm, rgbToHex(ink.r, ink.g, ink.b), 0.5);
    const textRgb = hexToRgb(textDark) ?? ink;
    root.style.setProperty(`--app-${key}-border`, rgbaFromRgb(base, 0.42 * opacityScale));
    root.style.setProperty(`--app-${key}-bg`, rgbaFromRgb(base, 0.12 * opacityScale));
    root.style.setProperty(`--app-${key}-text`, textDark);
    root.style.setProperty(`--app-${key}-text-rgb`, rgbTriplet(textRgb));
    root.style.setProperty(`--app-${key}-ring`, rgbaFromRgb(base, 0.24 * opacityScale));
  }
}

/** 将外观写入 document，供 Tailwind / 全局 CSS 变量使用 */
export function applyAppearanceToDocument(appearance: AppUiAppearance, runtime?: AppearanceChromeRuntime): void {
  const a = normalizeUiAppearance(appearance);
  const root = document.documentElement;
  root.dataset.theme = a.mode;
  root.style.colorScheme = a.mode === "light" ? "light" : "dark";

  const bg = a.backgroundColor;
  const primary = a.primaryColor;
  const bgOpacity = a.backgroundOpacityPct / 100;
  const lineOpacity = a.wireframeOpacityPct / 100;

  const panelFill = a.panelFillColor;
  const surface =
    a.mode === "dark" ? mixHex(bg, panelFill, 0.42) : mixHex(bg, mixHex(panelFill, NEUTRAL_LIFT, 0.5), 0.4);
  const surface2 =
    a.mode === "dark"
      ? mixHex(mixHex(bg, panelFill, 0.54), NEUTRAL_LIFT, 0.04)
      : mixHex(mixHex(bg, NEUTRAL_LIFT, 0.32), panelFill, 0.26);
  const headerBg =
    a.mode === "dark" ? mixHex(bg, mixHex(panelFill, primary, 0.08), 0.52) : mixHex(bg, panelFill, 0.52);

  const text = a.textColor;
  const muted = a.textMutedColor;
  const subtle = a.textSubtleColor;
  const textRgb = hexToRgb(text) ?? { r: 208, g: 196, b: 232 };
  const mutedRgb = hexToRgb(muted) ?? { r: 148, g: 138, b: 176 };
  const subtleRgb = hexToRgb(subtle) ?? { r: 115, g: 104, b: 146 };

  const pr = hexToRgb(primary);
  const shellFr = hexToRgb(a.shellFrameColor) ?? { r: 90, g: 109, b: 148 };
  const primaryHover = darkenRgb(primary, 0.1) ?? pr ?? { r: 124, g: 108, b: 240 };
  const primarySoft = mixHex(primary, surface, a.mode === "dark" ? 0.82 : 0.88);
  const primaryTone = a.mode === "dark" ? mixHex(primary, NEUTRAL_LIFT, 0.32) : mixHex(primary, "#0f172a", 0.22);
  const toneRgb = hexToRgb(primaryTone) ?? pr ?? { r: 196, g: 181, b: 253 };

  const wire = a.wireframeColor;
  const wireSoftHex = mixHex(wire, bg, a.mode === "dark" ? 0.22 : 0.18);

  const bgRgb = hexToRgb(bg);
  const wireRgb = hexToRgb(wire) ?? { r: 63, g: 74, b: 92 };
  const wireSoftRgb = hexToRgb(wireSoftHex) ?? wireRgb;
  const bgBase = bgRgb ?? { r: 13, g: 16, b: 23 };
  /**
   * 深色：线框色相只来自 **wireframeColor**（低饱和中性），再压入背景减轻「白边」感。
   * 不混入 primary，避免换紫/橙/蓝主色时整页描边跟着变色。
   */
  const lineRgb =
    a.mode === "dark"
      ? {
          r: Math.round(wireRgb.r * 0.58 + bgBase.r * 0.42),
          g: Math.round(wireRgb.g * 0.58 + bgBase.g * 0.42),
          b: Math.round(wireRgb.b * 0.58 + bgBase.b * 0.42),
        }
      : wireRgb;
  const lineSoftRgb =
    a.mode === "dark"
      ? {
          r: Math.round(lineRgb.r * 0.88 + bgBase.r * 0.12),
          g: Math.round(lineRgb.g * 0.88 + bgBase.g * 0.12),
          b: Math.round(lineRgb.b * 0.88 + bgBase.b * 0.12),
        }
      : wireSoftRgb;

  const lineSubtleA = (a.mode === "dark" ? 0.1 : 0.3) * lineOpacity;
  const lineMidA = (a.mode === "dark" ? 0.14 : 0.4) * lineOpacity;
  const lineStrongA = (a.mode === "dark" ? 0.2 : 0.55) * lineOpacity;
  const dividerA = (a.mode === "dark" ? 0.12 : 0.45) * lineOpacity;
  const headerBorderA = (a.mode === "dark" ? 0.22 : 0.62) * lineOpacity;

  root.style.setProperty("--app-bg", bgRgb ? rgbaFromRgb(bgRgb, bgOpacity) : bg);
  root.style.setProperty("--app-surface", surface);
  root.style.setProperty("--app-surface-2", surface2);
  root.style.setProperty("--app-map-export-capture-dark", surface2);
  root.style.setProperty("--app-map-export-capture-light", bgRgb ? rgbaFromRgb(bgRgb, bgOpacity) : bg);
  const surfRgb = hexToRgb(surface) ?? { r: 18, g: 22, b: 30 };
  const surf2Rgb = hexToRgb(surface2) ?? { r: 22, g: 27, b: 36 };
  root.style.setProperty("--app-surface-rgb", rgbTriplet(surfRgb));
  root.style.setProperty("--app-surface-2-rgb", rgbTriplet(surf2Rgb));
  root.style.setProperty("--app-border", rgbaFromRgb(lineRgb, headerBorderA));
  root.style.setProperty("--app-line-subtle", rgbaFromRgb(lineRgb, lineSubtleA));
  root.style.setProperty("--app-line-mid", rgbaFromRgb(lineRgb, lineMidA));
  root.style.setProperty("--app-line-strong", rgbaFromRgb(lineRgb, lineStrongA));
  root.style.setProperty("--app-divider", rgbaFromRgb(lineRgb, dividerA));
  root.style.setProperty("--app-header-bg", headerBg);
  root.style.setProperty("--app-text", text);
  root.style.setProperty("--app-text-muted", muted);
  root.style.setProperty("--app-text-subtle", subtle);
  root.style.setProperty("--app-text-rgb", rgbTriplet(textRgb));
  root.style.setProperty("--app-text-muted-rgb", rgbTriplet(mutedRgb));
  root.style.setProperty("--app-text-subtle-rgb", rgbTriplet(subtleRgb));

  root.style.setProperty("--app-primary-rgb", pr ? rgbTriplet(pr) : "124 108 240");
  root.style.setProperty("--app-shell-frame-rgb", rgbTriplet(shellFr));
  root.style.setProperty("--app-primary-hover-rgb", rgbTriplet(primaryHover));
  root.style.setProperty("--app-primary-soft", primarySoft);
  root.style.setProperty("--app-primary-tone", primaryTone);
  root.style.setProperty("--app-primary-tone-rgb", rgbTriplet(toneRgb));
  /** 与主色一致（兼容旧 CSS 变量名） */
  const accentBr = pr ?? { r: 124, g: 108, b: 240 };
  const accentBorderA = a.mode === "dark" ? 0.72 : 0.88;
  root.style.setProperty("--app-accent-border", rgbaFromRgb(accentBr, accentBorderA));
  root.style.setProperty("--app-accent-border-rgb", rgbTriplet(accentBr));
  root.style.setProperty(
    "--app-wire",
    rgbaFromRgb(lineRgb, lineOpacity > 0 ? Math.min(1, 0.55 * lineOpacity) : 0),
  );
  root.style.setProperty(
    "--app-wire-soft",
    rgbaFromRgb(lineSoftRgb, lineOpacity > 0 ? Math.min(1, 0.48 * lineOpacity) : 0),
  );
  root.style.setProperty("--app-wire-rgb", rgbTriplet(lineRgb));

  const pFillRgb = hexToRgb(a.panelFillColor) ?? { r: 21, g: 27, b: 36 };
  const panelBorderHex =
    a.mode === "dark" ? mixHex(a.panelBorderColor, a.wireframeColor, 0.78) : a.panelBorderColor;
  const pBorderRgbBase = hexToRgb(panelBorderHex) ?? hexToRgb(a.panelBorderColor) ?? { r: 40, g: 48, b: 64 };
  const pBorderRgb =
    a.mode === "dark"
      ? {
          r: Math.round(pBorderRgbBase.r * 0.78 + bgBase.r * 0.22),
          g: Math.round(pBorderRgbBase.g * 0.78 + bgBase.g * 0.22),
          b: Math.round(pBorderRgbBase.b * 0.78 + bgBase.b * 0.22),
        }
      : pBorderRgbBase;
  const infoO = a.infoOpacityPct / 100;
  const panelScale =
    runtime?.panelFillAlphaScalePct != null && Number.isFinite(runtime.panelFillAlphaScalePct)
      ? Math.max(0, Math.min(1.15, runtime.panelFillAlphaScalePct / 100))
      : 1;
  const effPanelA = Math.min(1, Math.max(0, (a.panelFillOpacityPct / 100) * panelScale));
  root.style.setProperty("--app-panel-bg", rgbaFromRgb(pFillRgb, effPanelA));
  const rawPanelA = a.panelBorderOpacityPct / 100;
  const panelBorderAlpha =
    a.mode === "dark" ? Math.max(0.06, Math.min(0.28, rawPanelA * 0.58)) : Math.max(0.08, Math.min(1, rawPanelA));
  root.style.setProperty("--app-panel-border", rgbaFromRgb(pBorderRgb, panelBorderAlpha));

  const inputRgb = hexToRgb(a.inputFillColor) ?? surf2Rgb;
  root.style.setProperty("--app-input-bg", rgbaFromRgb(inputRgb, a.inputFillOpacityPct / 100));
  const inputBorderA = a.mode === "dark" ? Math.min(0.24, lineMidA * 1.1) : Math.min(1, lineStrongA * 1.05);
  root.style.setProperty("--app-input-border", rgbaFromRgb(lineRgb, inputBorderA));
  root.style.setProperty("--app-input-placeholder", muted);

  const scrimBase = bgRgb ?? { r: 13, g: 16, b: 23 };
  root.style.setProperty("--app-overlay-scrim", rgbaFromRgb(scrimBase, a.mode === "dark" ? 0.58 : 0.42));

  root.style.setProperty("--app-radius-sm", `${a.radiusSmPx}px`);
  root.style.setProperty("--app-radius-md", `${a.radiusMdPx}px`);
  root.style.setProperty("--app-radius-lg", `${a.radiusLgPx}px`);
  root.style.setProperty("--app-radius-xl", `${a.radiusXlPx}px`);
  root.style.setProperty("--app-radius-2xl", `${a.radius2xlPx}px`);
  root.style.setProperty("--app-radius-3xl", `${a.radius3xlPx}px`);
  root.style.setProperty("--app-border-hairline", `${a.borderHairlinePx}px`);
  root.style.setProperty("--app-border-strong", `${a.borderEmphasisPx}px`);

  const onPr = pickOnPrimaryRgb(a.mode, primary, a.onPrimaryColor);
  root.style.setProperty("--app-on-primary-rgb", rgbTriplet(onPr));

  const decorA = panelBorderAlpha * (a.previewDecorRingOpacityPct / 100);
  root.style.setProperty("--app-decor-ring", rgbaFromRgb(pBorderRgb, Math.max(0, Math.min(1, decorA))));

  applySemanticPalette(root, a.mode, "danger", a.dangerColor, bg, 1);
  applySemanticPalette(root, a.mode, "success", a.successColor, bg, 1);
  applySemanticPalette(root, a.mode, "warning", a.warningColor, bg, 1);
  applySemanticPalette(root, a.mode, "info", a.infoColor, bg, Math.max(0.35, Math.min(1, infoO)));
}
