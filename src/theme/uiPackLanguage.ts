import type { AppThemeMode, AppUiChromeSettings, UiStylePackId } from "../types";

/**
 * 单套「设计语言」：与换色无关的版式、层级、毛玻璃与投影权重。
 * 数值在 apply 时与 chrome 滑块（圆角比例、线框强度、模糊基准）相乘。
 */
export type UiPackLanguage = {
  pagePadX: number;
  pagePadY: number;
  pageGap: number;
  headGap: number;
  kickerFs: number;
  titleRem: number;
  titleWeight: number;
  titleLsEm: number;
  titleMtPx: number;
  subFs: number;
  subLh: number;
  subMtPx: number;
  iconSize: number;
  iconFont: number;
  iconBlur: number;
  tabsGap: number;
  tabsPad: number;
  tabsRadius: number;
  tabsBgA: number;
  tabsBlur: number;
  tabsBorderA: number;
  tabPy: number;
  tabPx: number;
  tabRadius: number;
  tabFs: number;
  tabInactiveBgA: number;
  tabActiveGlowY: number;
  tabActiveGlowBlur: number;
  tabActiveGlowA: number;
  denseTabPy: number;
  denseTabPx: number;
  denseTabFs: number;
  stageRadius: number;
  stageBlur: number;
  stageBgA: number;
  stageBorderA: number;
  stageShY: number;
  stageShBlur: number;
  stageShA: number;
  /** 投影 rgb 三元组字符串，如 "0 0 0" 或 "15 23 42" */
  stageShRgb: string;
  pageGlowA: number;
  pageGlowB: number;
  pageLinearHeaderPct: number;
  segGap: number;
  segPad: number;
  segRadius: number;
  segBorderA: number;
  segBgA: number;
  segBtnPy: number;
  segBtnPx: number;
  segBtnFs: number;
  segActiveShadowY: number;
  segActiveShadowBlur: number;
  segActiveShadowA: number;
  folderPy: number;
  folderPx: number;
  folderFs: number;
  folderInsetW: number;
  matShY: number;
  matShBlur: number;
  matShA: number;
  matLiftPx: number;
  matHoverShBlur: number;
  matHoverShA: number;
  /** Tailwind 语义边框统一乘在 primary 上的 alpha */
  borderMix: number;
  ringMix: number;
  inputBorderMix: number;
  toolbarGap: number;
  primaryBtnPy: number;
  primaryBtnPx: number;
  primaryBtnFs: number;
  primaryBtnShadowY: number;
  primaryBtnShadowBlur: number;
  primaryBtnShadowA: number;
  /** pill = 胶囊轨道；underline = 截图式顶栏下划线选中 */
  tabChrome: "pill" | "underline";
  /**
   * ERP 顶栏右侧主模块（客户/库存/人事）相对常规 ui-tab 的放大倍率；与圆角/线宽滑块一起经 apply 写入 --ui-head-module-*。
   */
  headModuleTabScale: number;
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export const UI_PACK_LANGUAGE: Record<UiStylePackId, UiPackLanguage> = {
  aurora: {
    pagePadX: 16,
    pagePadY: 16,
    pageGap: 14,
    headGap: 12,
    kickerFs: 10,
    titleRem: 1.35,
    titleWeight: 700,
    titleLsEm: -0.03,
    titleMtPx: 4,
    subFs: 12,
    subLh: 1.45,
    subMtPx: 6,
    iconSize: 40,
    iconFont: 16,
    iconBlur: 16,
    tabsGap: 6,
    tabsPad: 6,
    tabsRadius: 20,
    tabsBgA: 0.52,
    tabsBlur: 18,
    tabsBorderA: 0.26,
    tabPy: 10,
    tabPx: 16,
    tabRadius: 14,
    tabFs: 13,
    tabInactiveBgA: 0.35,
    tabActiveGlowY: 8,
    tabActiveGlowBlur: 28,
    tabActiveGlowA: 0.28,
    denseTabPy: 8,
    denseTabPx: 12,
    denseTabFs: 12,
    stageRadius: 22,
    stageBlur: 22,
    stageBgA: 0.55,
    stageBorderA: 0.26,
    stageShY: 24,
    stageShBlur: 56,
    stageShA: 0.5,
    stageShRgb: "0 0 0",
    pageGlowA: 0.24,
    pageGlowB: 0.1,
    pageLinearHeaderPct: 88,
    segGap: 4,
    segPad: 3,
    segRadius: 14,
    segBorderA: 0.24,
    segBgA: 0.55,
    segBtnPy: 8,
    segBtnPx: 14,
    segBtnFs: 12,
    segActiveShadowY: 6,
    segActiveShadowBlur: 22,
    segActiveShadowA: 0.28,
    folderPy: 8,
    folderPx: 10,
    folderFs: 12,
    folderInsetW: 3,
    matShY: 14,
    matShBlur: 36,
    matShA: 0.55,
    matLiftPx: 2,
    matHoverShBlur: 48,
    matHoverShA: 0.62,
    borderMix: 0.34,
    ringMix: 0.32,
    inputBorderMix: 0.3,
    toolbarGap: 8,
    primaryBtnPy: 8,
    primaryBtnPx: 18,
    primaryBtnFs: 14,
    primaryBtnShadowY: 6,
    primaryBtnShadowBlur: 22,
    primaryBtnShadowA: 0.28,
    headModuleTabScale: 1.32,
    tabChrome: "underline",
  },
  crextio: {
    pagePadX: 22,
    pagePadY: 20,
    pageGap: 18,
    headGap: 14,
    kickerFs: 11,
    titleRem: 1.55,
    titleWeight: 650,
    titleLsEm: -0.04,
    titleMtPx: 6,
    subFs: 13,
    subLh: 1.5,
    subMtPx: 8,
    iconSize: 44,
    iconFont: 17,
    iconBlur: 22,
    tabsGap: 8,
    tabsPad: 8,
    tabsRadius: 26,
    tabsBgA: 0.62,
    tabsBlur: 28,
    tabsBorderA: 0.14,
    tabPy: 12,
    tabPx: 20,
    tabRadius: 18,
    tabFs: 14,
    tabInactiveBgA: 0.5,
    tabActiveGlowY: 10,
    tabActiveGlowBlur: 36,
    tabActiveGlowA: 0.12,
    denseTabPy: 10,
    denseTabPx: 14,
    denseTabFs: 13,
    stageRadius: 30,
    stageBlur: 36,
    stageBgA: 0.78,
    stageBorderA: 0.12,
    stageShY: 18,
    stageShBlur: 48,
    stageShA: 0.07,
    stageShRgb: "15 23 42",
    pageGlowA: 0.1,
    pageGlowB: 0.06,
    pageLinearHeaderPct: 92,
    segGap: 6,
    segPad: 4,
    segRadius: 18,
    segBorderA: 0.12,
    segBgA: 0.65,
    segBtnPy: 10,
    segBtnPx: 16,
    segBtnFs: 13,
    segActiveShadowY: 8,
    segActiveShadowBlur: 28,
    segActiveShadowA: 0.1,
    folderPy: 10,
    folderPx: 12,
    folderFs: 13,
    folderInsetW: 4,
    matShY: 12,
    matShBlur: 32,
    matShA: 0.08,
    matLiftPx: 3,
    matHoverShBlur: 44,
    matHoverShA: 0.1,
    borderMix: 0.2,
    ringMix: 0.22,
    inputBorderMix: 0.18,
    toolbarGap: 10,
    primaryBtnPy: 10,
    primaryBtnPx: 22,
    primaryBtnFs: 14,
    primaryBtnShadowY: 8,
    primaryBtnShadowBlur: 28,
    primaryBtnShadowA: 0.1,
    headModuleTabScale: 1.12,
    tabChrome: "pill",
  },
  quantix: {
    pagePadX: 18,
    pagePadY: 15,
    pageGap: 12,
    headGap: 10,
    kickerFs: 9,
    titleRem: 1.28,
    titleWeight: 720,
    titleLsEm: -0.025,
    titleMtPx: 3,
    subFs: 11,
    subLh: 1.4,
    subMtPx: 5,
    iconSize: 38,
    iconFont: 15,
    iconBlur: 14,
    tabsGap: 4,
    tabsPad: 5,
    tabsRadius: 14,
    tabsBgA: 0.48,
    tabsBlur: 14,
    tabsBorderA: 0.22,
    tabPy: 8,
    tabPx: 14,
    tabRadius: 10,
    tabFs: 12,
    tabInactiveBgA: 0.28,
    tabActiveGlowY: 6,
    tabActiveGlowBlur: 22,
    tabActiveGlowA: 0.32,
    denseTabPy: 6,
    denseTabPx: 10,
    denseTabFs: 11,
    stageRadius: 18,
    stageBlur: 18,
    stageBgA: 0.5,
    stageBorderA: 0.22,
    stageShY: 20,
    stageShBlur: 48,
    stageShA: 0.55,
    stageShRgb: "2 6 23",
    pageGlowA: 0.18,
    pageGlowB: 0.08,
    pageLinearHeaderPct: 82,
    segGap: 3,
    segPad: 2,
    segRadius: 12,
    segBorderA: 0.2,
    segBgA: 0.48,
    segBtnPy: 7,
    segBtnPx: 12,
    segBtnFs: 11,
    segActiveShadowY: 5,
    segActiveShadowBlur: 18,
    segActiveShadowA: 0.3,
    folderPy: 7,
    folderPx: 9,
    folderFs: 11,
    folderInsetW: 3,
    matShY: 12,
    matShBlur: 32,
    matShA: 0.52,
    matLiftPx: 1,
    matHoverShBlur: 40,
    matHoverShA: 0.58,
    borderMix: 0.3,
    ringMix: 0.28,
    inputBorderMix: 0.26,
    toolbarGap: 6,
    primaryBtnPy: 7,
    primaryBtnPx: 16,
    primaryBtnFs: 12,
    primaryBtnShadowY: 5,
    primaryBtnShadowBlur: 18,
    primaryBtnShadowA: 0.3,
    headModuleTabScale: 1.34,
    tabChrome: "underline",
  },
  fintrixity: {
    pagePadX: 12,
    pagePadY: 12,
    pageGap: 10,
    headGap: 8,
    kickerFs: 9,
    titleRem: 1.2,
    titleWeight: 800,
    titleLsEm: -0.02,
    titleMtPx: 2,
    subFs: 11,
    subLh: 1.35,
    subMtPx: 4,
    iconSize: 36,
    iconFont: 14,
    iconBlur: 10,
    tabsGap: 3,
    tabsPad: 4,
    tabsRadius: 10,
    tabsBgA: 0.72,
    tabsBlur: 10,
    tabsBorderA: 0.38,
    tabPy: 7,
    tabPx: 12,
    tabRadius: 7,
    tabFs: 12,
    tabInactiveBgA: 0.55,
    tabActiveGlowY: 4,
    tabActiveGlowBlur: 16,
    tabActiveGlowA: 0.45,
    denseTabPy: 6,
    denseTabPx: 9,
    denseTabFs: 11,
    stageRadius: 12,
    stageBlur: 12,
    stageBgA: 0.88,
    stageBorderA: 0.4,
    stageShY: 10,
    stageShBlur: 28,
    stageShA: 0.72,
    stageShRgb: "0 0 0",
    pageGlowA: 0.32,
    pageGlowB: 0.14,
    pageLinearHeaderPct: 76,
    segGap: 2,
    segPad: 2,
    segRadius: 10,
    segBorderA: 0.35,
    segBgA: 0.72,
    segBtnPy: 6,
    segBtnPx: 11,
    segBtnFs: 11,
    segActiveShadowY: 4,
    segActiveShadowBlur: 14,
    segActiveShadowA: 0.42,
    folderPy: 6,
    folderPx: 8,
    folderFs: 11,
    folderInsetW: 4,
    matShY: 8,
    matShBlur: 22,
    matShA: 0.68,
    matLiftPx: 1,
    matHoverShBlur: 28,
    matHoverShA: 0.75,
    borderMix: 0.42,
    ringMix: 0.38,
    inputBorderMix: 0.38,
    toolbarGap: 6,
    primaryBtnPy: 7,
    primaryBtnPx: 14,
    primaryBtnFs: 12,
    primaryBtnShadowY: 4,
    primaryBtnShadowBlur: 16,
    primaryBtnShadowA: 0.4,
    headModuleTabScale: 1.38,
    tabChrome: "underline",
  },
  sapphire: {
    pagePadX: 18,
    pagePadY: 17,
    pageGap: 15,
    headGap: 12,
    kickerFs: 10,
    titleRem: 1.42,
    titleWeight: 700,
    titleLsEm: -0.035,
    titleMtPx: 5,
    subFs: 12,
    subLh: 1.48,
    subMtPx: 7,
    iconSize: 42,
    iconFont: 16,
    iconBlur: 20,
    tabsGap: 6,
    tabsPad: 7,
    tabsRadius: 22,
    tabsBgA: 0.5,
    tabsBlur: 22,
    tabsBorderA: 0.28,
    tabPy: 10,
    tabPx: 17,
    tabRadius: 15,
    tabFs: 13,
    tabInactiveBgA: 0.32,
    tabActiveGlowY: 12,
    tabActiveGlowBlur: 40,
    tabActiveGlowA: 0.38,
    denseTabPy: 8,
    denseTabPx: 13,
    denseTabFs: 12,
    stageRadius: 28,
    stageBlur: 30,
    stageBgA: 0.52,
    stageBorderA: 0.3,
    stageShY: 32,
    stageShBlur: 72,
    stageShA: 0.58,
    stageShRgb: "10 5 24",
    pageGlowA: 0.3,
    pageGlowB: 0.16,
    pageLinearHeaderPct: 85,
    segGap: 4,
    segPad: 3,
    segRadius: 16,
    segBorderA: 0.28,
    segBgA: 0.52,
    segBtnPy: 8,
    segBtnPx: 15,
    segBtnFs: 12,
    segActiveShadowY: 8,
    segActiveShadowBlur: 30,
    segActiveShadowA: 0.35,
    folderPy: 8,
    folderPx: 10,
    folderFs: 12,
    folderInsetW: 3,
    matShY: 16,
    matShBlur: 44,
    matShA: 0.6,
    matLiftPx: 3,
    matHoverShBlur: 56,
    matHoverShA: 0.68,
    borderMix: 0.36,
    ringMix: 0.34,
    inputBorderMix: 0.32,
    toolbarGap: 8,
    primaryBtnPy: 9,
    primaryBtnPx: 20,
    primaryBtnFs: 14,
    primaryBtnShadowY: 8,
    primaryBtnShadowBlur: 30,
    primaryBtnShadowA: 0.35,
    headModuleTabScale: 1.28,
    tabChrome: "underline",
  },
};

function scale(n: number, factor: number, minPx?: number, maxPx?: number): number {
  let v = n * factor;
  if (minPx !== undefined) v = Math.max(minPx, v);
  if (maxPx !== undefined) v = Math.min(maxPx, v);
  return Math.round(v * 100) / 100;
}

/**
 * 将当前风格包 + chrome 滑块写入 --ui-*，供 uiKit.css 唯一消费。
 */
export function applyUiPackLanguage(packId: UiStylePackId, chrome: AppUiChromeSettings, mode: AppThemeMode): void {
  const base = UI_PACK_LANGUAGE[packId] ?? UI_PACK_LANGUAGE.aurora;
  const rf = clamp(chrome.radiusScalePct / 100, 0.8, 1.3);
  const lf = clamp(chrome.lineStrengthPct / 100, 0.5, 1.5);
  const bf = clamp(chrome.glassBlurPx / 26, 0.55, 1.45);
  /** 与设置页「面板玻璃底色」同滑块：0 = 主舞台/标签等大块玻璃底与模糊一并关到全透 */
  const panelTintT = clamp((chrome.panelFillAlphaScalePct ?? 100) / 100, 0, 1);

  const r = (px: number, min = 4, max = 48) => Math.round(scale(px, rf, min, max));
  const pxStr = (n: number) => `${Math.round(n)}px`;
  const titleRem = clamp(base.titleRem * rf, 0.92, 2.05);

  const borderMix = clamp(base.borderMix * lf, 0.12, 0.5);
  const ringMix = clamp(base.ringMix * lf, 0.12, 0.48);
  const inputMix = clamp(base.inputBorderMix * lf, 0.12, 0.48);

  const root = document.documentElement;

  root.style.setProperty("--ui-page-pad-x", pxStr(r(base.pagePadX, 8, 32)));
  root.style.setProperty("--ui-page-pad-y", pxStr(r(base.pagePadY, 8, 32)));
  root.style.setProperty("--ui-page-gap", pxStr(r(base.pageGap, 6, 28)));
  root.style.setProperty("--ui-head-gap", pxStr(r(base.headGap, 6, 20)));

  root.style.setProperty("--ui-kicker-fs", pxStr(Math.max(8, Math.round(base.kickerFs * rf))));
  root.style.setProperty("--ui-title-fs", `${titleRem.toFixed(2)}rem`);
  root.style.setProperty("--ui-title-weight", String(base.titleWeight));
  root.style.setProperty("--ui-title-ls", `${base.titleLsEm}em`);
  root.style.setProperty("--ui-title-mt", pxStr(base.titleMtPx));
  root.style.setProperty("--ui-sub-fs", pxStr(Math.max(10, Math.round(base.subFs * rf))));
  root.style.setProperty("--ui-sub-lh", String(base.subLh));
  root.style.setProperty("--ui-sub-mt", pxStr(base.subMtPx));

  root.style.setProperty("--ui-icon-size", pxStr(r(base.iconSize, 28, 52)));
  root.style.setProperty("--ui-icon-font", pxStr(Math.max(12, Math.round(base.iconFont * rf))));
  root.style.setProperty("--ui-icon-blur", pxStr(Math.round(base.iconBlur * bf * panelTintT)));

  root.style.setProperty("--ui-tabs-gap", pxStr(r(base.tabsGap, 2, 12)));
  root.style.setProperty("--ui-tabs-pad", pxStr(r(base.tabsPad, 2, 12)));
  root.style.setProperty("--ui-tabs-radius", pxStr(r(base.tabsRadius, 8, 36)));
  root.style.setProperty(
    "--ui-tabs-bg-a",
    String(clamp(base.tabsBgA * (mode === "light" ? 1.05 : 1) * panelTintT, 0, 0.95)),
  );
  root.style.setProperty("--ui-tabs-blur", pxStr(Math.round(base.tabsBlur * bf * panelTintT)));
  root.style.setProperty("--ui-tabs-border-a", String(clamp(base.tabsBorderA * lf, 0.06, 0.55)));

  root.style.setProperty("--ui-tab-py", pxStr(r(base.tabPy, 4, 18)));
  root.style.setProperty("--ui-tab-px", pxStr(r(base.tabPx, 8, 28)));
  root.style.setProperty("--ui-tab-radius", pxStr(r(base.tabRadius, 4, 26)));
  root.style.setProperty("--ui-tab-fs", pxStr(Math.max(10, Math.round(base.tabFs * rf))));
  root.style.setProperty(
    "--ui-tab-inactive-bg-a",
    String(clamp(base.tabInactiveBgA * panelTintT, 0, 0.75)),
  );

  root.style.setProperty("--ui-tab-active-glow-y", pxStr(r(base.tabActiveGlowY, 2, 16)));
  root.style.setProperty("--ui-tab-active-glow-blur", pxStr(r(base.tabActiveGlowBlur, 8, 48)));
  root.style.setProperty("--ui-tab-active-glow-a", String(clamp(base.tabActiveGlowA * (mode === "light" ? 1.15 : 1), 0.04, 0.5)));

  root.style.setProperty("--ui-dense-tab-py", pxStr(r(base.denseTabPy, 4, 14)));
  root.style.setProperty("--ui-dense-tab-px", pxStr(r(base.denseTabPx, 6, 22)));
  root.style.setProperty("--ui-dense-tab-fs", pxStr(Math.max(10, Math.round(base.denseTabFs * rf))));

  root.style.setProperty("--ui-stage-radius", pxStr(r(base.stageRadius, 8, 40)));
  root.style.setProperty("--ui-stage-blur", pxStr(Math.round(base.stageBlur * bf * panelTintT)));
  root.style.setProperty(
    "--ui-stage-bg-a",
    String(clamp(base.stageBgA * (mode === "light" ? 1.02 : 1) * panelTintT, 0, 0.95)),
  );
  root.style.setProperty("--ui-stage-border-a", String(clamp(base.stageBorderA * lf, 0.06, 0.55)));
  root.style.setProperty("--ui-stage-sh-y", pxStr(r(base.stageShY, 4, 48)));
  root.style.setProperty("--ui-stage-sh-blur", pxStr(r(base.stageShBlur, 12, 96)));
  root.style.setProperty("--ui-stage-sh-a", String(clamp(base.stageShA * (mode === "light" ? 0.85 : 1), 0.03, 0.85)));
  root.style.setProperty("--ui-stage-sh-rgb", base.stageShRgb);

  root.style.setProperty("--ui-page-glow-a", String(clamp(base.pageGlowA * lf, 0.04, 0.45)));
  root.style.setProperty("--ui-page-glow-b", String(clamp(base.pageGlowB * lf, 0.02, 0.35)));
  root.style.setProperty("--ui-page-linear-header-pct", `${Math.round(clamp(base.pageLinearHeaderPct, 60, 98))}%`);

  root.style.setProperty("--ui-seg-gap", pxStr(r(base.segGap, 2, 10)));
  root.style.setProperty("--ui-seg-pad", pxStr(r(base.segPad, 2, 8)));
  root.style.setProperty("--ui-seg-radius", pxStr(r(base.segRadius, 6, 24)));
  root.style.setProperty("--ui-seg-border-a", String(clamp(base.segBorderA * lf, 0.06, 0.5)));
  root.style.setProperty("--ui-seg-bg-a", String(clamp(base.segBgA * panelTintT, 0, 0.9)));
  root.style.setProperty("--ui-seg-btn-py", pxStr(r(base.segBtnPy, 4, 16)));
  root.style.setProperty("--ui-seg-btn-px", pxStr(r(base.segBtnPx, 8, 22)));
  root.style.setProperty("--ui-seg-btn-fs", pxStr(Math.max(10, Math.round(base.segBtnFs * rf))));
  root.style.setProperty("--ui-seg-active-sh-y", pxStr(r(base.segActiveShadowY, 2, 14)));
  root.style.setProperty("--ui-seg-active-sh-blur", pxStr(r(base.segActiveShadowBlur, 8, 36)));
  root.style.setProperty("--ui-seg-active-sh-a", String(clamp(base.segActiveShadowA, 0.04, 0.5)));

  root.style.setProperty("--ui-folder-py", pxStr(r(base.folderPy, 4, 14)));
  root.style.setProperty("--ui-folder-px", pxStr(r(base.folderPx, 6, 18)));
  root.style.setProperty("--ui-folder-fs", pxStr(Math.max(10, Math.round(base.folderFs * rf))));
  root.style.setProperty("--ui-folder-inset-w", pxStr(r(base.folderInsetW, 2, 6)));

  root.style.setProperty("--ui-mat-sh-y", pxStr(r(base.matShY, 4, 28)));
  root.style.setProperty("--ui-mat-sh-blur", pxStr(r(base.matShBlur, 12, 64)));
  root.style.setProperty("--ui-mat-sh-a", String(clamp(base.matShA, 0.04, 0.85)));
  root.style.setProperty("--ui-mat-lift", pxStr(r(base.matLiftPx, 0, 6)));
  root.style.setProperty("--ui-mat-hover-sh-blur", pxStr(r(base.matHoverShBlur, 16, 72)));
  root.style.setProperty("--ui-mat-hover-sh-a", String(clamp(base.matHoverShA, 0.05, 0.9)));

  root.style.setProperty("--ui-border-mix", String(borderMix));
  root.style.setProperty("--ui-ring-mix", String(ringMix));
  root.style.setProperty("--ui-input-border-mix", String(inputMix));

  root.style.setProperty("--ui-toolbar-gap", pxStr(r(base.toolbarGap, 4, 16)));

  root.style.setProperty("--ui-primary-btn-py", pxStr(r(base.primaryBtnPy, 6, 14)));
  root.style.setProperty("--ui-primary-btn-px", pxStr(r(base.primaryBtnPx, 12, 28)));
  root.style.setProperty("--ui-primary-btn-fs", pxStr(Math.max(11, Math.round(base.primaryBtnFs * rf))));
  root.style.setProperty("--ui-primary-btn-sh-y", pxStr(r(base.primaryBtnShadowY, 2, 14)));
  root.style.setProperty("--ui-primary-btn-sh-blur", pxStr(r(base.primaryBtnShadowBlur, 8, 36)));
  root.style.setProperty("--ui-primary-btn-sh-a", String(clamp(base.primaryBtnShadowA, 0.04, 0.45)));

  const headModScale = clamp(base.headModuleTabScale, 1, 1.65);
  const headRadiusBoost = clamp(headModScale, 1, 1.22);
  root.style.setProperty("--ui-head-module-tabs-gap", pxStr(r(base.tabsGap * headModScale, 3, 14)));
  root.style.setProperty("--ui-head-module-tabs-pad", pxStr(r(base.tabsPad * headModScale, 4, 14)));
  root.style.setProperty("--ui-head-module-tabs-radius", pxStr(r(base.tabsRadius * headRadiusBoost, 10, 44)));
  root.style.setProperty("--ui-head-module-tab-py", pxStr(r(base.tabPy * headModScale, 6, 24)));
  root.style.setProperty("--ui-head-module-tab-px", pxStr(r(base.tabPx * headModScale, 10, 34)));
  root.style.setProperty("--ui-head-module-tab-radius", pxStr(r(base.tabRadius * headRadiusBoost, 6, 32)));
  root.style.setProperty(
    "--ui-head-module-tab-fs",
    pxStr(Math.max(11, Math.round(base.tabFs * rf * headModScale))),
  );
  root.style.setProperty("--ui-head-module-tab-glow-y", pxStr(r(base.tabActiveGlowY * headModScale, 3, 18)));
  root.style.setProperty("--ui-head-module-tab-glow-blur", pxStr(r(base.tabActiveGlowBlur * headModScale, 10, 56)));

  root.dataset.uiPack = packId;
  root.dataset.uiTabStyle = base.tabChrome;
}
