import type { AssociationQuoteTierMode, PriceBand, QuotePriceTier } from "../types";

export type { PriceBand, QuotePriceTier, AssociationQuoteTierMode } from "../types";

/** Normalize separators unless the field contains CJK (free-text note mode). */
export function hasCjkText(s: string): boolean {
  return /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(s);
}

export function normalizePriceSeparators(raw: string): string {
  if (hasCjkText(raw)) return raw;
  return raw
    .replace(/；/g, ";")
    .replace(/，/g, ",")
    .replace(/。/g, ";")
    .replace(/．/g, ".")
    .replace(/、/g, ";");
}

function parseNonNegNumber(seg: string): number | null {
  const t = seg.replace(/,/g, "").trim();
  if (!t) return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Parses `regular;vip;vvip`. Empty segments inherit the last filled value to the left.
 * Single value `100` => all three 100. `100;;90` => 100, 100, 90.
 */
export function parsePriceTripleString(raw: string): PriceBand {
  const s0 = normalizePriceSeparators(String(raw ?? "").trim());
  if (!s0) return { regular: 0, vip: 0, vvip: 0 };
  const parts = s0.split(";").map((p) => p.trim());
  while (parts.length < 3) parts.push("");
  let last = 0;
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    const seg = parts[i] ?? "";
    if (!seg) {
      out.push(last);
      continue;
    }
    const n = parseNonNegNumber(seg);
    if (n === null) out.push(last);
    else {
      last = n;
      out.push(n);
    }
  }
  return { regular: out[0]!, vip: out[1]!, vvip: out[2]! };
}

export function formatPriceTriple(b: PriceBand): string {
  const eq = b.regular === b.vip && b.vip === b.vvip;
  if (eq) return fmtNum(b.regular);
  return `${fmtNum(b.regular)};${fmtNum(b.vip)};${fmtNum(b.vvip)}`;
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  return String(r);
}

export function bandFromLegacyUnit(unit: number): PriceBand {
  const u = typeof unit === "number" && Number.isFinite(unit) && unit >= 0 ? unit : 0;
  return { regular: u, vip: u, vvip: u };
}

export function priceAtTier(b: PriceBand, tier: QuotePriceTier): number {
  return Math.max(0, b[tier] ?? 0);
}

export function effectiveQuoteTierForAssociation(
  mode: AssociationQuoteTierMode | undefined,
  globalTier: QuotePriceTier,
): QuotePriceTier {
  if (mode === "regular" || mode === "vip" || mode === "vvip") return mode;
  return globalTier;
}

export function isManualMixedQuotePricing(associations: { quoteTierMode?: AssociationQuoteTierMode }[]): boolean {
  return associations.some((a) => a.quoteTierMode && a.quoteTierMode !== "follow");
}

export function normalizePriceBandPartial(raw: unknown, fallbackUnit: number): PriceBand {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const r = Number(o.regular);
    const v = Number(o.vip);
    const w = Number(o.vvip);
    if ([r, v, w].every((x) => Number.isFinite(x) && x >= 0)) {
      return { regular: r, vip: v, vvip: w };
    }
  }
  return bandFromLegacyUnit(fallbackUnit);
}

export function parseWarrantyMonthsAfterShip(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:month|months|mo|月)\b/i);
  if (m?.[1]) {
    const n = parseFloat(m[1]);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }
  const m2 = s.match(/(\d+)\s*M\b/i);
  if (m2?.[1]) {
    const n = parseInt(m2[1], 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}
