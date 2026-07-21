import {
  isSoftwareMaterialCategoryName,
  LEGACY_SOFTWARE_MATERIAL_PREFIX,
  SOFTWARE_MATERIAL_PREFIX,
} from "../constants/softwareMaterialPaths";
import { LEGACY_SOFTWARE_FEATURE_CATEGORY_TO_EN } from "../constants/softwareFeatureCategories";

const OLD_UNTITLED = "未命名";
const NEW_UNTITLED = "Untitled";

/** Migrate persisted material.category strings from legacy software paths. */
export function migrateSoftwareMaterialCategoryPath(cat: string): string {
  let c = cat;
  const oldP = `${LEGACY_SOFTWARE_MATERIAL_PREFIX} · `;
  const newP = `${SOFTWARE_MATERIAL_PREFIX} · `;
  if (c.startsWith(oldP)) c = newP + c.slice(oldP.length);
  for (const [zh, en] of Object.entries(LEGACY_SOFTWARE_FEATURE_CATEGORY_TO_EN)) {
    c = c.split(` · ${zh} · `).join(` · ${en} · `);
  }
  if (isSoftwareMaterialCategoryName(c)) {
    c = c.split(" · 未分类 · ").join(" · Uncategorized · ");
  }
  if (c.endsWith(` · ${OLD_UNTITLED}`)) c = c.slice(0, -OLD_UNTITLED.length) + NEW_UNTITLED;
  return c;
}
