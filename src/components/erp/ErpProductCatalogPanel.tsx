import { useCallback, useEffect, useMemo, useState } from "react";
import { useT } from "../../i18n/useT";
import { useQuoteStore } from "../../store/quoteStore";
import type { ErpStockKind } from "../../types";
import {
  buildHardwareCatRows,
  buildServiceCatRows,
  buildSoftwareCatRows,
  filterCatRows,
  listServiceNavPrimaries,
} from "../../utils/erpCatalogCategories";
import { materialMatchesErpKindAll, materialMatchesErpProductNav } from "../../utils/erpProductMaterialFilter";
import { RelationsPanel } from "../RelationsPanel";
import { ServicesPanel } from "../ServicesPanel";
import { SoftwareLibraryPanel } from "../SoftwareLibraryPanel";
import { AddCategoryFolderFooter } from "../AddCategoryFolderFooter";
import { CategoryDefLibraryModal } from "../CategoryDefLibraryModal";
import { ErpCatalogResizableLayout } from "./ErpCatalogResizableLayout";
import { ErpCatalogLeftNav } from "./ErpCatalogLeftNav";
import { ErpCatalogSearchToolbar } from "./ErpCatalogSearchToolbar";

export function ErpProductCatalogPanel() {
  const t = useT();
  const [catLibOpen, setCatLibOpen] = useState(false);
  const addCategory = useQuoteStore((s) => s.addCategory);
  const focus = useQuoteStore((s) => s.erpCatalogFocus);
  const setErpCatalogFocus = useQuoteStore((s) => s.setErpCatalogFocus);
  const setErpCatalogKindFilter = useQuoteStore((s) => s.setErpCatalogKindFilter);
  const activeKind = useQuoteStore((s) => s.erpCatalogActiveKind);
  const materials = useQuoteStore((s) => s.materials);
  const associations = useQuoteStore((s) => s.associations);
  const categoryDefs = useQuoteStore((s) => s.categoryDefs);
  const softwareFeatures = useQuoteStore((s) => s.softwareFeatures);
  const serviceItems = useQuoteStore((s) => s.serviceItems);

  const matById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);
  const allErpRows = useMemo(
    () => [
      ...buildHardwareCatRows(associations, matById, categoryDefs),
      ...buildSoftwareCatRows(softwareFeatures),
      ...buildServiceCatRows(serviceItems),
    ],
    [associations, matById, categoryDefs, softwareFeatures, serviceItems],
  );

  const inTab = useMemo(
    () =>
      materials.filter(
        (m) => m.imageKind === "technical" || m.imageKind === "softwareDoc" || m.imageKind === "product",
      ),
    [materials],
  );

  const servicePrimarySet = useMemo(() => new Set(listServiceNavPrimaries(allErpRows)), [allErpRows]);

  const productNavCount = useCallback(
    (kind: ErpStockKind, primary: string, filterKey: string | null) => {
      if (kind === "hardware") {
        return inTab.filter((m) => materialMatchesErpProductNav(m, kind, primary, filterKey)).length;
      }
      return filterCatRows(allErpRows, kind, primary, filterKey).length;
    },
    [inTab, allErpRows],
  );

  const productKindAllCount = useCallback(
    (kind: ErpStockKind) => {
      if (kind === "hardware") {
        return inTab.filter((m) => materialMatchesErpKindAll(m, kind, servicePrimarySet)).length;
      }
      return allErpRows.filter((r) => r.kind === kind).length;
    },
    [inTab, servicePrimarySet, allErpRows],
  );

  useEffect(() => {
    if (!focus) return;
    setErpCatalogKindFilter(focus, { primary: null, filterKey: null });
    setErpCatalogFocus(null);
  }, [focus, setErpCatalogKindFilter, setErpCatalogFocus]);

  const leftNav = (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-app-panel-border bg-app-panel-bg">
      <ErpCatalogSearchToolbar />
      <div className="shrink-0 border-b border-app-line-subtle px-2 py-2 text-xs font-semibold uppercase tracking-wide text-app-muted">
        {t("erp.catalogFolders")}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-1.5">
        <ErpCatalogLeftNav className="flex min-h-0 flex-1 flex-col overflow-hidden" countFor={productNavCount} countForKindAll={productKindAllCount} />
        <AddCategoryFolderFooter
          onAdd={(nameZh, nameEn) => addCategory(nameZh, "device", nameEn)}
          onOpenCategoryLibrary={() => setCatLibOpen(true)}
        />
        <CategoryDefLibraryModal open={catLibOpen} onClose={() => setCatLibOpen(false)} />
      </div>
    </div>
  );

  const mid = (
    <div className="flex h-full min-h-0 min-w-0 flex-col p-1 sm:p-2">
      {activeKind === "hardware" ? (
        <RelationsPanel hideModuleHeader erpListOnly erpCompactEditor />
      ) : null}
      {activeKind === "software" ? (
        <SoftwareLibraryPanel hideModuleHeader erpListOnly erpCompactEditor />
      ) : null}
      {activeKind === "service" ? (
        <ServicesPanel hideModuleHeader erpListOnly erpCompactEditor />
      ) : null}
    </div>
  );

  const rightPanel =
    activeKind === "hardware" ? (
      <RelationsPanel hideModuleHeader erpEditorOnly erpCompactEditor />
    ) : activeKind === "software" ? (
      <SoftwareLibraryPanel hideModuleHeader erpEditorOnly erpCompactEditor />
    ) : (
      <ServicesPanel hideModuleHeader erpEditorOnly erpCompactEditor />
    );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ErpCatalogResizableLayout
        storageKey="erp-catalog-panes"
        minLeft={200}
        minMiddle={200}
        minRight={320}
        left={leftNav}
        middle={mid}
        right={rightPanel}
      />
    </div>
  );
}
