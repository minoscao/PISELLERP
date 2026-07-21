import type {
  AppThemeMode,
  AppUiAppearance,
  AppUiBackgroundId,
  AppUiChromeSettings,
  AppUiThemeBundle,
  UiStylePackId,
} from "../types";
import { DEFAULT_UI_APPEARANCE, normalizeUiAppearance } from "./applyAppearance";

const BG_FILES: Record<Exclude<AppUiBackgroundId, "none" | "custom">, string> = {
  violetBloom: "/theme-bg/violet-bloom.svg",
  amberHaze: "/theme-bg/amber-haze.svg",
  cyanDrift: "/theme-bg/cyan-drift.svg",
  indigoWell: "/theme-bg/indigo-well.svg",
  meshNoir: "/theme-bg/mesh-noir.svg",
};

export function backgroundArtUrl(id: AppUiBackgroundId): string | null {
  if (id === "none" || id === "custom") return null;
  return BG_FILES[id] ?? null;
}

/** 预设 SVG 或用户上传的 data URL */
export function resolveBackgroundDecorUrl(bundle: AppUiThemeBundle): string | null {
  const b = normalizeUiThemeBundle(bundle);
  if (b.backgroundId === "custom" && b.customBackgroundArtDataUrl?.startsWith("data:image/")) {
    return b.customBackgroundArtDataUrl;
  }
  return backgroundArtUrl(b.backgroundId);
}

export const DEFAULT_UI_THEME_BUNDLE: AppUiThemeBundle = {
  packId: "aurora",
  paletteId: "accentPurple",
  backgroundId: "violetBloom",
  backgroundIntensityPct: 42,
  chrome: {
    effect: "glass",
    glassBlurPx: 26,
    lineStrengthPct: 100,
    radiusScalePct: 100,
    panelFillAlphaScalePct: 78,
  },
};

type PaletteDef = { id: string; labelKey: string; patch: Partial<AppUiAppearance> };

type PackDef = {
  labelKey: string;
  hintKey: string;
  /** 在 DEFAULT_UI_APPEARANCE 之上的包级默认值（不含 palette） */
  basePatch: Partial<AppUiAppearance>;
  /** 点击顶部风格包卡片时套用：清空线框/面板覆盖，并强制背景与毛玻璃参数 */
  applyOnPackSelect: {
    backgroundId: AppUiBackgroundId;
    backgroundIntensityPct: number;
    chrome?: Partial<AppUiChromeSettings>;
  };
  palettes: PaletteDef[];
};

/** 旧持久化 paletteId → 新统一主色 id */
const LEGACY_PALETTE_MAP: Record<string, "accentPurple" | "accentOrange" | "accentBlue"> = {
  violet: "accentPurple",
  nocturne: "accentPurple",
  slate: "accentBlue",
  sky: "accentBlue",
  mist: "accentBlue",
  indigo: "accentPurple",
  btc: "accentOrange",
  blaze: "accentOrange",
  ember: "accentOrange",
  soot: "accentOrange",
  neon: "accentPurple",
  dusk: "accentPurple",
};

export const UI_THEME_PACKS: Record<UiStylePackId, PackDef> = {
  aurora: {
    labelKey: "theme.pack.aurora",
    hintKey: "theme.packHint.aurora",
    basePatch: {},
    applyOnPackSelect: {
      backgroundId: "violetBloom",
      backgroundIntensityPct: 42,
      chrome: {
        glassBlurPx: 26,
        lineStrengthPct: 100,
        radiusScalePct: 100,
        panelFillAlphaScalePct: 78,
      },
    },
    palettes: [
      {
        id: "accentPurple",
        labelKey: "theme.accent.purple",
        patch: {
          mode: "dark" as AppThemeMode,
          primaryColor: "#7c6cf0",
          backgroundColor: "#0d1017",
          panelFillColor: "#151b24",
          panelBorderColor: "#252d38",
          wireframeColor: "#3d4554",
          textColor: "#d0c4e8",
          textMutedColor: "#948ab0",
          textSubtleColor: "#736892",
          onPrimaryColor: "#15091f",
        },
      },
      {
        id: "accentOrange",
        labelKey: "theme.accent.orange",
        patch: {
          mode: "dark",
          primaryColor: "#ff7f00",
          backgroundColor: "#12100e",
          panelFillColor: "#1a1612",
          panelBorderColor: "#2a2623",
          wireframeColor: "#3c3935",
          textColor: "#f1ece6",
          textMutedColor: "#baa99c",
          textSubtleColor: "#7d7168",
          onPrimaryColor: "#1a0c04",
        },
      },
      {
        id: "accentBlue",
        labelKey: "theme.accent.blue",
        patch: {
          mode: "dark",
          primaryColor: "#3b82f6",
          backgroundColor: "#0a1018",
          panelFillColor: "#111a27",
          panelBorderColor: "#242a33",
          wireframeColor: "#323a44",
          textColor: "#e2e8f0",
          textMutedColor: "#94a3b8",
          textSubtleColor: "#64748b",
          onPrimaryColor: "#061018",
        },
      },
    ],
  },
  crextio: {
    labelKey: "theme.pack.crextio",
    hintKey: "theme.packHint.crextio",
    basePatch: {
      mode: "light",
      backgroundOpacityPct: 100,
      panelFillOpacityPct: 55,
      panelBorderOpacityPct: 22,
      wireframeOpacityPct: 55,
      inputFillOpacityPct: 88,
    },
    applyOnPackSelect: {
      backgroundId: "none",
      backgroundIntensityPct: 0,
      chrome: {
        glassBlurPx: 22,
        lineStrengthPct: 94,
        radiusScalePct: 102,
        panelFillAlphaScalePct: 88,
      },
    },
    palettes: [
      {
        id: "accentPurple",
        labelKey: "theme.accent.purple",
        patch: {
          mode: "light",
          backgroundColor: "#f5f0ff",
          panelFillColor: "#faf8ff",
          panelBorderColor: "#ddd6fe",
          wireframeColor: "#c4b5fd",
          primaryColor: "#6d28d9",
          textColor: "#1e1b4b",
          textMutedColor: "#5b5675",
          textSubtleColor: "#6b6880",
          infoColor: "#0369a1",
          onPrimaryColor: "#faf5ff",
          successColor: "#047857",
          dangerColor: "#be123c",
          warningColor: "#b45309",
        },
      },
      {
        id: "accentOrange",
        labelKey: "theme.accent.orange",
        patch: {
          mode: "light",
          backgroundColor: "#fff5ef",
          panelFillColor: "#fffaf7",
          panelBorderColor: "#fed7aa",
          wireframeColor: "#fdba74",
          primaryColor: "#ea580c",
          textColor: "#431407",
          textMutedColor: "#7c2d12",
          textSubtleColor: "#9a3412",
          infoColor: "#0369a1",
          onPrimaryColor: "#fff7ed",
          successColor: "#047857",
          dangerColor: "#be123c",
          warningColor: "#b45309",
        },
      },
      {
        id: "accentBlue",
        labelKey: "theme.accent.blue",
        patch: {
          mode: "light",
          backgroundColor: "#e8f1fb",
          panelFillColor: "#f6f9ff",
          panelBorderColor: "#c5d4e8",
          wireframeColor: "#94b8d8",
          primaryColor: "#2563eb",
          textColor: "#0f1f33",
          textMutedColor: "#4a5f78",
          textSubtleColor: "#6b7c90",
          infoColor: "#0369a1",
          onPrimaryColor: "#f0f7ff",
          successColor: "#047857",
          dangerColor: "#be123c",
          warningColor: "#b45309",
        },
      },
    ],
  },
  quantix: {
    labelKey: "theme.pack.quantix",
    hintKey: "theme.packHint.quantix",
    basePatch: {
      mode: "dark",
      backgroundOpacityPct: 100,
      panelFillOpacityPct: 48,
      wireframeOpacityPct: 72,
    },
    applyOnPackSelect: {
      backgroundId: "indigoWell",
      backgroundIntensityPct: 56,
      chrome: {
        glassBlurPx: 24,
        lineStrengthPct: 100,
        radiusScalePct: 98,
        panelFillAlphaScalePct: 76,
      },
    },
    palettes: [
      {
        id: "accentPurple",
        labelKey: "theme.accent.purple",
        patch: {
          mode: "dark",
          backgroundColor: "#07080d",
          panelFillColor: "#10121c",
          primaryColor: "#6366f1",
          panelBorderColor: "#1a1d28",
          wireframeColor: "#353c4a",
          textColor: "#e0e7ff",
          textMutedColor: "#a5b4fc",
          textSubtleColor: "#6b7280",
          onPrimaryColor: "#0b1020",
          infoColor: "#38bdf8",
        },
      },
      {
        id: "accentOrange",
        labelKey: "theme.accent.orange",
        patch: {
          mode: "dark",
          backgroundColor: "#090807",
          panelFillColor: "#14110f",
          primaryColor: "#ff7f00",
          panelBorderColor: "#282522",
          wireframeColor: "#3d3834",
          textColor: "#f1f5f9",
          textMutedColor: "#c4b5a0",
          textSubtleColor: "#8a7e6e",
          onPrimaryColor: "#1a0f05",
          infoColor: "#38bdf8",
        },
      },
      {
        id: "accentBlue",
        labelKey: "theme.accent.blue",
        patch: {
          mode: "dark",
          backgroundColor: "#070f14",
          panelFillColor: "#0f1724",
          primaryColor: "#0ea5e9",
          panelBorderColor: "#1a222a",
          wireframeColor: "#2a3540",
          textColor: "#e0f2fe",
          textMutedColor: "#7dd3fc",
          textSubtleColor: "#64748b",
          onPrimaryColor: "#082f49",
          infoColor: "#38bdf8",
        },
      },
    ],
  },
  fintrixity: {
    labelKey: "theme.pack.fintrixity",
    hintKey: "theme.packHint.fintrixity",
    basePatch: {
      mode: "dark",
      backgroundColor: "#0a0a0a",
      panelFillColor: "#141414",
      wireframeOpacityPct: 68,
      panelFillOpacityPct: 52,
    },
    applyOnPackSelect: {
      backgroundId: "meshNoir",
      backgroundIntensityPct: 78,
      chrome: {
        glassBlurPx: 28,
        lineStrengthPct: 108,
        radiusScalePct: 98,
        panelFillAlphaScalePct: 72,
      },
    },
    palettes: [
      {
        id: "accentPurple",
        labelKey: "theme.accent.purple",
        patch: {
          mode: "dark",
          backgroundColor: "#0c0a10",
          panelFillColor: "#16121f",
          primaryColor: "#a855f7",
          panelBorderColor: "#25232e",
          wireframeColor: "#3a3645",
          textColor: "#ede9fe",
          textMutedColor: "#b4a5d8",
          textSubtleColor: "#7c7199",
          onPrimaryColor: "#14081f",
          infoColor: "#c084fc",
        },
      },
      {
        id: "accentOrange",
        labelKey: "theme.accent.orange",
        patch: {
          mode: "dark",
          backgroundColor: "#101010",
          panelFillColor: "#171717",
          primaryColor: "#ff7f00",
          panelBorderColor: "#2c2c2c",
          wireframeColor: "#3d3d3d",
          textColor: "#ececec",
          textMutedColor: "#a3a3a3",
          textSubtleColor: "#737373",
          onPrimaryColor: "#1a0c04",
          infoColor: "#fb923c",
        },
      },
      {
        id: "accentBlue",
        labelKey: "theme.accent.blue",
        patch: {
          mode: "dark",
          backgroundColor: "#0b1116",
          panelFillColor: "#121c24",
          primaryColor: "#38bdf8",
          panelBorderColor: "#1e252c",
          wireframeColor: "#2f3840",
          textColor: "#e0f2fe",
          textMutedColor: "#93c5fd",
          textSubtleColor: "#64748b",
          onPrimaryColor: "#082f49",
          infoColor: "#22d3ee",
        },
      },
    ],
  },
  sapphire: {
    labelKey: "theme.pack.sapphire",
    hintKey: "theme.packHint.sapphire",
    basePatch: {
      mode: "dark",
      panelFillOpacityPct: 46,
      wireframeOpacityPct: 78,
    },
    applyOnPackSelect: {
      backgroundId: "violetBloom",
      backgroundIntensityPct: 52,
      chrome: {
        glassBlurPx: 26,
        lineStrengthPct: 100,
        radiusScalePct: 104,
        panelFillAlphaScalePct: 80,
      },
    },
    palettes: [
      {
        id: "accentPurple",
        labelKey: "theme.accent.purple",
        patch: {
          mode: "dark",
          backgroundColor: "#0a0612",
          panelFillColor: "#150a22",
          primaryColor: "#d946ef",
          panelBorderColor: "#241e30",
          wireframeColor: "#3d3550",
          textColor: "#f5e1ff",
          textMutedColor: "#c4b5fd",
          textSubtleColor: "#8b7fb8",
          onPrimaryColor: "#1a0520",
          infoColor: "#22d3ee",
        },
      },
      {
        id: "accentOrange",
        labelKey: "theme.accent.orange",
        patch: {
          mode: "dark",
          backgroundColor: "#120a08",
          panelFillColor: "#1c120f",
          primaryColor: "#ff7f00",
          panelBorderColor: "#2a231f",
          wireframeColor: "#403935",
          textColor: "#fff1e6",
          textMutedColor: "#d4b8a8",
          textSubtleColor: "#8f7a6e",
          onPrimaryColor: "#1a0a04",
          infoColor: "#fdba74",
        },
      },
      {
        id: "accentBlue",
        labelKey: "theme.accent.blue",
        patch: {
          mode: "dark",
          backgroundColor: "#060f14",
          panelFillColor: "#0d1822",
          primaryColor: "#22d3ee",
          panelBorderColor: "#1a2328",
          wireframeColor: "#2a3a42",
          textColor: "#ecfeff",
          textMutedColor: "#a5f3fc",
          textSubtleColor: "#5e7a87",
          onPrimaryColor: "#083344",
          infoColor: "#38bdf8",
        },
      },
    ],
  },
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * 主强调色应为有彩度的颜色；低饱和灰若写入 primaryColorOverride 会与「线框」混淆，持久化时会迁回线框。
 */
export function isChromaticPrimaryCandidate(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx - mn < 26) return false;
  if (mx < 72 && mn < 72) return false;
  return true;
}

export function normalizeUiThemeBundle(raw: unknown): AppUiThemeBundle {
  const d = DEFAULT_UI_THEME_BUNDLE;
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Partial<AppUiThemeBundle>;
  const packIds = Object.keys(UI_THEME_PACKS) as UiStylePackId[];
  const packId = packIds.includes(o.packId as UiStylePackId) ? (o.packId as UiStylePackId) : d.packId;
  const pack = UI_THEME_PACKS[packId];
  const palIds = new Set(pack.palettes.map((p) => p.id));
  const rawPal = typeof o.paletteId === "string" ? o.paletteId.trim() : "";
  const mappedPal = LEGACY_PALETTE_MAP[rawPal] ?? rawPal;
  const paletteId =
    mappedPal && palIds.has(mappedPal)
      ? mappedPal
      : rawPal && palIds.has(rawPal)
        ? rawPal
        : pack.palettes[0]!.id;
  const bgIds: AppUiBackgroundId[] = [
    "none",
    "violetBloom",
    "amberHaze",
    "cyanDrift",
    "indigoWell",
    "meshNoir",
    "custom",
  ];
  let backgroundId = bgIds.includes(o.backgroundId as AppUiBackgroundId)
    ? (o.backgroundId as AppUiBackgroundId)
    : d.backgroundId;
  const rawCustom =
    typeof o.customBackgroundArtDataUrl === "string" ? o.customBackgroundArtDataUrl.trim() : "";
  if (backgroundId === "custom" && !rawCustom.startsWith("data:image/")) {
    backgroundId = "none";
  }
  const backgroundIntensityPct = clamp(
    typeof o.backgroundIntensityPct === "number" && Number.isFinite(o.backgroundIntensityPct)
      ? o.backgroundIntensityPct
      : d.backgroundIntensityPct,
    0,
    100,
  );
  const c = (o.chrome && typeof o.chrome === "object" ? o.chrome : {}) as Partial<AppUiChromeSettings>;
  const chrome: AppUiChromeSettings = {
    effect: c.effect === "none" ? "none" : "glass",
    glassBlurPx: clamp(
      typeof c.glassBlurPx === "number" && Number.isFinite(c.glassBlurPx) ? c.glassBlurPx : d.chrome.glassBlurPx,
      10,
      44,
    ),
    lineStrengthPct: clamp(
      typeof c.lineStrengthPct === "number" && Number.isFinite(c.lineStrengthPct)
        ? c.lineStrengthPct
        : d.chrome.lineStrengthPct,
      50,
      150,
    ),
    radiusScalePct: clamp(
      typeof c.radiusScalePct === "number" && Number.isFinite(c.radiusScalePct)
        ? c.radiusScalePct
        : d.chrome.radiusScalePct,
      80,
      130,
    ),
    panelFillAlphaScalePct: clamp(
      typeof c.panelFillAlphaScalePct === "number" && Number.isFinite(c.panelFillAlphaScalePct)
        ? c.panelFillAlphaScalePct
        : d.chrome.panelFillAlphaScalePct,
      0,
      100,
    ),
  };
  const optHex = (v: unknown): string | undefined => {
    const s = typeof v === "string" ? v.trim() : "";
    return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : undefined;
  };
  const wireOv = optHex(o.wireframeColorOverride);
  const panelFv = optHex(o.panelFillColorOverride);
  const primaryOv = optHex(o.primaryColorOverride);
  const rawLegacy = raw as Partial<AppUiThemeBundle> & { selectionOutlineColorOverride?: string };
  const shellOv =
    optHex(o.shellFrameColorOverride) ?? optHex(rawLegacy.selectionOutlineColorOverride ?? undefined);
  const baseOut: AppUiThemeBundle = { packId, paletteId, backgroundId, backgroundIntensityPct, chrome };
  if (wireOv) baseOut.wireframeColorOverride = wireOv;
  if (panelFv) baseOut.panelFillColorOverride = panelFv;
  if (primaryOv) {
    if (isChromaticPrimaryCandidate(primaryOv)) {
      baseOut.primaryColorOverride = primaryOv;
    } else if (!wireOv) {
      baseOut.wireframeColorOverride = primaryOv;
    }
  }
  if (shellOv) baseOut.shellFrameColorOverride = shellOv;
  if (backgroundId === "custom" && rawCustom.startsWith("data:image/")) {
    baseOut.customBackgroundArtDataUrl = rawCustom;
  }
  return baseOut;
}

function mergeAppearance(base: AppUiAppearance, ...patches: Partial<AppUiAppearance>[]): AppUiAppearance {
  let m: AppUiAppearance = { ...base };
  for (const p of patches) {
    m = { ...m, ...p };
  }
  return m;
}

function applyChromeToAppearance(a: AppUiAppearance, chrome: AppUiChromeSettings): AppUiAppearance {
  const lf = clamp(chrome.lineStrengthPct, 50, 150) / 100;
  const rf = clamp(chrome.radiusScalePct, 80, 130) / 100;
  const wf = Math.round(clamp(a.wireframeOpacityPct * lf, 22, 100));
  const scaleR = (px: number) => Math.max(6, Math.round(px * rf));
  return {
    ...a,
    wireframeOpacityPct: wf,
    radiusSmPx: scaleR(a.radiusSmPx),
    radiusMdPx: scaleR(a.radiusMdPx),
    radiusLgPx: scaleR(a.radiusLgPx),
    radiusXlPx: scaleR(a.radiusXlPx),
    radius2xlPx: scaleR(a.radius2xlPx),
    radius3xlPx: scaleR(a.radius3xlPx),
  };
}

/** 将用户 bundle 解析为完整 AppUiAppearance（供 applyAppearanceToDocument） */
export function resolveThemeBundleToAppearance(bundle: AppUiThemeBundle): AppUiAppearance {
  const b = normalizeUiThemeBundle(bundle);
  const base = normalizeUiAppearance(DEFAULT_UI_APPEARANCE);
  const pack = UI_THEME_PACKS[b.packId] ?? UI_THEME_PACKS.aurora;
  const pal = pack.palettes.find((p) => p.id === b.paletteId) ?? pack.palettes[0]!;
  const merged = mergeAppearance(base, pack.basePatch, pal.patch);
  let m = merged;
  const wf = b.wireframeColorOverride;
  const pf = b.panelFillColorOverride;
  const prOv = b.primaryColorOverride;
  if (wf && /^#[0-9a-fA-F]{6}$/.test(wf)) m = { ...m, wireframeColor: wf.toLowerCase() };
  if (pf && /^#[0-9a-fA-F]{6}$/.test(pf)) m = { ...m, panelFillColor: pf.toLowerCase() };
  if (prOv && /^#[0-9a-fA-F]{6}$/.test(prOv)) m = { ...m, primaryColor: prOv.toLowerCase() };

  const shellOverride = b.shellFrameColorOverride;
  const palShell = pal.patch.shellFrameColor;
  if (shellOverride && /^#[0-9a-fA-F]{6}$/.test(shellOverride)) {
    m = { ...m, shellFrameColor: shellOverride.toLowerCase() };
  } else if (typeof palShell === "string" && /^#[0-9a-fA-F]{6}$/i.test(palShell)) {
    m = { ...m, shellFrameColor: palShell.toLowerCase() };
  }

  const withChrome = applyChromeToAppearance(m, b.chrome);
  return normalizeUiAppearance(withChrome);
}

export function defaultPaletteIdForPack(packId: UiStylePackId): string {
  return UI_THEME_PACKS[packId].palettes[0]!.id;
}

/** 切换风格包时若当前 palette 不适用则回落到该包第一个配色 */
export function coerceBundleForPack(bundle: AppUiThemeBundle, nextPack: UiStylePackId): AppUiThemeBundle {
  const pack = UI_THEME_PACKS[nextPack];
  const raw = bundle.paletteId;
  const mapped = LEGACY_PALETTE_MAP[raw] ?? raw;
  const ok = pack.palettes.some((p) => p.id === mapped) ? mapped : pack.palettes.some((p) => p.id === raw) ? raw : null;
  const td = pack.applyOnPackSelect;
  const mergedChrome: AppUiChromeSettings = {
    ...DEFAULT_UI_THEME_BUNDLE.chrome,
    ...(td.chrome ?? {}),
  };
  return normalizeUiThemeBundle({
    packId: nextPack,
    paletteId: ok ?? pack.palettes[0]!.id,
    backgroundId: td.backgroundId,
    backgroundIntensityPct: td.backgroundIntensityPct,
    chrome: mergedChrome,
  });
}
