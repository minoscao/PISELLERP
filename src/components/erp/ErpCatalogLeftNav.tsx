import { useMemo, useState, type ReactNode } from "react";
import { useQuoteStore } from "../../store/quoteStore";
import type { ErpCatalogNavSel, ErpStockKind, MaterialCategoryDef } from "../../types";
import { useT } from "../../i18n/useT";
import { buildHardwareMaterialFolderGroup } from "../CatalogHardwareNavGroup";
import {
  buildHardwareCatRows,
  buildServiceCatRows,
  buildSoftwareCatRows,
  filterServiceNavPrimariesForSearch,
  filterSoftwareNavPrimariesForSearch,
  listHardwareNavPrimaries,
  listSecondariesForPrimary,
  listServiceNavPrimaries,
  listSoftwareNavPrimaries,
  mergeHardwarePrimarySubsetOrder,
  sortCatalogPrimariesUncategorizedFirst,
  type ErpCatRow,
} from "../../utils/erpCatalogCategories";
import { categoryOptionText } from "../../utils/categoryDisplay";
import { MaterialFolderNav, type MaterialFolderNavGroup, type MaterialFolderNavRow } from "../MaterialFolderNav";

/** @deprecated */
export type ErpKindSel = ErpCatalogNavSel;

type ErpCatalogLeftNavProps = {
  topSlot?: ReactNode;
  countFor?: (kind: ErpStockKind, primary: string, filterKey: string | null) => number | undefined;
  countForKindAll?: (kind: ErpStockKind) => number | undefined;
  onNavigate?: () => void;
  className?: string;
  /** 市场资料等：仅展示该子集分类，仍与全库 `categoryDefs` 顺序一致 */
  hardwareDefsUniverse?: MaterialCategoryDef[] | null;
  hardwareNavSel?: ErpCatalogNavSel;
  onHardwareNavSelChange?: (next: ErpCatalogNavSel) => void;
  hardwareFolderSearchQuery?: string;
  hardwareRowEnhancer?: (row: MaterialFolderNavRow) => MaterialFolderNavRow;
};

export function ErpCatalogLeftNav({
  topSlot,
  countFor,
  countForKindAll,
  onNavigate,
  className = "",
  hardwareDefsUniverse = null,
  hardwareNavSel: hardwareNavSelProp,
  onHardwareNavSelChange,
  hardwareFolderSearchQuery,
  hardwareRowEnhancer,
}: ErpCatalogLeftNavProps) {
  const tr = useT();
  const associations = useQuoteStore((s) => s.associations);
  const softwareFeatures = useQuoteStore((s) => s.softwareFeatures);
  const serviceItems = useQuoteStore((s) => s.serviceItems);
  const materials = useQuoteStore((s) => s.materials);
  const categoryDefs = useQuoteStore((s) => s.categoryDefs);
  const erpCatalogSearchQuery = useQuoteStore((s) => s.erpCatalogSearchQuery);
  const activeKind = useQuoteStore((s) => s.erpCatalogActiveKind);
  const sel = useQuoteStore((s) => s.erpCatalogSel);
  const setErpCatalogKindFilter = useQuoteStore((s) => s.setErpCatalogKindFilter);
  const reorderHardwareCategoryPrimaries = useQuoteStore((s) => s.reorderHardwareCategoryPrimaries);
  const erpHardwareNavSortMode = useQuoteStore((s) => s.erpHardwareNavSortMode);
  const setErpHardwareNavSortMode = useQuoteStore((s) => s.setErpHardwareNavSortMode);

  const qHardware = hardwareFolderSearchQuery !== undefined ? hardwareFolderSearchQuery : erpCatalogSearchQuery;
  const hwSel = hardwareNavSelProp ?? sel.hardware;

  const applyNav = (kind: ErpStockKind, next: ErpCatalogNavSel) => {
    setErpCatalogKindFilter(kind, next);
    onNavigate?.();
  };

  const applyHardwareNav = (next: ErpCatalogNavSel) => {
    if (onHardwareNavSelChange) onHardwareNavSelChange(next);
    else applyNav("hardware", next);
  };

  const matById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const allRows: ErpCatRow[] = useMemo(
    () => [
      ...buildHardwareCatRows(associations, matById, categoryDefs),
      ...buildSoftwareCatRows(softwareFeatures),
      ...buildServiceCatRows(serviceItems),
    ],
    [associations, matById, categoryDefs, softwareFeatures, serviceItems],
  );

  const hardwarePrimariesFull = useMemo(
    () => listHardwareNavPrimaries(allRows, categoryDefs, materials),
    [allRows, categoryDefs, materials],
  );

  const onHardwarePrimariesReorder = useMemo(() => {
    if (qHardware.trim()) return null;
    if (hardwareDefsUniverse) {
      return (subsetNext: string[]) => {
        reorderHardwareCategoryPrimaries(mergeHardwarePrimarySubsetOrder(hardwarePrimariesFull, subsetNext));
      };
    }
    return (next: string[]) => reorderHardwareCategoryPrimaries(next);
  }, [qHardware, hardwareDefsUniverse, hardwarePrimariesFull, reorderHardwareCategoryPrimaries]);

  const [expanded, setExpanded] = useState<Record<ErpStockKind, boolean>>({
    hardware: true,
    software: true,
    service: true,
  });

  const kindRowSelected = (kind: ErpStockKind) =>
    activeKind === kind && sel[kind].primary === null && sel[kind].filterKey === null;

  const primaryOrAllInPrimaryOn = (kind: ErpStockKind, p: string) => {
    const s = sel[kind];
    return activeKind === kind && s.primary === p && s.filterKey == null;
  };

  const navPrimaries = (kind: ErpStockKind): string[] => {
    if (kind === "hardware") return listHardwareNavPrimaries(allRows, categoryDefs, materials);
    if (kind === "software") return listSoftwareNavPrimaries(allRows);
    return listServiceNavPrimaries(allRows);
  };

  const subRowOn = (kind: ErpStockKind, fk: string) => {
    const s = sel[kind];
    return activeKind === kind && s.filterKey === fk;
  };

  const hardwareGroup = useMemo((): MaterialFolderNavGroup => {
    const g = buildHardwareMaterialFolderGroup({
      trAllInKind: tr("mat.allInKind"),
      trSubAll: tr("erp.subAllInPrimary"),
      trNoCat: tr("erp.noCategories"),
      q: qHardware.trim(),
      allRows,
      associations,
      matById,
      materials,
      categoryDefs,
      defsUniverse: hardwareDefsUniverse,
      sel: hwSel,
      applyNav: applyHardwareNav,
      activeKind: hardwareDefsUniverse ? "hardware" : activeKind,
      countFor,
      countForKindAll: countForKindAll?.("hardware"),
      onHardwarePrimariesReorder,
      hardwareNavSortMode: hardwareDefsUniverse ? "manual" : erpHardwareNavSortMode,
      groupId: hardwareDefsUniverse ? "brand-hw" : "hardware",
      groupTitle: hardwareDefsUniverse ? null : tr("erp.colKindHardware"),
    });
    if (hardwareRowEnhancer) {
      return { ...g, rows: g.rows.map((r) => hardwareRowEnhancer(r)) };
    }
    return g;
  }, [
    tr,
    qHardware,
    allRows,
    associations,
    matById,
    materials,
    categoryDefs,
    hardwareDefsUniverse,
    hwSel,
    activeKind,
    countFor,
    countForKindAll,
    onHardwarePrimariesReorder,
    erpHardwareNavSortMode,
    hardwareRowEnhancer,
  ]);

  const groups: MaterialFolderNavGroup[] = useMemo(() => {
    if (hardwareDefsUniverse) {
      return [hardwareGroup];
    }
    const q = erpCatalogSearchQuery.trim();
    const out: MaterialFolderNavGroup[] = [hardwareGroup];

    for (const kind of ["software", "service"] as const) {
      const base = sortCatalogPrimariesUncategorizedFirst(navPrimaries(kind));
      const primaries =
        kind === "software"
          ? q
            ? filterSoftwareNavPrimariesForSearch(base, q, allRows)
            : base
          : q
            ? filterServiceNavPrimariesForSearch(base, q, allRows)
            : base;
      const s = sel[kind];
      const cHead = countForKindAll?.(kind);
      const rows: MaterialFolderNavGroup["rows"] = [
        {
          id: `${kind}:all`,
          label: tr("mat.allInKind"),
          count: cHead,
          iconKey: null,
          selected: kindRowSelected(kind),
          onClick: () => applyNav(kind, { primary: null, filterKey: null }),
        },
      ];
      if (primaries.length === 0) {
        rows.push({
          id: `${kind}:empty`,
          label: tr("erp.noCategories"),
          iconKey: null,
          selected: false,
          action: "label",
          onClick: () => {},
        });
      } else {
        for (const p of primaries) {
          const isP = s.primary === p;
          const subs = isP ? listSecondariesForPrimary(allRows, kind, p) : [];
          const cMain = countFor?.(kind, p, null);
          rows.push({
            id: `${kind}:p:${p}`,
            label: p,
            count: cMain,
            iconKey: null,
            selected: primaryOrAllInPrimaryOn(kind, p),
            onClick: () => applyNav(kind, { primary: p, filterKey: null }),
          });
          if (isP && subs.length > 0) {
            rows.push({
              id: `${kind}:suball:${p}`,
              label: tr("erp.subAllInPrimary"),
              count: countFor?.(kind, p, null),
              iconKey: null,
              indent: 1,
              dense: true,
              selected: primaryOrAllInPrimaryOn(kind, p),
              onClick: () => applyNav(kind, { primary: p, filterKey: null }),
            });
            for (const sub of subs) {
              const cSub = countFor?.(kind, p, sub.key);
              const subDef = categoryDefs.find((d) => d.name === sub.key);
              const subLabel = subDef ? categoryOptionText(subDef) : sub.label;
              rows.push({
                id: `${kind}:sub:${sub.key}`,
                label: subLabel,
                count: cSub,
                iconKey: null,
                indent: 1,
                dense: true,
                selected: subRowOn(kind, sub.key),
                onClick: () => applyNav(kind, { primary: p, filterKey: sub.key }),
              });
            }
          }
        }
      }
      out.push({
        id: kind,
        title: kind === "software" ? tr("erp.colKindSoftware") : tr("erp.colKindService"),
        defaultOpen: expanded[kind],
        rows,
      });
    }
    return out;
  }, [
    hardwareDefsUniverse,
    hardwareGroup,
    erpCatalogSearchQuery,
    allRows,
    categoryDefs,
    countFor,
    countForKindAll,
    activeKind,
    sel,
    expanded,
    tr,
    navPrimaries,
    primaryOrAllInPrimaryOn,
    subRowOn,
    kindRowSelected,
    applyNav,
  ]);

  const sortToggle =
    hardwareDefsUniverse == null ? (
      <div className="mb-1.5 flex shrink-0 items-center gap-1 px-1.5 pt-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-app-muted">{tr("erp.navSortLabel")}</span>
        <button
          type="button"
          onClick={() => setErpHardwareNavSortMode("manual")}
          className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
            erpHardwareNavSortMode === "manual"
              ? "border-app-tone/60 bg-app-tone/15 text-app-text"
              : "border-app-line-subtle text-app-muted hover:bg-app-surface-2"
          }`}
        >
          {tr("erp.navSortManual")}
        </button>
        <button
          type="button"
          onClick={() => setErpHardwareNavSortMode("az")}
          className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
            erpHardwareNavSortMode === "az"
              ? "border-app-tone/60 bg-app-tone/15 text-app-text"
              : "border-app-line-subtle text-app-muted hover:bg-app-surface-2"
          }`}
        >
          {tr("erp.navSortAz")}
        </button>
      </div>
    ) : null;

  const combinedTopSlot =
    sortToggle || topSlot ? (
      <>
        {sortToggle}
        {topSlot}
      </>
    ) : undefined;

  return (
    <MaterialFolderNav
      className={className}
      topSlot={combinedTopSlot}
      groups={groups}
      expandedByGroupId={hardwareDefsUniverse ? null : expanded}
      onExpandedChange={hardwareDefsUniverse ? undefined : (id, next) => setExpanded((e) => ({ ...e, [id as ErpStockKind]: next }))}
    />
  );
}
