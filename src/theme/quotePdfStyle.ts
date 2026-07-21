import type { QuotePdfCoverDecor, QuotePdfExportStyle } from "../types";

/** 报价 PDF 导出配色默认值（取代原「现代 / 经典」两套硬编码模板） */
export const DEFAULT_QUOTE_PDF_EXPORT_STYLE: QuotePdfExportStyle = {
  accentColor: "#7c6cf0",
  mutedColor: "#64748b",
  tableHeaderFill: "#e2e8f0",
  tableGridColor: "#cbd5e1",
  hardwareBannerFill: "#eef2f8",
  coverDecor: "topBar",
};

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

function clampHex6(hex: string, fallback: string): string {
  const h = hex.trim();
  if (HEX6.test(h)) return h.toLowerCase();
  return fallback.toLowerCase();
}

function coverDecorFromUnknown(v: unknown): QuotePdfCoverDecor {
  if (v === "frame" || v === "none" || v === "topBar") return v;
  return DEFAULT_QUOTE_PDF_EXPORT_STYLE.coverDecor;
}

/** 从持久化或旧版 `quotePdfTemplate` 合并为完整样式 */
export function normalizeQuotePdfExportStyle(
  raw: Partial<QuotePdfExportStyle> | undefined,
  legacyTemplate?: "modern" | "classic" | unknown,
): QuotePdfExportStyle {
  const d = DEFAULT_QUOTE_PDF_EXPORT_STYLE;
  if (legacyTemplate === "classic" && !raw) {
    return {
      accentColor: "#1e293b",
      mutedColor: "#475569",
      tableHeaderFill: "#e2e8f0",
      tableGridColor: "#94a3b8",
      hardwareBannerFill: "#f1f5f9",
      coverDecor: "frame",
    };
  }
  if (legacyTemplate === "modern" && !raw) {
    return { ...d };
  }
  return {
    accentColor: clampHex6(raw?.accentColor ?? "", d.accentColor),
    mutedColor: clampHex6(raw?.mutedColor ?? "", d.mutedColor),
    tableHeaderFill: clampHex6(raw?.tableHeaderFill ?? "", d.tableHeaderFill),
    tableGridColor: clampHex6(raw?.tableGridColor ?? "", d.tableGridColor),
    hardwareBannerFill: clampHex6(raw?.hardwareBannerFill ?? "", d.hardwareBannerFill),
    coverDecor: coverDecorFromUnknown(raw?.coverDecor),
  };
}

export function hexToRgbTuple(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
