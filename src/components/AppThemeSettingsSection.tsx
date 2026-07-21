import { useEffect, useState } from "react";
import type { AppUiBackgroundId, UiStylePackId } from "../types";
import { useT } from "../i18n/useT";
import { useQuoteStore } from "../store/quoteStore";
import { compressImageFileToJpegDataUrl } from "../theme/compressImageToDataUrl";
import {
  UI_THEME_PACKS,
  coerceBundleForPack,
  DEFAULT_UI_THEME_BUNDLE,
  backgroundArtUrl,
  isChromaticPrimaryCandidate,
  resolveThemeBundleToAppearance,
} from "../theme/uiThemePresets";
import { PhotoUploadModal } from "./PhotoUploadModal";

const PACK_ORDER: UiStylePackId[] = ["aurora", "crextio", "quantix", "fintrixity", "sapphire"];

/** 仅改主色 hex，不替换整套 palette 的底纹与文字 */
const EXTRA_PRIMARY_HEXES = [
  "#10b981",
  "#14b8a6",
  "#22d3ee",
  "#eab308",
  "#f43f5e",
  "#a855f7",
  "#84cc16",
  "#ec4899",
];

const BG_ORDER: AppUiBackgroundId[] = [
  "none",
  "violetBloom",
  "amberHaze",
  "cyanDrift",
  "indigoWell",
  "meshNoir",
  "custom",
];

export function AppThemeSettingsSection() {
  const t = useT();
  const bundle = useQuoteStore((s) => s.uiThemeBundle);
  const setUiThemeBundle = useQuoteStore((s) => s.setUiThemeBundle);
  const [bgModalOpen, setBgModalOpen] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);

  const pack = UI_THEME_PACKS[bundle.packId];
  const palettes = pack.palettes;
  const appearance = resolveThemeBundleToAppearance(bundle);
  const primaryCustom = Boolean(bundle.primaryColorOverride);
  const shellFrameCustom = Boolean(bundle.shellFrameColorOverride);
  const [primaryHexDraft, setPrimaryHexDraft] = useState(appearance.primaryColor);
  const [shellFrameHexDraft, setShellFrameHexDraft] = useState(appearance.shellFrameColor);
  useEffect(() => {
    setPrimaryHexDraft(appearance.primaryColor);
  }, [appearance.primaryColor]);
  useEffect(() => {
    setShellFrameHexDraft(appearance.shellFrameColor);
  }, [appearance.shellFrameColor]);

  return (
    <section className="rounded-xl border border-app-panel-border bg-app-panel-bg p-4">
      <h3 className="text-sm font-semibold text-app-text">{t("theme.sectionTitle")}</h3>

      <div className="mt-4 space-y-5">
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-app-muted">{t("theme.packs")}</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PACK_ORDER.map((id) => {
              const meta = UI_THEME_PACKS[id];
              const on = bundle.packId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    const next = coerceBundleForPack(bundle, id);
                    setUiThemeBundle({
                      packId: next.packId,
                      paletteId: next.paletteId,
                      backgroundId: next.backgroundId,
                      backgroundIntensityPct: next.backgroundIntensityPct,
                      chrome: next.chrome,
                      wireframeColorOverride: null,
                      panelFillColorOverride: null,
                      primaryColorOverride: null,
                      shellFrameColorOverride: null,
                    });
                  }}
                  className={`flex flex-col overflow-hidden rounded-xl text-left transition ${
                    on
                      ? "border-2 border-app-primary bg-app-primary-soft shadow-[0_8px_32px_rgb(var(--app-primary-rgb)/0.22)] ring-2 ring-app-primary/40"
                      : "border border-app-line-mid bg-app-surface-2/40 hover:border-app-line-strong hover:bg-app-surface-2/70"
                  }`}
                >
                  <div
                    className="h-14 w-full shrink-0"
                    style={{
                      background:
                        id === "crextio"
                          ? "linear-gradient(135deg,#e8f1fb,#cfe2f8)"
                          : id === "fintrixity"
                            ? "linear-gradient(135deg,#1a0a04,#ff4d00)"
                            : id === "quantix"
                              ? "linear-gradient(135deg,#07080d,#312e81)"
                              : id === "sapphire"
                                ? "linear-gradient(135deg,#0a0612,#7c3aed)"
                                : "linear-gradient(135deg,#0d1017,#7c6cf0)",
                    }}
                    aria-hidden
                  />
                  <div className="space-y-0.5 px-3 py-2">
                    <div className="text-xs font-semibold text-app-text">{t(meta.labelKey)}</div>
                    <div className="text-[11px] leading-snug text-app-muted">{t(meta.hintKey)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-app-muted">{t("theme.palettes")}</div>
          <div className="flex flex-wrap gap-2">
            {palettes.map((p) => {
              const on = bundle.paletteId === p.id && !primaryCustom;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setUiThemeBundle({ paletteId: p.id, primaryColorOverride: null, shellFrameColorOverride: null })
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    on
                      ? "border-2 border-app-on-primary/35 bg-app-primary text-app-on-primary shadow-[0_6px_22px_rgb(var(--app-primary-rgb)/0.28)] ring-2 ring-app-primary/45"
                      : "border border-app-wire text-app-muted hover:border-app-line-strong hover:bg-app-surface-2/80 hover:text-app-text"
                  }`}
                >
                  {t(p.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-app-muted">{t("theme.structColorsTitle")}</div>
          <p className="mb-2 text-[11px] leading-snug text-app-subtle">{t("theme.structColorsHint")}</p>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <div className="flex min-w-[10rem] flex-col gap-1.5">
              <span className="text-xs font-medium text-app-muted">{t("theme.structWireframe")}</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  aria-label={t("theme.structWireframe")}
                  value={appearance.wireframeColor}
                  onChange={(e) => setUiThemeBundle({ wireframeColorOverride: e.target.value })}
                  className="h-9 w-14 cursor-pointer rounded border border-app-line-mid bg-app-surface-2 p-0.5"
                />
                <button
                  type="button"
                  className="rounded-lg border border-app-wire px-2 py-1.5 text-[11px] text-app-muted hover:bg-app-surface-2"
                  onClick={() => setUiThemeBundle({ wireframeColorOverride: null })}
                >
                  {t("theme.structUsePalette")}
                </button>
              </div>
            </div>
            <div className="flex min-w-[10rem] flex-col gap-1.5">
              <span className="text-xs font-medium text-app-muted">{t("theme.structPanelFill")}</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  aria-label={t("theme.structPanelFill")}
                  value={appearance.panelFillColor}
                  onChange={(e) => setUiThemeBundle({ panelFillColorOverride: e.target.value })}
                  className="h-9 w-14 cursor-pointer rounded border border-app-line-mid bg-app-surface-2 p-0.5"
                />
                <button
                  type="button"
                  className="rounded-lg border border-app-wire px-2 py-1.5 text-[11px] text-app-muted hover:bg-app-surface-2"
                  onClick={() => setUiThemeBundle({ panelFillColorOverride: null })}
                >
                  {t("theme.structUsePalette")}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-app-muted">
            {t("theme.shellFrame.title")}
          </div>
          <p className="mb-3 text-[11px] leading-snug text-app-subtle">{t("theme.shellFrame.hint")}</p>
          <div className="flex flex-wrap items-center gap-4">
            <div
              className="h-12 w-12 shrink-0 rounded-xl border-2 border-app-line-strong shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
              style={{ backgroundColor: appearance.shellFrameColor }}
              aria-hidden
            />
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  aria-label={t("theme.shellFrame.title")}
                  value={appearance.shellFrameColor}
                  onChange={(e) => setUiThemeBundle({ shellFrameColorOverride: e.target.value })}
                  className="h-9 w-14 cursor-pointer rounded border border-app-line-mid bg-app-surface-2 p-0.5"
                />
                <input
                  type="text"
                  spellCheck={false}
                  value={shellFrameHexDraft}
                  onChange={(e) => setShellFrameHexDraft(e.target.value)}
                  onBlur={() => {
                    const v = shellFrameHexDraft.trim();
                    if (/^#[0-9a-fA-F]{6}$/i.test(v)) {
                      setUiThemeBundle({ shellFrameColorOverride: v.toLowerCase() });
                    } else {
                      setShellFrameHexDraft(appearance.shellFrameColor);
                    }
                  }}
                  className="w-[7.5rem] rounded-lg border border-app-line-mid bg-app-surface-2 px-2 py-1.5 font-mono text-xs text-app-text"
                  placeholder="#5a6d94"
                />
                <button
                  type="button"
                  className="rounded-lg border border-app-wire px-2 py-1.5 text-[11px] text-app-muted hover:bg-app-surface-2"
                  onClick={() => setUiThemeBundle({ shellFrameColorOverride: null })}
                >
                  {t("theme.shellFrame.matchPalette")}
                </button>
              </div>
              <div className="font-mono text-[10px] text-app-muted">
                {appearance.shellFrameColor}
                {shellFrameCustom ? ` · ${t("theme.shellFrame.customBadge")}` : ""}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-app-muted">{t("theme.primary.title")}</div>
          <p className="mb-3 text-[11px] leading-snug text-app-subtle">{t("theme.primary.hint")}</p>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex flex-wrap items-center gap-4">
              <div
                className="h-16 w-16 shrink-0 rounded-xl border-2 border-app-line-strong shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
                style={{ backgroundColor: appearance.primaryColor }}
                aria-hidden
              />
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="color"
                    aria-label={t("theme.primary.title")}
                    value={appearance.primaryColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (isChromaticPrimaryCandidate(v)) {
                        setUiThemeBundle({ primaryColorOverride: v });
                      } else {
                        setUiThemeBundle({ wireframeColorOverride: v, primaryColorOverride: null });
                      }
                    }}
                    className="h-9 w-14 cursor-pointer rounded border border-app-line-mid bg-app-surface-2 p-0.5"
                  />
                  <input
                    type="text"
                    spellCheck={false}
                    value={primaryHexDraft}
                    onChange={(e) => setPrimaryHexDraft(e.target.value)}
                    onBlur={() => {
                      const v = primaryHexDraft.trim();
                      if (/^#[0-9a-fA-F]{6}$/i.test(v)) {
                        const low = v.toLowerCase();
                        if (isChromaticPrimaryCandidate(low)) {
                          setUiThemeBundle({ primaryColorOverride: low });
                        } else {
                          setUiThemeBundle({ wireframeColorOverride: low, primaryColorOverride: null });
                        }
                      } else {
                        setPrimaryHexDraft(appearance.primaryColor);
                      }
                    }}
                    className="w-[7.5rem] rounded-lg border border-app-line-mid bg-app-surface-2 px-2 py-1.5 font-mono text-xs text-app-text"
                    placeholder={t("theme.primary.hexPlaceholder")}
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-app-wire px-2 py-1.5 text-[11px] text-app-muted hover:bg-app-surface-2"
                    onClick={() => setUiThemeBundle({ primaryColorOverride: null })}
                  >
                    {t("theme.primary.matchPalette")}
                  </button>
                </div>
                <div className="font-mono text-[10px] text-app-muted">{appearance.primaryColor}</div>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-app-muted">
                {t("theme.primary.moreSwatches")}
              </div>
              <div className="flex flex-wrap gap-2">
                {EXTRA_PRIMARY_HEXES.map((hex) => {
                  const active = bundle.primaryColorOverride?.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      title={hex}
                      onClick={() => setUiThemeBundle({ primaryColorOverride: hex })}
                      className={`h-9 w-9 rounded-full border-2 transition ${
                        active
                          ? "border-app-primary ring-2 ring-app-primary/50"
                          : "border-app-line-mid hover:border-app-line-strong"
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-app-muted">{t("theme.backgrounds")}</div>
          <PhotoUploadModal
            open={bgModalOpen}
            onClose={() => setBgModalOpen(false)}
            title={t("theme.bg.upload")}
            description={t("theme.bg.uploadHint")}
            accept="image/*"
            showAiOption={false}
            busy={uploadBusy}
            onConfirmFiles={async (files) => {
              const f = files[0];
              if (!f) return;
              setUploadBusy(true);
              try {
                const dataUrl = await compressImageFileToJpegDataUrl(f, 1440, 0.82);
                setUiThemeBundle({ backgroundId: "custom", customBackgroundArtDataUrl: dataUrl });
              } catch (e) {
                throw e instanceof Error ? e : new Error(t("photo.fail"));
              } finally {
                setUploadBusy(false);
              }
            }}
          />
          <div className="flex flex-wrap gap-2">
            {BG_ORDER.map((id) => {
              const on = bundle.backgroundId === id;
              const url =
                id === "custom"
                  ? bundle.customBackgroundArtDataUrl && bundle.backgroundId === "custom"
                    ? bundle.customBackgroundArtDataUrl
                    : null
                  : backgroundArtUrl(id);
              return (
                <button
                  key={id}
                  type="button"
                  disabled={uploadBusy && id === "custom"}
                  onClick={() => {
                    if (id === "custom") {
                      setBgModalOpen(true);
                      return;
                    }
                    setUiThemeBundle({ backgroundId: id, customBackgroundArtDataUrl: null });
                  }}
                  className={`flex h-16 w-[4.5rem] flex-col overflow-hidden rounded-lg transition ${
                    on
                      ? "border-2 border-app-primary shadow-[0_4px_20px_rgb(var(--app-primary-rgb)/0.25)] ring-2 ring-app-primary/45"
                      : "border border-app-line-mid hover:border-app-line-strong"
                  }`}
                  title={id === "custom" ? t("theme.bg.upload") : t(`theme.bg.${id}`)}
                >
                  <div className="relative min-h-0 flex-1 w-full bg-app-surface-2">
                    {url ? (
                      <img src={url} alt="" className="h-full w-full object-cover opacity-90" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] leading-tight text-app-subtle">
                        {id === "custom" ? t("theme.bg.upload") : "—"}
                      </div>
                    )}
                  </div>
                  <span className="truncate bg-app-surface/90 px-1 py-0.5 text-center text-[9px] font-medium text-app-muted">
                    {t(`theme.bg.${id}`)}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[10px] text-app-muted">{t("theme.bg.uploadHint")}</p>
          {bundle.backgroundId !== "none" ? (
            <label className="mt-3 flex flex-col gap-1 text-xs text-app-muted">
              {t("theme.bgIntensity")}
              <input
                type="range"
                min={0}
                max={100}
                value={bundle.backgroundIntensityPct}
                onChange={(e) => setUiThemeBundle({ backgroundIntensityPct: Number(e.target.value) })}
                className="w-full max-w-xs accent-app-primary"
              />
            </label>
          ) : null}
        </div>

        <div className="rounded-lg border border-app-line-subtle bg-app-surface-2/30 p-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-app-muted">{t("theme.chrome")}</div>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setUiThemeBundle({ chrome: { ...bundle.chrome, effect: "glass" } })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                bundle.chrome.effect === "glass"
                  ? "border-2 border-app-primary bg-app-primary-soft text-app-tone shadow-sm ring-2 ring-app-primary/35"
                  : "border border-app-wire text-app-muted hover:bg-app-surface-2/80"
              }`}
            >
              {t("theme.chromeGlass")}
            </button>
            <button
              type="button"
              onClick={() => setUiThemeBundle({ chrome: { ...bundle.chrome, effect: "none" } })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                bundle.chrome.effect === "none"
                  ? "border-2 border-app-primary bg-app-primary-soft text-app-tone shadow-sm ring-2 ring-app-primary/35"
                  : "border border-app-wire text-app-muted hover:bg-app-surface-2/80"
              }`}
            >
              {t("theme.chromeNone")}
            </button>
          </div>
          <div className="grid gap-3 sm:max-w-lg">
            <label className="flex flex-col gap-1 text-xs text-app-muted">
              {t("theme.blur")}
              <input
                type="range"
                min={12}
                max={40}
                value={bundle.chrome.glassBlurPx}
                onChange={(e) => setUiThemeBundle({ chrome: { ...bundle.chrome, glassBlurPx: Number(e.target.value) } })}
                className="accent-app-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-app-muted">
              {t("theme.panelGlassAlphaScale")}
              <input
                type="range"
                min={0}
                max={100}
                value={bundle.chrome.panelFillAlphaScalePct}
                onChange={(e) =>
                  setUiThemeBundle({ chrome: { ...bundle.chrome, panelFillAlphaScalePct: Number(e.target.value) } })
                }
                className="accent-app-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-app-muted">
              {t("theme.lineStrength")}
              <input
                type="range"
                min={50}
                max={150}
                value={bundle.chrome.lineStrengthPct}
                onChange={(e) =>
                  setUiThemeBundle({ chrome: { ...bundle.chrome, lineStrengthPct: Number(e.target.value) } })
                }
                className="accent-app-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-app-muted">
              {t("theme.radiusScale")}
              <input
                type="range"
                min={80}
                max={130}
                value={bundle.chrome.radiusScalePct}
                onChange={(e) =>
                  setUiThemeBundle({ chrome: { ...bundle.chrome, radiusScalePct: Number(e.target.value) } })
                }
                className="accent-app-primary"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setUiThemeBundle({
                ...DEFAULT_UI_THEME_BUNDLE,
                wireframeColorOverride: null,
                panelFillColorOverride: null,
                primaryColorOverride: null,
                shellFrameColorOverride: null,
                customBackgroundArtDataUrl: null,
              })
            }
            className="rounded-lg border border-app-wire px-3 py-2 text-xs text-app-muted hover:bg-app-surface-2"
          >
            {t("theme.reset")}
          </button>
          <p className="text-[11px] text-app-subtle">{t("theme.persistHint")}</p>
        </div>
      </div>
    </section>
  );
}
