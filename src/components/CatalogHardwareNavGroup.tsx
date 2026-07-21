import type {
  AssociationRow,
  ErpCatalogNavSel,
  ErpHardwareNavSortMode,
  ErpStockKind,
  MaterialCategoryDef,
  MaterialPage,
} from "../types";
import type { MaterialFolderNavGroup, MaterialFolderNavRow } from "./MaterialFolderNav";
import { iconKeyForHardwareNavPrimary } from "../utils/categoryIcon";
import {
  categoryPrimaryFromLabel,
  filterHardwareNavPrimariesForSearch,
  hardwareNavPrimaryLabel,
  listHardwareNavPrimaries,
  listSecondariesForPrimary,
  orderHardwareSecondariesForNav,
  sortHardwareNavPrimariesByMode,
  type ErpCatRow,
} from "../utils/erpCatalogCategories";
import { categoryOptionText } from "../utils/categoryDisplay";

/** 仅由「分类库」条目推导子目录（无 ERP 行时，如市场资料侧栏） */
export function listDefSecondariesForPrimary(defs: MaterialCategoryDef[], primary: string): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (const d of defs) {
    if (categoryPrimaryFromLabel(d.name) !== primary) continue;
    if (categoryPrimaryFromLabel(d.name) === d.name.trim()) continue;
    out.push({ key: d.name, label: categoryOptionText(d) });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key, undefined, { sensitivity: "base" }));
}

export function filterHardwarePrimariesToDefSubset(primaries: string[], defsUniverse: MaterialCategoryDef[]): string[] {
  const want = new Set(defsUniverse.map((d) => categoryPrimaryFromLabel(d.name)));
  return primaries.filter((p) => want.has(p));
}

export type BuildHardwareFolderGroupArgs = {
  trAllInKind: string;
  trSubAll: string;
  trNoCat: string;
  q: string;
  allRows: ErpCatRow[];
  associations: AssociationRow[];
  matById: Map<string, MaterialPage>;
  materials: MaterialPage[];
  categoryDefs: MaterialCategoryDef[];
  /** null = 全库硬件（ERP）；非 null = 仅这些分类（市场资料） */
  defsUniverse: MaterialCategoryDef[] | null;
  sel: ErpCatalogNavSel;
  applyNav: (next: ErpCatalogNavSel) => void;
  activeKind: ErpStockKind;
  countFor?: (kind: ErpStockKind, primary: string, filterKey: string | null) => number | undefined;
  countForKindAll?: number;
  onHardwarePrimariesReorder: ((next: string[]) => void) | null;
  /** ERP 产品库：与右侧分类树一致的 Manual / A–Z 排序 */
  hardwareNavSortMode?: ErpHardwareNavSortMode;
  /** Distinct from ERP `ErpStockKind` when embedding the same tree in another surface (e.g. brand materials). */
  groupId?: string;
  groupTitle?: string | null;
};

export function buildHardwareMaterialFolderGroup(a: BuildHardwareFolderGroupArgs): MaterialFolderNavGroup {
  const sortMode = a.hardwareNavSortMode ?? "manual";
  const fullPrimaries = listHardwareNavPrimaries(a.allRows, a.categoryDefs, a.materials);
  const basePrimaries = a.defsUniverse
    ? filterHardwarePrimariesToDefSubset(fullPrimaries, a.defsUniverse)
    : fullPrimaries;
  const filtered = a.q.trim()
    ? filterHardwareNavPrimariesForSearch(basePrimaries, a.q, a.associations, a.matById, a.categoryDefs)
    : basePrimaries;
  const primaries = !a.q.trim()
    ? sortHardwareNavPrimariesByMode(filtered, a.categoryDefs, sortMode)
    : filtered;

  const allowDnD =
    Boolean(a.onHardwarePrimariesReorder) && !a.q.trim() && sortMode === "manual";
  const kind: ErpStockKind = "hardware";
  const kindRowSelected = a.activeKind === kind && a.sel.primary === null && a.sel.filterKey === null;
  const primaryOrAllInPrimaryOn = (p: string) =>
    a.activeKind === kind && a.sel.primary === p && a.sel.filterKey == null;
  const subRowOn = (fk: string) => a.activeKind === kind && a.sel.filterKey === fk;

  const rows: MaterialFolderNavRow[] = [
    {
      id: `${kind}:all`,
      label: a.trAllInKind,
      count: a.countForKindAll,
      iconKey: null,
      selected: kindRowSelected,
      onClick: () => a.applyNav({ primary: null, filterKey: null }),
    },
  ];

  if (primaries.length === 0) {
    rows.push({
      id: `${kind}:empty`,
      label: a.trNoCat,
      iconKey: null,
      selected: false,
      action: "label",
      onClick: () => {},
    });
  } else {
    const subsFor = (p: string) =>
      a.defsUniverse
        ? listDefSecondariesForPrimary(a.defsUniverse, p)
        : listSecondariesForPrimary(a.allRows, kind, p);

    for (const p of primaries) {
      const isP = a.sel.primary === p;
      const rawSubs = isP ? subsFor(p) : [];
      const subs = orderHardwareSecondariesForNav(rawSubs, a.categoryDefs, sortMode);
      const cMain = a.countFor?.(kind, p, null);
      rows.push({
        id: `${kind}:p:${p}`,
        label: hardwareNavPrimaryLabel(p, a.categoryDefs),
        count: cMain,
        iconKey: iconKeyForHardwareNavPrimary(p, a.categoryDefs),
        selected: primaryOrAllInPrimaryOn(p),
        onClick: () => a.applyNav({ primary: p, filterKey: null }),
      });
      if (isP && subs.length > 0) {
        rows.push({
          id: `${kind}:suball:${p}`,
          label: a.trSubAll,
          count: a.countFor?.(kind, p, null),
          iconKey: null,
          indent: 1,
          dense: true,
          selected: primaryOrAllInPrimaryOn(p),
          onClick: () => a.applyNav({ primary: p, filterKey: null }),
        });
        for (const sub of subs) {
          const cSub = a.countFor?.(kind, p, sub.key);
          const subDef = a.categoryDefs.find((d) => d.name === sub.key);
          const subLabel = subDef ? categoryOptionText(subDef) : sub.label;
          rows.push({
            id: `${kind}:sub:${sub.key}`,
            label: subLabel,
            count: cSub,
            iconKey: null,
            indent: 1,
            dense: true,
            selected: subRowOn(sub.key),
            onClick: () => a.applyNav({ primary: p, filterKey: sub.key }),
          });
        }
      }
    }
  }

  return {
    id: a.groupId ?? kind,
    title: a.groupTitle !== undefined ? a.groupTitle : null,
    defaultOpen: true,
    rows,
    hardwareSortablePrimaries: allowDnD && a.onHardwarePrimariesReorder ? primaries : null,
    onHardwarePrimariesReorder: allowDnD && a.onHardwarePrimariesReorder ? a.onHardwarePrimariesReorder : undefined,
  };
}
