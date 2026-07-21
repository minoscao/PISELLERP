import type { MaterialCategoryDef } from "../types";

/**
 * UI 标签：默认英文（nameEn）；无英文名时用存储名（多为中文主键）。
 * 不拼接 “英 (中)”，避免界面混排；存储仍用 `d.name`。
 */
export function categoryOptionText(d: MaterialCategoryDef): string {
  const en = d.nameEn?.trim();
  if (en) return en;
  return d.name.trim();
}

/** 仅用于调试或必须同时展示库内键时 */
export function categoryOptionTextWithKey(d: MaterialCategoryDef): string {
  const en = d.nameEn?.trim();
  const zh = d.name.trim();
  if (en && zh && en !== zh) return `${en} (${zh})`;
  return en || zh;
}
