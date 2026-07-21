import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useT } from "../i18n/useT";
import { useQuoteStore } from "../store/quoteStore";
import type { QuotePdfCoverDecor } from "../types";
import { DEFAULT_UI_APPEARANCE } from "../theme/applyAppearance";
import { DEFAULT_QUOTE_PDF_EXPORT_STYLE } from "../theme/quotePdfStyle";

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

function ColorHexRow(props: {
  label: string;
  value: string;
  draft: string;
  setDraft: (v: string) => void;
  onPick: (hex: string) => void;
  onCommit: () => void;
}) {
  const { label, value, draft, setDraft, onPick, onCommit } = props;
  return (
    <label className="flex flex-col gap-2 text-xs text-app-muted">
      {label}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onPick(e.target.value)}
          className="h-9 w-14 cursor-pointer rounded border border-app-input-border bg-app-input-bg"
        />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onCommit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="min-w-0 flex-1 rounded-lg border border-app-input-border bg-app-input-bg px-2 py-1.5 font-mono text-sm text-app-text"
          spellCheck={false}
        />
      </div>
    </label>
  );
}

function Fold(props: { id: string; title: string; hint?: string; defaultOpen?: boolean; children: ReactNode }) {
  const { id, title, hint, defaultOpen, children } = props;
  return (
    <details
      open={defaultOpen}
      id={id}
      className="group rounded-lg border border-app-line-subtle bg-app-surface-2/35"
    >
      <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-app-text marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="mr-1 inline-block text-app-muted transition group-open:rotate-90">›</span>
        {title}
      </summary>
      {hint ? <p className="px-3 pb-1 text-xs text-app-muted">{hint}</p> : null}
      <div className="space-y-4 border-t border-app-divider px-3 py-3">{children}</div>
    </details>
  );
}

/** 设置：地图画布深浅 + 报价 PDF 导出配色（全局界面主题在上方「界面主题」区块） */
export function PdfMapSettingsSection() {
  const t = useT();
  const mapTheme = useQuoteStore((s) => s.mapTheme);
  const setMapTheme = useQuoteStore((s) => s.setMapTheme);
  const quotePdfExportStyle = useQuoteStore((s) => s.quotePdfExportStyle);
  const patchQuotePdfExportStyle = useQuoteStore((s) => s.patchQuotePdfExportStyle);

  const [pdfAccentDraft, setPdfAccentDraft] = useState(quotePdfExportStyle.accentColor);
  const [pdfMutedDraft, setPdfMutedDraft] = useState(quotePdfExportStyle.mutedColor);
  const [pdfHeadDraft, setPdfHeadDraft] = useState(quotePdfExportStyle.tableHeaderFill);
  const [pdfGridDraft, setPdfGridDraft] = useState(quotePdfExportStyle.tableGridColor);
  const [pdfBannerDraft, setPdfBannerDraft] = useState(quotePdfExportStyle.hardwareBannerFill);

  useEffect(() => {
    setPdfAccentDraft(quotePdfExportStyle.accentColor);
    setPdfMutedDraft(quotePdfExportStyle.mutedColor);
    setPdfHeadDraft(quotePdfExportStyle.tableHeaderFill);
    setPdfGridDraft(quotePdfExportStyle.tableGridColor);
    setPdfBannerDraft(quotePdfExportStyle.hardwareBannerFill);
  }, [quotePdfExportStyle]);

  const commitPdfHex = useCallback(
    (field: keyof typeof quotePdfExportStyle, draft: string, setDraft: (s: string) => void, fallback: string) => {
      const v = draft.trim();
      if (HEX6.test(v)) patchQuotePdfExportStyle({ [field]: v.toLowerCase() } as Record<string, string>);
      else setDraft(fallback);
    },
    [patchQuotePdfExportStyle],
  );

  return (
    <section className="rounded-xl border border-app-panel-border bg-app-panel-bg p-4">
      <h3 className="text-sm font-semibold text-app-text">{t("st.exportSectionTitle")}</h3>
      <div className="mt-4 space-y-3">
        <Fold id="set-map" title={t("ap.cat.map")} hint={t("ap.cat.mapHint")} defaultOpen>
          <div className="flex flex-wrap gap-2">
            {(["dark", "light"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMapTheme(m)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  mapTheme === m
                    ? "bg-app-primary text-app-on-primary hover:bg-app-primary-hover"
                    : "border border-app-wire text-app-muted hover:bg-app-surface-2"
                }`}
              >
                {m === "dark" ? t("ap.map.dark") : t("ap.map.light")}
              </button>
            ))}
          </div>
        </Fold>

        <Fold id="set-pdf" title={t("ap.cat.pdf")} hint={t("ap.cat.pdfHint")} defaultOpen>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex flex-col gap-1 text-xs text-app-muted">
              {t("ap.pdf.coverDecor")}
              <select
                value={quotePdfExportStyle.coverDecor}
                onChange={(e) => patchQuotePdfExportStyle({ coverDecor: e.target.value as QuotePdfCoverDecor })}
                className="rounded-lg border border-app-wire bg-app-surface-2 px-2 py-1.5 text-sm text-app-text"
              >
                {(["topBar", "frame", "none"] as const).map((k) => (
                  <option key={k} value={k}>
                    {t(`ap.cover.${k}`)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="self-end rounded-lg border border-app-wire px-3 py-2 text-xs text-app-muted hover:bg-app-surface-2"
              onClick={() => patchQuotePdfExportStyle({ ...DEFAULT_QUOTE_PDF_EXPORT_STYLE })}
            >
              {t("ap.pdf.reset")}
            </button>
            <button
              type="button"
              className="self-end rounded-lg border border-app-wire px-3 py-2 text-xs text-app-muted hover:bg-app-surface-2"
              onClick={() =>
                patchQuotePdfExportStyle({ accentColor: DEFAULT_UI_APPEARANCE.primaryColor })
              }
            >
              {t("ap.pdf.syncPrimary")}
            </button>
          </div>
          <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
            <ColorHexRow
              label={t("ap.label.pdfAccent")}
              value={quotePdfExportStyle.accentColor}
              draft={pdfAccentDraft}
              setDraft={setPdfAccentDraft}
              onPick={(h) => patchQuotePdfExportStyle({ accentColor: h })}
              onCommit={() =>
                commitPdfHex("accentColor", pdfAccentDraft, setPdfAccentDraft, quotePdfExportStyle.accentColor)
              }
            />
            <ColorHexRow
              label={t("ap.label.pdfMuted")}
              value={quotePdfExportStyle.mutedColor}
              draft={pdfMutedDraft}
              setDraft={setPdfMutedDraft}
              onPick={(h) => patchQuotePdfExportStyle({ mutedColor: h })}
              onCommit={() =>
                commitPdfHex("mutedColor", pdfMutedDraft, setPdfMutedDraft, quotePdfExportStyle.mutedColor)
              }
            />
            <ColorHexRow
              label={t("ap.label.pdfTableHead")}
              value={quotePdfExportStyle.tableHeaderFill}
              draft={pdfHeadDraft}
              setDraft={setPdfHeadDraft}
              onPick={(h) => patchQuotePdfExportStyle({ tableHeaderFill: h })}
              onCommit={() =>
                commitPdfHex("tableHeaderFill", pdfHeadDraft, setPdfHeadDraft, quotePdfExportStyle.tableHeaderFill)
              }
            />
            <ColorHexRow
              label={t("ap.label.pdfGrid")}
              value={quotePdfExportStyle.tableGridColor}
              draft={pdfGridDraft}
              setDraft={setPdfGridDraft}
              onPick={(h) => patchQuotePdfExportStyle({ tableGridColor: h })}
              onCommit={() =>
                commitPdfHex("tableGridColor", pdfGridDraft, setPdfGridDraft, quotePdfExportStyle.tableGridColor)
              }
            />
            <ColorHexRow
              label={t("ap.label.pdfHwBar")}
              value={quotePdfExportStyle.hardwareBannerFill}
              draft={pdfBannerDraft}
              setDraft={setPdfBannerDraft}
              onPick={(h) => patchQuotePdfExportStyle({ hardwareBannerFill: h })}
              onCommit={() =>
                commitPdfHex(
                  "hardwareBannerFill",
                  pdfBannerDraft,
                  setPdfBannerDraft,
                  quotePdfExportStyle.hardwareBannerFill,
                )
              }
            />
          </div>
        </Fold>
      </div>
    </section>
  );
}
