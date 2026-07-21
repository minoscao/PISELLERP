import { UNCATEGORIZED_CATEGORY_NAME } from "../constants/materialCategories";
import type { AssociationRow, MaterialCategoryDef, MaterialPage } from "../types";
import { HARDWARE_ICON_IDS } from "../icons/hardwareGlyphs";
import { firstLinkedMaterial } from "./associationMaterials";
import { categoryPrimaryFromLabel } from "./erpCatalogCategories";

function normalizeIconKey(raw: string): string {
  return (HARDWARE_ICON_IDS as readonly string[]).includes(raw) ? raw : "device";
}

/** 左侧目录「主类」串 → 与列表一致的图标（取该主类下任意分类定义的 icon） */
export function iconKeyForHardwareNavPrimary(
  primary: string,
  categoryDefs: MaterialCategoryDef[],
): string {
  const hit = categoryDefs.find((d) => categoryPrimaryFromLabel(d.name) === primary);
  if (hit) return normalizeIconKey(hit.iconKey);
  const ex = categoryDefs.find((d) => d.name === primary);
  return normalizeIconKey(ex?.iconKey ?? "device");
}

export function iconKeyForCategoryName(
  categoryName: string | undefined,
  categoryDefs: MaterialCategoryDef[],
): string {
  const n = categoryName?.trim();
  if (!n) {
    const unc = categoryDefs.find((d) => d.name === UNCATEGORIZED_CATEGORY_NAME);
    return normalizeIconKey(unc?.iconKey ?? "device");
  }
  const def = categoryDefs.find((d) => d.name === n);
  if (def) return normalizeIconKey(def.iconKey);
  const unc = categoryDefs.find((d) => d.name === UNCATEGORIZED_CATEGORY_NAME);
  return normalizeIconKey(unc?.iconKey ?? "device");
}

export function iconKeyForAssociation(
  row: AssociationRow,
  materials: MaterialPage[],
  categoryDefs: MaterialCategoryDef[],
): string {
  const mat = firstLinkedMaterial(row, materials);
  if (mat) return iconKeyForCategoryName(mat.category, categoryDefs);
  /** 尚未绑图时，按设备分类名取分类库图标（与硬件库编辑器一致） */
  return iconKeyForCategoryName(row.hardwareName, categoryDefs);
}
