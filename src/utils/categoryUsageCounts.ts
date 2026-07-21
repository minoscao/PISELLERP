import type { AssociationRow, MaterialCategoryDef, MaterialPage } from "../types";

/** 产品图素材 + 硬件行中选用该分类名的条数（与 Media 侧「该文件夹下多少素材」一致口径：产品图按 category 精确匹配） */
export function hardwareCategoryUsageCount(
  d: MaterialCategoryDef,
  materials: MaterialPage[],
  associations: AssociationRow[],
): number {
  const key = d.name;
  let n = 0;
  n += materials.filter((m) => m.imageKind === "product" && m.category === key).length;
  n += associations.filter((a) => a.hardwareName.trim() === key).length;
  return n;
}
