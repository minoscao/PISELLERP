import { isSoftwareMaterialCategoryName } from "../constants/softwareMaterialPaths";
import type { ErpStockKind, MaterialCategoryDef, MaterialPage } from "../types";
import { categoryPrimaryFromLabel, fullCategoryKeyFromLabel, normalizeStorageCategory } from "./erpCatalogCategories";

const SEP = " · ";

function softwareMaterialMidSegment(path: string): string | null {
  if (!isSoftwareMaterialCategoryName(path)) return null;
  const i = path.indexOf(SEP);
  if (i < 0) return null;
  const rest = path.slice(i + SEP.length);
  const j = rest.indexOf(SEP);
  if (j < 0) return null;
  return rest.slice(0, j).trim() || null;
}

function softwareDocMatchesSoftwarePrimary(materialPath: string, erpPrimary: string): boolean {
  const mid = softwareMaterialMidSegment(materialPath);
  if (!mid) return false;
  return categoryPrimaryFromLabel(mid) === erpPrimary;
}

/**
 * 将「企业产品库 / ERP 左侧树」的 (kind, primary, filterKey) 与素材库中 product 类素材的 `category` 字段对齐
 *（产品库按主类/子类拆；仅按全名字符串匹配会把计数全部打成 0）。
 */
/** 仅选中 Hardware / Software / Service 整段、未点具体主类时（媒体库筛素材） */
export function materialMatchesErpKindAll(
  m: MaterialPage,
  kind: ErpStockKind,
  servicePrimarySet: Set<string>,
): boolean {
  if (kind === "software") return isSoftwareMaterialCategoryName(m.category);
  if (isSoftwareMaterialCategoryName(m.category)) return false;
  const p = categoryPrimaryFromLabel(m.category);
  if (kind === "service") return servicePrimarySet.has(p);
  return !servicePrimarySet.has(p);
}

export function materialMatchesErpProductNav(
  m: MaterialPage,
  kind: ErpStockKind,
  primary: string,
  filterKey: string | null,
): boolean {
  if (kind === "hardware") {
    if (isSoftwareMaterialCategoryName(m.category)) return false;
    if (!filterKey) {
      return categoryPrimaryFromLabel(m.category) === primary;
    }
    return m.category === filterKey;
  }
  if (kind === "software") {
    if (!isSoftwareMaterialCategoryName(m.category)) return false;
    if (!filterKey) {
      return softwareDocMatchesSoftwarePrimary(m.category, primary);
    }
    const mid = softwareMaterialMidSegment(m.category);
    if (!mid) return false;
    return fullCategoryKeyFromLabel(mid) === fullCategoryKeyFromLabel(filterKey) || mid === filterKey;
  }
  if (kind === "service") {
    if (isSoftwareMaterialCategoryName(m.category)) return false;
    if (!filterKey) {
      return categoryPrimaryFromLabel(m.category) === primary;
    }
    return m.category === filterKey || fullCategoryKeyFromLabel(m.category) === fullCategoryKeyFromLabel(filterKey);
  }
  return false;
}

/** 与左侧 ERP 硬件目录一致：仅「主类桶」时 filterKey 为 null，否则为完整存储类名 */
export function hardwareDefNavFilterKey(defName: string): string | null {
  const full = normalizeStorageCategory(defName);
  if (!full) return null;
  if (categoryPrimaryFromLabel(full) === full.trim()) return null;
  return full;
}

/** 与 `materialMatchesErpProductNav(..., "hardware", …)` 一致，用于右侧分类树计数对齐左侧 */
export function countProductMaterialsForHardwareDef(materialsInTab: MaterialPage[], def: MaterialCategoryDef): number {
  const primary = categoryPrimaryFromLabel(def.name);
  const fk = hardwareDefNavFilterKey(def.name);
  return materialsInTab.filter((m) => materialMatchesErpProductNav(m, "hardware", primary, fk)).length;
}
