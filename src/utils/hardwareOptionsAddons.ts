import type { AssociationRow, HardwareAddon, HardwareOption, HardwarePlacement, PriceBand, QuotePriceTier } from "../types";
import { placementCountForAssociation, placementQty } from "./placementQty";
import { normalizePriceBandPartial, priceAtTier } from "./priceTriple";
import { normalizeSkuSpecifications } from "./skuSpecifications";

type RawOption = Partial<HardwareOption> & { priceDelta?: number };

function optionPriceBand(opt: HardwareOption): PriceBand {
  return normalizePriceBandPartial(opt.priceBand, opt.optionPrice);
}

function coerceOptionPrice(raw: RawOption, baseUnitPrice: number): number {
  const op = (raw as { optionPrice?: unknown }).optionPrice;
  if (typeof op === "number" && Number.isFinite(op)) return Math.max(0, op);
  const legacyDelta = typeof raw.priceDelta === "number" && Number.isFinite(raw.priceDelta) ? raw.priceDelta : undefined;
  if (legacyDelta !== undefined) return Math.max(0, baseUnitPrice + legacyDelta);
  return Math.max(0, baseUnitPrice);
}

/** 将资源库 / 持久化中的规格项规范化；baseUnitPrice 用于把旧版 priceDelta 换算为 optionPrice */
export function normalizeHardwareOptions(raw: unknown, baseUnitPrice: number): HardwareOption[] {
  if (!Array.isArray(raw)) return [];
  const base = typeof baseUnitPrice === "number" && Number.isFinite(baseUnitPrice) && baseUnitPrice >= 0 ? baseUnitPrice : 0;
  const out: HardwareOption[] = [];
  for (const x of raw) {
    const o = x as RawOption;
    const id = typeof o.id === "string" && o.id ? o.id : crypto.randomUUID();
    const label = String(o.label ?? "").trim();
    if (!label) continue;
    const optionPrice = coerceOptionPrice(o, base);
    const priceBand = normalizePriceBandPartial(o.priceBand, optionPrice);
    const barcode = String(o.barcode ?? "").trim();
    const pm = (o as { productMaterialId?: unknown }).productMaterialId;
    const tm = (o as { technicalMaterialId?: unknown }).technicalMaterialId;
    const opt: HardwareOption = {
      id,
      label,
      optionPrice: priceBand.regular,
      priceBand,
      ...(barcode ? { barcode } : {}),
    };
    if (typeof pm === "string" && pm.trim()) opt.productMaterialId = pm.trim();
    if (typeof tm === "string" && tm.trim()) opt.technicalMaterialId = tm.trim();
    out.push(opt);
  }
  return out;
}

export function normalizeHardwareAddons(raw: unknown): HardwareAddon[] {
  if (!Array.isArray(raw)) return [];
  const out: HardwareAddon[] = [];
  for (const x of raw) {
    const o = x as Partial<HardwareAddon>;
    const id = typeof o.id === "string" && o.id ? o.id : crypto.randomUUID();
    const label = String(o.label ?? "").trim();
    if (!label) continue;
    const price = typeof o.price === "number" && Number.isFinite(o.price) && o.price >= 0 ? o.price : 0;
    out.push({ id, label, price });
  }
  return out;
}

function associationPriceBand(a: AssociationRow): PriceBand {
  return normalizePriceBandPartial(a.priceBand, a.unitPrice);
}

export function normalizeAssociationRow(a: AssociationRow): AssociationRow {
  const o = a.quoteLineTotalOverride;
  const quoteLineTotalOverride =
    o !== null && o !== undefined && typeof o === "number" && Number.isFinite(o) && o >= 0 ? o : null;
  const uo = a.quoteLineUnitPriceOverride;
  const quoteLineUnitPriceOverride =
    uo !== null && uo !== undefined && typeof uo === "number" && Number.isFinite(uo) && uo >= 0 ? uo : null;
  const qo = a.quoteLineQtyOverride;
  const quoteLineQtyOverride =
    qo !== null && qo !== undefined && typeof qo === "number" && Number.isFinite(qo) && qo >= 0 ? Math.floor(qo) : null;
  const dp = a.quoteLineDiscountPct;
  const quoteLineDiscountPct =
    dp !== null && dp !== undefined && typeof dp === "number" && Number.isFinite(dp) && dp > 0 && dp < 100
      ? dp
      : null;
  const unitPrice = typeof a.unitPrice === "number" && Number.isFinite(a.unitPrice) && a.unitPrice >= 0 ? a.unitPrice : 0;
  const priceBand = normalizePriceBandPartial(a.priceBand, unitPrice);
  const syncedUnit = priceBand.regular;
  const qtm = a.quoteTierMode;
  const quoteTierMode =
    qtm === "regular" || qtm === "vip" || qtm === "vvip" || qtm === "follow" ? qtm : ("follow" as const);
  const wm = a.warrantyMonthsAfterShip;
  const warrantyMonthsAfterShip =
    wm !== null && wm !== undefined && typeof wm === "number" && Number.isFinite(wm) && wm >= 0 ? Math.round(wm) : null;
  const ab = (a as { mapLabelAbbrev?: unknown }).mapLabelAbbrev;
  const explicit =
    typeof ab === "string" && ab.trim() ? ab.trim().slice(0, 120) : null;
  const productNameForMap = ((a.deviceModel ?? "").trim() || (a.hardwareName ?? "").trim()).slice(0, 120);
  /** 未填写过的地图缩写：与产品名（型号优先）对齐，便于再改短；已有非空缩写保持不变 */
  const mapLabelAbbrev = explicit ?? (productNameForMap || null);
  return normalizeSkuSpecifications({
    ...a,
    mapLabelAbbrev,
    quoteLineTotalOverride,
    quoteLineUnitPriceOverride,
    quoteLineQtyOverride,
    quoteLineDiscountPct,
    unitPrice: syncedUnit,
    priceBand,
    warrantyMonthsAfterShip,
    quoteTierMode,
    options: normalizeHardwareOptions(a.options, syncedUnit),
    addons: normalizeHardwareAddons(a.addons),
  });
}

export function normalizePlacement(p: HardwarePlacement): HardwarePlacement {
  const addonIds = Array.isArray(p.addonIds)
    ? p.addonIds.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  const optionId =
    p.optionId === null || p.optionId === undefined
      ? null
      : typeof p.optionId === "string" && p.optionId
        ? p.optionId
        : null;
  const qty = placementQty({ ...p, optionId, addonIds });
  return { ...p, optionId, addonIds, qty };
}

export function optionById(assoc: AssociationRow, id: string | null): HardwareOption | null {
  if (!id) return null;
  return assoc.options.find((o) => o.id === id) ?? null;
}

function labeledOptions(assoc: AssociationRow): HardwareOption[] {
  return assoc.options.filter((o) => o.label.trim());
}

/** 单点：无带标签规格时为 band[tier]；否则为所选规格 band[tier]；再加已勾选 add-on */
export function placementLineTotal(
  assoc: AssociationRow,
  p: HardwarePlacement,
  tier: QuotePriceTier,
): number {
  const labeled = labeledOptions(assoc);
  let core = priceAtTier(associationPriceBand(assoc), tier);
  if (labeled.length > 0) {
    const opt = optionById(assoc, p.optionId) ?? labeled[0] ?? null;
    if (opt?.label.trim()) core = priceAtTier(optionPriceBand(opt), tier);
  }
  let add = 0;
  const ids = new Set(p.addonIds ?? []);
  for (const ad of assoc.addons) {
    if (ids.has(ad.id)) add += ad.price;
  }
  return core + add;
}

export function associationRevenueTotal(
  assoc: AssociationRow,
  placements: HardwarePlacement[],
  tier: QuotePriceTier,
): number {
  return placements
    .filter((p) => p.associationId === assoc.id)
    .reduce((s, p) => s + placementLineTotal(assoc, p, tier) * placementQty(p), 0);
}

export function associationQuoteEffectiveQty(assoc: AssociationRow, placements: HardwarePlacement[]): number {
  const qm = placementCountForAssociation(assoc.id, placements);
  const qOv = assoc.quoteLineQtyOverride;
  if (qOv !== null && qOv !== undefined && Number.isFinite(qOv) && qOv >= 0) return Math.floor(qOv);
  return qm;
}

/** Effective tier per association (respect per-row override). */
export function tierForAssociationRow(assoc: AssociationRow, globalTier: QuotePriceTier): QuotePriceTier {
  const m = assoc.quoteTierMode;
  if (m === "regular" || m === "vip" || m === "vvip") return m;
  return globalTier;
}

export function associationRevenueTotalRespectingRowTier(
  assoc: AssociationRow,
  placements: HardwarePlacement[],
  globalTier: QuotePriceTier,
): number {
  const t = tierForAssociationRow(assoc, globalTier);
  return associationRevenueTotal(assoc, placements, t);
}

export function associationLineMinUnit(assoc: AssociationRow, tier: QuotePriceTier): number {
  const labeled = labeledOptions(assoc);
  if (!labeled.length) return priceAtTier(associationPriceBand(assoc), tier);
  return Math.min(...labeled.map((o) => priceAtTier(optionPriceBand(o), tier)));
}

export function associationLineMaxUnit(assoc: AssociationRow, tier: QuotePriceTier): number {
  const labeled = labeledOptions(assoc);
  const core = labeled.length
    ? Math.max(...labeled.map((o) => priceAtTier(optionPriceBand(o), tier)))
    : priceAtTier(associationPriceBand(assoc), tier);
  const addonSum = assoc.addons.filter((a) => a.label.trim()).reduce((s, a) => s + a.price, 0);
  return core + addonSum;
}

export function associationMapPriceRange(
  assoc: AssociationRow,
  placements: HardwarePlacement[],
  tier: QuotePriceTier,
): { lo: number; hi: number } {
  const q = placementCountForAssociation(assoc.id, placements);
  return {
    lo: associationLineMinUnit(assoc, tier) * q,
    hi: associationLineMaxUnit(assoc, tier) * q,
  };
}

export function associationRowsMapPriceRange(
  rows: AssociationRow[],
  placements: HardwarePlacement[],
  tier: QuotePriceTier,
): { lo: number; hi: number } {
  let lo = 0;
  let hi = 0;
  for (const r of rows) {
    const t = tierForAssociationRow(r, tier);
    const q = placementCountForAssociation(r.id, placements);
    lo += associationLineMinUnit(r, t) * q;
    hi += associationLineMaxUnit(r, t) * q;
  }
  return { lo, hi };
}

export function formatMoneyAmount(n: number, currencyCode: string): string {
  const c = (currencyCode || "AUD").trim().toUpperCase() || "AUD";
  const v = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `${c} ${v.toFixed(2)}`;
  }
}

export function formatMoneyRange(lo: number, hi: number, currencyCode: string): string {
  const a = formatMoneyAmount(lo, currencyCode);
  const b = formatMoneyAmount(hi, currencyCode);
  if (a === b) return a;
  return `${a}–${b}`;
}

/** 地图×规格小计，再按报价表数量缩放；不含折扣与手工覆盖价 */
export function associationQuoteLineScaledNoDiscount(
  assoc: AssociationRow,
  placements: HardwarePlacement[],
  globalTier: QuotePriceTier,
): number {
  const t = tierForAssociationRow(assoc, globalTier);
  const base = associationRevenueTotalRespectingRowTier(assoc, placements, globalTier);
  const qm = placementCountForAssociation(assoc.id, placements);
  const qOv = assoc.quoteLineQtyOverride;
  let scaled = base;
  if (qOv !== null && qOv !== undefined && Number.isFinite(qOv) && qOv >= 0) {
    const qf = Math.floor(qOv);
    if (qm > 0) scaled = base * (qf / qm);
    else scaled = associationLineMaxUnit(assoc, t) * qf;
  }
  return scaled;
}

/** 自动小计（地图×规格），再按报价表数量与折扣缩放；不含手工覆盖价 */
export function associationQuoteLineAutoBeforeOverride(
  assoc: AssociationRow,
  placements: HardwarePlacement[],
  globalTier: QuotePriceTier,
): number {
  let scaled = associationQuoteLineScaledNoDiscount(assoc, placements, globalTier);
  const d = assoc.quoteLineDiscountPct;
  if (d !== null && d !== undefined && typeof d === "number" && Number.isFinite(d) && d > 0 && d < 100) {
    scaled *= 1 - d / 100;
  }
  return scaled;
}

/** 报价汇总行小计：总价覆盖 > 单价覆盖×数量 > 自动（可含折扣） */
export function associationQuoteLineTotal(
  assoc: AssociationRow,
  placements: HardwarePlacement[],
  globalTier: QuotePriceTier,
): number {
  const o = assoc.quoteLineTotalOverride;
  if (o !== null && o !== undefined && typeof o === "number" && Number.isFinite(o) && o >= 0) return o;
  const u = assoc.quoteLineUnitPriceOverride;
  if (u !== null && u !== undefined && typeof u === "number" && Number.isFinite(u) && u >= 0) {
    const q = associationQuoteEffectiveQty(assoc, placements);
    return u * q;
  }
  return associationQuoteLineAutoBeforeOverride(assoc, placements, globalTier);
}

export function optionLabelBrief(assoc: AssociationRow, optionId: string | null): string {
  const o = optionById(assoc, optionId);
  return o?.label ?? "";
}
