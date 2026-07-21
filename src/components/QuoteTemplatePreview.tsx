import { useMemo, type CSSProperties } from "react";
import { useT } from "../i18n/useT";
import { useQuoteStore } from "../store/quoteStore";
import type { MaterialPage, QuoteTemplateBlock, QuoteTemplateTableColumn } from "../types";

const PREVIEW_TABLE_COLS: QuoteTemplateTableColumn[] = ["model", "qty", "price", "notes"];

const COL_LABEL: Record<QuoteTemplateTableColumn, string> = {
  model: "er.col.model",
  qty: "er.col.qty",
  price: "er.col.price",
  notes: "er.col.notes",
};

const MOCK_ROWS = [
  { model: "Demo IP camera", qty: 2, price: "$198.00", notes: "Outdoor" },
  { model: "NVR 8-channel", qty: 1, price: "$520.00", notes: "" },
];

function materialPreviewUrl(m: MaterialPage | undefined): string | null {
  if (!m?.dataUrl || typeof m.dataUrl !== "string") return null;
  return m.dataUrl;
}

function blockStyleCss(style: QuoteTemplateBlock["style"]): CSSProperties {
  if (!style) return {};
  return {
    color: style.color,
    fontSize: style.fontSizePx != null ? `${style.fontSizePx}px` : undefined,
    fontWeight: style.fontWeight,
    textAlign: style.textAlign,
  };
}

/** 报价/发票版式模板画布预览（与 PDF 逻辑无关的示意） */
export function QuoteTemplatePreview({ blocks }: { blocks: QuoteTemplateBlock[] }) {
  const t = useT();
  const companyLogoDataUrl = useQuoteStore((s) => s.companyLogoDataUrl);
  const companyName = useQuoteStore((s) => s.companyName);
  const companyTagline = useQuoteStore((s) => s.companyTagline);
  const companyAddress = useQuoteStore((s) => s.companyAddress);
  const companyPhone = useQuoteStore((s) => s.companyPhone);
  const companyEmail = useQuoteStore((s) => s.companyEmail);
  const companyWebsite = useQuoteStore((s) => s.companyWebsite);
  const materials = useQuoteStore((s) => s.materials);
  const matById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  return (
    <div className="mx-auto w-full max-w-[620px] min-w-[320px]">
      <div className="aspect-[210/297] rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm">
        <div className="space-y-3 text-[12px]">
          {blocks.map((b) => {
            const sx = blockStyleCss(b.style);
            switch (b.kind) {
              case "co.logo": {
                const wPct = Math.round((b.style?.imageWidthFrac ?? 0.24) * 100);
                return (
                  <div key={b.id} style={sx}>
                    {companyLogoDataUrl ? (
                      <div className="inline-block max-w-full" style={{ width: `${wPct}%` }}>
                        <img src={companyLogoDataUrl} alt="" className="w-full object-contain" />
                      </div>
                    ) : (
                      <div className="flex h-14 w-28 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400">
                        Logo
                      </div>
                    )}
                  </div>
                );
              }
              case "co.name":
                return (
                  <div key={b.id} style={sx}>
                    {companyName.trim() || "— Company name —"}
                  </div>
                );
              case "co.tagline":
                return (
                  <div key={b.id} style={sx}>
                    {companyTagline.trim() || "— Tagline —"}
                  </div>
                );
              case "co.contact":
                return (
                  <div key={b.id} className="whitespace-pre-line" style={sx}>
                    {[companyAddress, companyPhone, companyEmail, companyWebsite].filter(Boolean).join("\n") ||
                      "— Address / phone / email —"}
                  </div>
                );
              case "q.title":
                return (
                  <div key={b.id} style={sx}>
                    {t("er.block.q.title")} · Preview
                  </div>
                );
              case "q.table": {
                const cols = b.tableColumns?.length ? b.tableColumns : PREVIEW_TABLE_COLS;
                return (
                  <div key={b.id} style={sx} className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-[10px]">
                      <thead>
                        <tr className="border-b border-slate-200">
                          {cols.map((c) => (
                            <th key={c} className="py-1 pr-2 font-semibold">
                              {t(COL_LABEL[c])}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {MOCK_ROWS.map((row, ri) => (
                          <tr key={ri} className="border-b border-slate-100">
                            {cols.map((c) => (
                              <td key={c} className="py-1 pr-2 align-top">
                                {String(row[c])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }
              case "q.totals": {
                const showGst = b.tableShowGst !== false;
                return (
                  <div key={b.id} style={sx} className="space-y-0.5 text-[11px]">
                    <div>Subtotal · $718.00</div>
                    {showGst && <div>GST · $71.80</div>}
                    <div className="font-semibold">Total · $789.80</div>
                  </div>
                );
              }
              case "c.text":
                return (
                  <div key={b.id} style={sx} className="whitespace-pre-wrap">
                    {b.text ?? ""}
                  </div>
                );
              case "c.image": {
                const embedded =
                  typeof b.imageDataUrl === "string" && b.imageDataUrl.length > 0 ? b.imageDataUrl : null;
                const m = b.materialId ? matById.get(b.materialId) : undefined;
                const url = embedded ?? materialPreviewUrl(m);
                const wPct = Math.round((b.style?.imageWidthFrac ?? 1) * 100);
                return (
                  <div key={b.id} style={sx}>
                    {url ? (
                      <div className="mx-auto max-w-full" style={{ width: `${wPct}%` }}>
                        <img src={url} alt="" className="w-full rounded object-contain" />
                      </div>
                    ) : (
                      <div className="rounded border border-dashed border-slate-300 bg-slate-50 px-2 py-6 text-center text-[10px] text-slate-400">
                        {t("er.pickMaterial")}
                      </div>
                    )}
                  </div>
                );
              }
              case "c.spacer":
                return (
                  <div
                    key={b.id}
                    aria-hidden
                    style={{ height: `${Math.min(160, Math.max(4, (b.spacerHeightMm ?? 8) * 4))}px` }}
                  />
                );
              case "c.rule":
                return (
                  <div
                    key={b.id}
                    className="w-full"
                    style={{
                      borderTopWidth: `${Math.max(1, (b.ruleThicknessMm ?? 0.25) * 8)}px`,
                      borderTopStyle: "solid",
                      borderTopColor: b.ruleColor ?? "#94a3b8",
                    }}
                  />
                );
              default:
                return null;
            }
          })}
        </div>
      </div>
    </div>
  );
}
