/** 平面图深浅主题下，保持色相（绿/紫等）、调整明度以便在底上可读 */

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "").trim();
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (h.length === 6) {
    const n = parseInt(h, 16);
    if (Number.isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  return null;
}

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((x) => clamp(x).toString(16).padStart(2, "0")).join("")}`;
}

function mixRgb(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
  t: number,
) {
  const u = 1 - t;
  return {
    r: r1 * u + r2 * t,
    g: g1 * u + g2 * t,
    b: b1 * u + b2 * t,
  };
}

export type MapThemeMode = "dark" | "light";

/** 图标/描边主色：深色地图偏亮，浅色地图偏暗，色相保留 */
export function accentForMap(hex: string, theme: MapThemeMode): string {
  const rgb = parseHex(hex);
  if (!rgb) return "var(--app-primary-tone)";
  if (theme === "dark") {
    const m = mixRgb(rgb.r, rgb.g, rgb.b, 255, 255, 255, 0.38);
    return rgbToHex(m.r, m.g, m.b);
  }
  const m = mixRgb(rgb.r, rgb.g, rgb.b, 15, 23, 42, 0.42);
  return rgbToHex(m.r, m.g, m.b);
}

/** 标记块背景（由 index.css + data-map-theme 提供变量） */
export function chipSurfaceForMap(_theme: MapThemeMode): string {
  return "var(--app-map-chip-bg)";
}

/** 标记上文字颜色 */
export function chipLabelTextForMap(_theme: MapThemeMode): string {
  return "var(--app-map-chip-text)";
}

/** 地图标记旁名称气泡底色（与底图对比度） */
export function mapLabelPillBgForMap(theme: MapThemeMode): string {
  return theme === "dark" ? "rgba(15, 23, 42, 0.94)" : "rgba(255, 255, 255, 0.96)";
}

/** 名称气泡描边 */
export function mapLabelPillBorderForMap(theme: MapThemeMode): string {
  return theme === "dark" ? "rgba(248, 250, 252, 0.22)" : "rgba(15, 23, 42, 0.14)";
}
