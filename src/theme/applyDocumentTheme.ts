import { applyAppearanceToDocument, type AppearanceChromeRuntime } from "./applyAppearance";
import type { AppUiThemeBundle } from "../types";
import { normalizeUiThemeBundle, resolveThemeBundleToAppearance, resolveBackgroundDecorUrl } from "./uiThemePresets";
import { writeThemeBootCache } from "./themeBootCache";
import { applyUiPackLanguage } from "./uiPackLanguage";

/**
 * 将主题 bundle 写入 document：色板变量、毛玻璃 dataset、背景装饰层变量。
 */
export function applyDocumentTheme(bundle: AppUiThemeBundle): void {
  const b = normalizeUiThemeBundle(bundle);
  const appearance = resolveThemeBundleToAppearance(b);
  const rt: AppearanceChromeRuntime = {
    panelFillAlphaScalePct: b.chrome.panelFillAlphaScalePct,
  };
  applyAppearanceToDocument(appearance, rt);
  applyUiPackLanguage(b.packId, b.chrome, appearance.mode);

  const root = document.documentElement;
  root.dataset.uiEffect = b.chrome.effect === "glass" ? "glass" : "none";

  const panelTintT = Math.max(0, Math.min(1, (b.chrome.panelFillAlphaScalePct ?? 100) / 100));
  const blur = Math.round(b.chrome.glassBlurPx);
  root.style.setProperty("--app-glass-blur-header", `${blur}px`);
  root.style.setProperty("--app-glass-blur-panel", `${Math.round(blur * 0.78 * panelTintT)}px`);

  const url = resolveBackgroundDecorUrl(b);
  const opacityRaw = (b.backgroundIntensityPct / 100) * 0.92;
  if (url) {
    const safe = url.includes("'") ? url.replace(/'/g, "%27") : url;
    root.style.setProperty("--app-bg-art-url", `url('${safe}')`);
    root.style.setProperty("--app-bg-art-opacity", String(Math.max(0.06, Math.min(0.92, opacityRaw))));
    root.dataset.bgArt = "on";
    /** 有底图时用 normal，soft-light/multiply 会把照片「吃没」 */
    root.style.setProperty("--app-bg-art-blend", "normal");
  } else {
    root.style.removeProperty("--app-bg-art-url");
    root.style.setProperty("--app-bg-art-opacity", "0");
    root.dataset.bgArt = "off";
    root.style.setProperty("--app-bg-art-blend", appearance.mode === "light" ? "multiply" : "soft-light");
  }

  writeThemeBootCache(b);
}
