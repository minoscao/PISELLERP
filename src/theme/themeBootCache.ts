import type { AppUiThemeBundle, StyleChromeEffect } from "../types";
import { DEFAULT_UI_THEME_BUNDLE, normalizeUiThemeBundle } from "./uiThemePresets";

/** 与持久化 store 对齐；换键使旧首帧缓存失效 */
const KEY = "marketing-quote-theme-boot-v4";

type BootPayloadV2 = {
  v: 2;
  bundle: AppUiThemeBundle;
};

type BootPayloadV1 = {
  v: 1;
  appearance: unknown;
  chromeEffect: StyleChromeEffect;
};

export function readThemeBootCache(): AppUiThemeBundle | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as BootPayloadV2 | BootPayloadV1;
    if (!p || typeof p !== "object") return null;
    if (p.v === 2 && p.bundle && typeof p.bundle === "object") {
      return normalizeUiThemeBundle(p.bundle);
    }
    return null;
  } catch {
    return null;
  }
}

export function writeThemeBootCache(bundle: AppUiThemeBundle): void {
  try {
    let normalized = normalizeUiThemeBundle(bundle);
    if (
      normalized.customBackgroundArtDataUrl &&
      normalized.customBackgroundArtDataUrl.length > 1_200_000
    ) {
      const { customBackgroundArtDataUrl: _drop, ...rest } = normalized;
      normalized = normalizeUiThemeBundle(rest);
    }
    const payload: BootPayloadV2 = {
      v: 2,
      bundle: normalized,
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* 配额或隐私模式 */
  }
}

export function bootThemeOrDefault(): AppUiThemeBundle {
  return readThemeBootCache() ?? DEFAULT_UI_THEME_BUNDLE;
}
