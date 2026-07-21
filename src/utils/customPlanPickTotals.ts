import type { CustomPlanServiceLine, CustomPlanSoftwareLine, ServiceRow, SoftwareFeatureRow } from "../types";
import { mergeAddonQtyMap, type AddonQtyLinePick } from "./customPlanAddonQty";

/** 每单位行内的单条 Add-on 金额（单价×Add-on 数量），与 softwarePickLineUnitPrice 中加和一致 */
export type AddonUnitSlice = { label: string; unitAmount: number };

function labeledOptions<T extends { label: string }>(options: T[]): T[] {
  return options.filter((o) => o.label.trim());
}

function optionCoreUnit<T extends { id: string; label: string; optionPrice: number }>(
  options: T[],
  optionId: string | null,
  baseUnit: number,
): number {
  const labeled = labeledOptions(options);
  if (!labeled.length) return Math.max(0, baseUnit);
  const opt = options.find((o) => o.id === optionId && o.label.trim()) ?? labeled[0] ?? null;
  return opt ? Math.max(0, opt.optionPrice) : Math.max(0, baseUnit);
}

function addonsWeightedSum(addons: { id: string; price: number }[], line: AddonQtyLinePick): number {
  const byId = new Map(addons.map((a) => [a.id, a]));
  const qtyMap = mergeAddonQtyMap(line);
  let s = 0;
  for (const [id, q] of Object.entries(qtyMap)) {
    const ad = byId.get(id);
    if (ad && q > 0) s += Math.max(0, ad.price) * q;
  }
  return s;
}

/** 含规格与 Add-on 后的有效单价（不含数量） */
/** 不含 Add-on：仅规格/底价的单价（与分项第一行「基础」一致） */
export function softwarePickCoreUnitPrice(
  f: SoftwareFeatureRow,
  line: Pick<CustomPlanSoftwareLine, "optionId">,
): number {
  const base =
    typeof f.unitPrice === "number" && Number.isFinite(f.unitPrice) && f.unitPrice >= 0 ? f.unitPrice : 0;
  return optionCoreUnit(f.options, line.optionId, base);
}

export function softwarePickAddonUnitSlices(
  f: SoftwareFeatureRow,
  line: Pick<CustomPlanSoftwareLine, "addonIds" | "addonQtyById">,
): AddonUnitSlice[] {
  const qtyMap = mergeAddonQtyMap(line);
  const out: AddonUnitSlice[] = [];
  for (const ad of f.addons) {
    const q = qtyMap[ad.id];
    if (!q || q < 1 || !ad.label.trim()) continue;
    out.push({
      label: ad.label.trim(),
      unitAmount: Math.max(0, ad.price) * q,
    });
  }
  return out;
}

export function softwarePickLineUnitPrice(
  f: SoftwareFeatureRow,
  line: Pick<CustomPlanSoftwareLine, "optionId" | "addonIds" | "addonQtyById">,
): number {
  const core = softwarePickCoreUnitPrice(f, line);
  return core + addonsWeightedSum(f.addons, line);
}

export function softwarePickLineTotal(
  f: SoftwareFeatureRow,
  line: Pick<CustomPlanSoftwareLine, "quantity" | "optionId" | "addonIds" | "addonQtyById">,
): number {
  const qtyRaw = Math.floor(Number(line.quantity));
  const qty = Number.isFinite(qtyRaw) && qtyRaw >= 0 ? qtyRaw : 0;
  if (qty <= 0) return 0;
  return qty * softwarePickLineUnitPrice(f, line);
}

export function servicePickCoreUnitPrice(
  s: ServiceRow,
  line: Pick<CustomPlanServiceLine, "optionId">,
): number {
  const base =
    typeof s.unitPrice === "number" && Number.isFinite(s.unitPrice) && s.unitPrice >= 0 ? s.unitPrice : 0;
  return optionCoreUnit(s.options, line.optionId, base);
}

export function servicePickAddonUnitSlices(
  s: ServiceRow,
  line: Pick<CustomPlanServiceLine, "addonIds" | "addonQtyById">,
): AddonUnitSlice[] {
  const qtyMap = mergeAddonQtyMap(line);
  const out: AddonUnitSlice[] = [];
  for (const ad of s.addons) {
    const q = qtyMap[ad.id];
    if (!q || q < 1 || !ad.label.trim()) continue;
    out.push({
      label: ad.label.trim(),
      unitAmount: Math.max(0, ad.price) * q,
    });
  }
  return out;
}

/** 含规格与 Add-on 后的有效单价（不含数量） */
export function servicePickLineUnitPrice(
  s: ServiceRow,
  line: Pick<CustomPlanServiceLine, "optionId" | "addonIds" | "addonQtyById">,
): number {
  const core = servicePickCoreUnitPrice(s, line);
  return core + addonsWeightedSum(s.addons, line);
}

export function servicePickLineTotal(
  s: ServiceRow,
  line: Pick<CustomPlanServiceLine, "quantity" | "optionId" | "addonIds" | "addonQtyById">,
): number {
  const qtyRaw = Math.floor(Number(line.quantity));
  const qty = Number.isFinite(qtyRaw) && qtyRaw >= 0 ? qtyRaw : 0;
  if (qty <= 0) return 0;
  return qty * servicePickLineUnitPrice(s, line);
}

/** 报价页显示金额：若有覆盖则用小计覆盖值 */
export function customPlanSoftwareEffectiveTotal(f: SoftwareFeatureRow, line: CustomPlanSoftwareLine): number {
  const o = line.lineTotalOverride;
  if (o !== null && o !== undefined && typeof o === "number" && Number.isFinite(o) && o >= 0) return o;
  return softwarePickLineTotal(f, line);
}

export function customPlanSoftwareAdjustDelta(f: SoftwareFeatureRow, line: CustomPlanSoftwareLine): number {
  return customPlanSoftwareEffectiveTotal(f, line) - softwarePickLineTotal(f, line);
}

export function customPlanServiceEffectiveTotal(s: ServiceRow, line: CustomPlanServiceLine): number {
  const o = line.lineTotalOverride;
  if (o !== null && o !== undefined && typeof o === "number" && Number.isFinite(o) && o >= 0) return o;
  return servicePickLineTotal(s, line);
}

export function customPlanServiceAdjustDelta(s: ServiceRow, line: CustomPlanServiceLine): number {
  return customPlanServiceEffectiveTotal(s, line) - servicePickLineTotal(s, line);
}
