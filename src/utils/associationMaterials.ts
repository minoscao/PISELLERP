import type { AssociationRow, MaterialPage } from "../types";

/** 用于地图图标、分类、PDF 等：优先产品图 → 报价图 → 技术图 */
export function firstLinkedMaterial(
  row: AssociationRow,
  materials: MaterialPage[],
): MaterialPage | undefined {
  const ids = [row.productMaterialId, row.quoteAdMaterialId, row.technicalMaterialId];
  for (const id of ids) {
    if (!id) continue;
    const m = materials.find((x) => x.id === id);
    if (m) return m;
  }
  return undefined;
}
