import type { AssociationRow, MaterialCategoryDef, MaterialPage } from "../types";

/** Category from linked product material; empty if none. */
export function associationMaterialCategory(a: AssociationRow, materials: MaterialPage[]): string {
  const mid = a.productMaterialId;
  if (!mid) return "";
  return materials.find((m) => m.id === mid)?.category?.trim() ?? "";
}

const ENUM_DOT = "\u00b7";

/**
 * 仅从硬件库「展示名 / 分类库」推导分组标题（不看关联素材文件夹）。
 * 含「大类 · 子类」时取大类；否则按 `categoryDefs` 最长前缀匹配；再无则返回空串（由上层回退）。
 */
function associationCategoryFromHardwareRow(
  a: AssociationRow,
  categoryDefs: MaterialCategoryDef[],
): string {
  const name = (a.hardwareName ?? "").trim();
  if (!name) return "";

  const spacedSep = ` ${ENUM_DOT} `;
  const spaced = name.indexOf(spacedSep);
  if (spaced > 0) {
    const head = name.slice(0, spaced).trim();
    if (head) return head;
  }
  const bare = name.indexOf(ENUM_DOT);
  if (bare > 0) {
    const head = name.slice(0, bare).trim();
    const tail = name.slice(bare + 1).trim();
    if (head && tail) return head;
  }

  const defs = [...categoryDefs].sort((x, y) => y.name.length - x.name.length);
  for (const d of defs) {
    const n = d.name.trim();
    if (!n) continue;
    if (name === n) return n;
    if (name.startsWith(`${n} `) || name.startsWith(`${n}·`) || name.startsWith(`${n} ${ENUM_DOT}`)) return n;
  }

  return "";
}

/**
 * 地图 / 列表 / 导出共用的「设备大类」：**数据驱动硬件库**。
 *
 * 1. 优先：硬件行名称里的「大类 · …」与 `categoryDefs` 前缀（与你在硬件库里改的归属一致）。
 * 2. 否则：关联**产品**素材所在文件夹（仅在没有可用硬件侧推导时作回退）。
 * 3. 最后：整段 `hardwareName`。
 *
 * 以前把素材文件夹放在第一步，绑了产品图后改硬件分类左侧仍跟文件夹走，看起来像「没数据驱动」。
 */
export function associationMapCategory(
  a: AssociationRow,
  materials: MaterialPage[],
  categoryDefs: MaterialCategoryDef[],
): string {
  const fromHw = associationCategoryFromHardwareRow(a, categoryDefs).trim();
  if (fromHw) return fromHw;

  const fromMat = associationMaterialCategory(a, materials).trim();
  if (fromMat) return fromMat;

  const name = (a.hardwareName ?? "").trim();
  return name;
}
