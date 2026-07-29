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

  return {
    ...row,
    skuClass,
    // Main devices need a usable footprint on the planning canvas even before
    // the supplier specification has been entered.
    lengthCm: skuClass === "main_device" ? (lengthCm ?? 300) : lengthCm,
    widthCm: skuClass === "main_device" ? (widthCm ?? 300) : widthCm,
    heightCm: finiteNonNegative(row.heightCm),
    weightKg: finiteNonNegative(row.weightKg),
    powerWatts: finiteNonNegative(row.powerWatts),
  };
}

export function skuFootprintLabel(row: Pick<AssociationRow, "lengthCm" | "widthCm">): string {
  if (row.lengthCm == null || row.widthCm == null) return "Dimensions not set";
  return `${row.lengthCm} × ${row.widthCm} cm`;
}
