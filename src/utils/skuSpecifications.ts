import type { AssociationRow, SkuClass } from "../types";

export const SKU_CLASS_LABEL: Record<SkuClass, string> = {
  main_device: "Main device",
  accessory: "Assistive equipment",
  consumable: "Consumable",
};

const ACCESSORY_PATTERN =
  /\b(stand|mount|bracket|holder|clamp|arm|pole|base|cradle|dock|cable|adapter|adaptor|charger|hub|socket|power strip|extension)\b|支架|托架|挂架|底座|夹具|电源线|转接|适配器|充电器|线缆/iu;
const CONSUMABLE_PATTERN =
  /\b(ribbon|thermal roll|paper roll|receipt roll|label roll|label paper|ticket|wristband|ink|toner|tape|cleaning|consumable)\b|色带|热敏纸|小票纸|标签纸|纸卷|腕带|墨盒|碳粉|耗材/iu;

function finiteNonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

type SkuPlanningSpec = Pick<AssociationRow, "lengthCm" | "widthCm" | "heightCm" | "weightKg" | "powerWatts">;

/**
 * Planning footprints for the imported PiSell catalog. A supplier-entered value
 * always wins; these prevent every legacy device from appearing as 300 × 300 cm
 * on a calibrated floor plan.
 */
function catalogPlanningSpec(row: Pick<AssociationRow, "hardwareName" | "deviceModel">): SkuPlanningSpec | null {
  const text = `${row.hardwareName ?? ""} ${row.deviceModel ?? ""}`.toLowerCase();
  const spec = (lengthCm: number, widthCm: number, heightCm: number, weightKg: number, powerWatts: number): SkuPlanningSpec => ({
    lengthCm,
    widthCm,
    heightCm,
    weightKg,
    powerWatts,
  });

  // Catalog rows which already state their cabinet/screen measurements take priority.
  const millimetres = text.match(/(\d{2,4})\s*mm?\s*[x*]\s*(\d{2,4})\s*mm?/i);
  if (millimetres) {
    const lengthCm = Number(millimetres[1]) / 10;
    const widthCm = Number(millimetres[2]) / 10;
    if (lengthCm >= 10 && widthCm >= 10) return spec(lengthCm, widthCm, 8, 25, 120);
  }

  if (/ipad/.test(text)) return spec(31, 24, 1, 0.7, 25);
  if (/android\s*(s1|s2)|android\s*g2|\bpos\b/.test(text)) return spec(55, 40, 35, 8, 90);
  if (/pisell\s*kf10|pisell\s*kv20/.test(text)) return spec(55, 45, 45, 12, 120);
  if (/sunmi\s*k2\s*mini/.test(text)) return spec(35, 28, 30, 4, 45);
  if (/sunmi\s*k2/.test(text)) return spec(45, 35, 35, 6, 60);
  if (/senor.*freestanding/.test(text)) return spec(65, 55, 130, 35, 120);
  if (/senor/.test(text)) return spec(55, 40, 50, 12, 90);
  if (/receipt printer|label printer|epson\s*tm|x-printer|\bgp[- ]?\d/.test(text)) return spec(35, 25, 20, 3, 35);
  if (/cash drawer|\bdrw\b/.test(text)) return spec(42, 42, 12, 8, 25);
  if (/scanner|zebra\s*ds/.test(text)) return spec(22, 15, 18, 0.5, 10);
  if (/scale|\bcas\b/.test(text)) return spec(50, 40, 25, 12, 45);
  if (/smart advertisements screen|menu screen|\bk156\b|\bk215\b/.test(text)) return spec(55, 35, 8, 12, 80);
  if (/monitor desk mount|\bstand\b|\bmount\b|\bbracket\b/.test(text)) return spec(45, 35, 50, 6, 20);
  if (/router|switch|gateway/.test(text)) return spec(30, 22, 5, 2, 20);
  if (/access point|\brap\d|wifi/.test(text)) return spec(22, 22, 5, 1, 15);
  if (/card reader|nfc contactless/.test(text)) return spec(20, 15, 8, 0.5, 8);
  if (/ethernet.*dock|extension dock/.test(text)) return spec(20, 12, 4, 0.3, 15);
  return null;
}

export function inferSkuClass(row: Pick<AssociationRow, "hardwareName" | "deviceModel">): SkuClass {
  const text = `${row.deviceModel ?? ""} ${row.hardwareName ?? ""}`.trim();
  if (CONSUMABLE_PATTERN.test(text)) return "consumable";
  if (ACCESSORY_PATTERN.test(text)) return "accessory";
  return "main_device";
}

export function normalizeSkuSpecifications<T extends AssociationRow>(row: T): T {
  const skuClass: SkuClass =
    row.skuClass === "main_device" || row.skuClass === "accessory" || row.skuClass === "consumable"
      ? row.skuClass
      : inferSkuClass(row);
  const lengthCm = finiteNonNegative(row.lengthCm);
  const widthCm = finiteNonNegative(row.widthCm);
  const inferred = catalogPlanningSpec(row);
  const legacyCustomDimensions =
    lengthCm !== null && widthCm !== null && (lengthCm !== 300 || widthCm !== 300);
  const hasManualDimensions = row.skuDimensionsSource === "manual" || legacyCustomDimensions;
  const useCatalogDimensions = !!inferred && !hasManualDimensions;
  const skuDimensionsSource = hasManualDimensions
    ? "manual"
    : useCatalogDimensions
      ? "catalog"
      : skuClass === "main_device"
        ? "default"
        : undefined;

  return {
    ...row,
    skuClass,
    ...(skuDimensionsSource ? { skuDimensionsSource } : {}),
    // Main devices need a usable footprint on the planning canvas even before
    // the supplier specification has been entered.
    lengthCm: useCatalogDimensions ? inferred!.lengthCm : lengthCm ?? (skuClass === "main_device" ? 300 : null),
    widthCm: useCatalogDimensions ? inferred!.widthCm : widthCm ?? (skuClass === "main_device" ? 300 : null),
    heightCm: hasManualDimensions ? finiteNonNegative(row.heightCm) : inferred?.heightCm ?? finiteNonNegative(row.heightCm),
    weightKg: hasManualDimensions ? finiteNonNegative(row.weightKg) : inferred?.weightKg ?? finiteNonNegative(row.weightKg),
    powerWatts: hasManualDimensions ? finiteNonNegative(row.powerWatts) : inferred?.powerWatts ?? finiteNonNegative(row.powerWatts),
  };
}

export function skuFootprintLabel(row: Pick<AssociationRow, "lengthCm" | "widthCm">): string {
  if (row.lengthCm == null || row.widthCm == null) return "Dimensions not set";
  return `${row.lengthCm} × ${row.widthCm} cm`;
}
