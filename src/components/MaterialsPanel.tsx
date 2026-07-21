import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LEGACY_SOFTWARE_MATERIAL_PREFIX, SOFTWARE_MATERIAL_PREFIX } from "../constants/softwareMaterialPaths";
import { useT } from "../i18n/useT";
import { splitFileToMaterialPages } from "../utils/pdfPages";
import { useQuoteStore } from "../store/quoteStore";
import type {
  ErpStockKind,
  MaterialCategoryDef,
  MaterialImageKind,
  MaterialPage,
  MaterialsLibraryTab,
} from "../types";
import { getProductMaterialCategoryParentKeys } from "../constants/defaultMaterialCategories";
import { UNCATEGORIZED_CATEGORY_NAME } from "../constants/materialCategories";
import { MATERIAL_KIND_LABEL } from "../utils/materialKinds";
import { categoryOptionText } from "../utils/categoryDisplay";
import { categoryLeafLabel, categoryParentKey } from "../utils/categoryFolder";
import { softwareFeatureMaterialCategory } from "../utils/softwareFeatureCategory";
import {
  buildHardwareCatRows,
  buildServiceCatRows,
  buildSoftwareCatRows,
  categoryPrimaryFromLabel,
  hardwareNavPrimaryLabel,
  listServiceNavPrimaries,
  resolveHardwareCategoryNameForNav,
} from "../utils/erpCatalogCategories";
import { materialMatchesErpKindAll, materialMatchesErpProductNav } from "../utils/erpProductMaterialFilter";
import { AddCategoryFolderFooter } from "./AddCategoryFolderFooter";
import { CategoryDefLibraryModal } from "./CategoryDefLibraryModal";
import { ErpCatalogLeftNav } from "./erp/ErpCatalogLeftNav";
import { MaterialFolderNav, type MaterialFolderNavRow } from "./MaterialFolderNav";
import { PhotoUploadModal } from "./PhotoUploadModal";

const DND_MATERIAL_IDS = "application/x-marketing-material-ids-v1";
const DND_CATEGORY_NAME = "application/x-marketing-category-name-v1";
const DND_CATEGORY_PRIMARY = "application/x-marketing-category-primary-v1";

function materialTime(m: MaterialPage): number {
  return typeof m.createdAt === "number" && m.createdAt > 0 ? m.createdAt : 0;
}

function formatTimeLabel(ts: number): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "—";
  }
}

function baseNameWithoutExt(fileName: string): string {
  const n = (fileName || "").trim();
  const dot = n.lastIndexOf(".");
  const raw = dot > 0 ? n.slice(0, dot) : n;
  const cleaned = raw.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || "PDF";
}

/** 品牌区：排除「只被产品类素材占用」的文件夹（如误建在品牌里的「新设备 3」） */
function brandCategoryAllowedByUsage(d: MaterialCategoryDef, allMaterials: MaterialPage[]): boolean {
  if (d.name === UNCATEGORIZED_CATEGORY_NAME) return true;
  const usedByQuoteAd = allMaterials.some((m) => m.imageKind === "quoteAd" && m.category === d.name);
  const usedByProduct = allMaterials.some(
    (m) =>
      (m.imageKind === "technical" || m.imageKind === "softwareDoc" || m.imageKind === "product") &&
      m.category === d.name,
  );
  return !(usedByProduct && !usedByQuoteAd);
}

export function MaterialsPanel() {
  const t = useT();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const libraryTab = useQuoteStore((s) => s.materialsLibraryTab);
  const setMaterialsLibraryTab = useQuoteStore((s) => s.setMaterialsLibraryTab);
  const brandNavSel = useQuoteStore((s) => s.materialsBrandNavSel);
  const setMaterialsBrandNavSel = useQuoteStore((s) => s.setMaterialsBrandNavSel);
  const prevMaterialsLibraryTab = useRef<MaterialsLibraryTab | null>(null);
  const [catLibOpen, setCatLibOpen] = useState(false);
  /** 产品：与产品库共用 store 左侧筛选；为 true 时忽略筛选显示全部产品类素材 */
  const [matViewAll, setMatViewAll] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"name" | "time">("time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  /** 列数越少单格越大，用于预览缩放 */
  const [gridCols, setGridCols] = useState(3);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveSearch, setMoveSearch] = useState("");
  const [moveTargetCategory, setMoveTargetCategory] = useState("");

  const uploadMaterialKind: MaterialImageKind = libraryTab === "brand" ? "quoteAd" : "technical";

  const materials = useQuoteStore((s) => s.materials);
  const categoryDefs = useQuoteStore((s) => s.categoryDefs);
  const associations = useQuoteStore((s) => s.associations);
  const softwareFeatures = useQuoteStore((s) => s.softwareFeatures);
  const serviceItems = useQuoteStore((s) => s.serviceItems);
  const addMaterials = useQuoteStore((s) => s.addMaterials);
  const addCategory = useQuoteStore((s) => s.addCategory);
  const renameCategoryDef = useQuoteStore((s) => s.renameCategoryDef);
  const removeCategory = useQuoteStore((s) => s.removeCategory);
  const removeMaterial = useQuoteStore((s) => s.removeMaterial);
  const setMaterialCategory = useQuoteStore((s) => s.setMaterialCategory);
  const erpCatalogActiveKind = useQuoteStore((s) => s.erpCatalogActiveKind);
  const erpCatalogSel = useQuoteStore((s) => s.erpCatalogSel);
  const resetErpCatalogNavFilters = useQuoteStore((s) => s.resetErpCatalogNavFilters);

  useEffect(() => {
    const prev = prevMaterialsLibraryTab.current;
    prevMaterialsLibraryTab.current = libraryTab;
    if (prev === null) return;
    setMaterialsBrandNavSel({ primary: null, filterKey: null });
    setSearch("");
    if (libraryTab === "product" && prev !== "product") {
      setMatViewAll(true);
      resetErpCatalogNavFilters();
    }
  }, [libraryTab, resetErpCatalogNavFilters, setMaterialsBrandNavSel]);

  const matById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);
  const allErpRows = useMemo(
    () => [
      ...buildHardwareCatRows(associations, matById, categoryDefs),
      ...buildSoftwareCatRows(softwareFeatures),
      ...buildServiceCatRows(serviceItems),
    ],
    [associations, matById, categoryDefs, softwareFeatures, serviceItems],
  );

  /** 品牌：仅手动上传的 quoteAd；产品：与硬件/软件/设备产品图相关，用于资料与手册组合 */
  const inTab = useMemo(() => {
    if (libraryTab === "brand") return materials.filter((m) => m.imageKind === "quoteAd");
    return materials.filter(
      (m) => m.imageKind === "technical" || m.imageKind === "softwareDoc" || m.imageKind === "product",
    );
  }, [materials, libraryTab]);

  const categoryRowsForBrand = useMemo((): MaterialCategoryDef[] => {
    const productParents = getProductMaterialCategoryParentKeys();
    const hwNames = new Set(associations.map((a) => a.hardwareName.trim()).filter(Boolean));
    const swCats = new Set(softwareFeatures.map((f) => softwareFeatureMaterialCategory(f)));
    return categoryDefs
      .filter((d) => {
        if (hwNames.has(d.name)) return false;
        if (swCats.has(d.name)) return false;
        const par = categoryParentKey(d.name);
        if (productParents.has(par)) return false;
        if (par === SOFTWARE_MATERIAL_PREFIX || par === LEGACY_SOFTWARE_MATERIAL_PREFIX) return false;
        if (d.name.startsWith(`${SOFTWARE_MATERIAL_PREFIX} ·`) || d.name.startsWith(`${LEGACY_SOFTWARE_MATERIAL_PREFIX} ·`))
          return false;
        return true;
      })
      .filter((d) => brandCategoryAllowedByUsage(d, materials));
  }, [categoryDefs, associations, softwareFeatures, materials]);

  /** 产品 Tab 卡片下拉可切换到的全部分类名（全路径/软件路径/硬件名） */
  const productSelectCategories = useMemo((): MaterialCategoryDef[] => {
    const seen = new Set<string>();
    const rows: MaterialCategoryDef[] = [];
    const push = (name: string, def?: MaterialCategoryDef) => {
      const n = name.trim();
      if (!n || seen.has(n)) return;
      seen.add(n);
      rows.push(def ?? { name: n, iconKey: "device" });
    };
    for (const d of categoryDefs) push(d.name, d);
    for (const a of associations) push(a.hardwareName.trim());
    for (const f of softwareFeatures) {
      if (!f.featureName.trim()) continue;
      push(softwareFeatureMaterialCategory(f));
    }
    return rows;
  }, [categoryDefs, associations, softwareFeatures]);

  const servicePrimarySet = useMemo(() => new Set(listServiceNavPrimaries(allErpRows)), [allErpRows]);

  const productNavCount = useCallback(
    (kind: ErpStockKind, primary: string, filterKey: string | null) => {
      if (libraryTab !== "product") return undefined;
      return inTab.filter((m) => materialMatchesErpProductNav(m, kind, primary, filterKey)).length;
    },
    [libraryTab, inTab],
  );

  const productKindAllCount = useCallback(
    (kind: ErpStockKind) => {
      if (libraryTab !== "product") return undefined;
      return inTab.filter((m) => materialMatchesErpKindAll(m, kind, servicePrimarySet)).length;
    },
    [libraryTab, inTab, servicePrimarySet],
  );

  const uploadTargetCategory = useMemo(() => {
    if (libraryTab === "brand") {
      const r = resolveHardwareCategoryNameForNav(brandNavSel.primary, brandNavSel.filterKey, categoryRowsForBrand);
      return r ?? categoryRowsForBrand[0]?.name ?? UNCATEGORIZED_CATEGORY_NAME;
    }
    if (matViewAll) {
      return productSelectCategories[0]?.name ?? categoryDefs[0]?.name ?? UNCATEGORIZED_CATEGORY_NAME;
    }
    const k = erpCatalogActiveKind;
    const pr = erpCatalogSel[k].primary;
    const fk = erpCatalogSel[k].filterKey;
    if (!pr) {
      return productSelectCategories[0]?.name ?? UNCATEGORIZED_CATEGORY_NAME;
    }
    const found = productSelectCategories.find((d) =>
      materialMatchesErpProductNav(
        {
          id: "_",
          dataUrl: "",
          widthPx: 0,
          heightPx: 0,
          fileName: "",
          sourcePage: 0,
          category: d.name,
          imageKind: "technical",
        },
        k,
        pr,
        fk,
      ),
    );
    if (k === "hardware" && !found) {
      const d = categoryDefs.find((c) => categoryPrimaryFromLabel(c.name) === pr);
      if (d) return d.name;
    }
    return found?.name ?? productSelectCategories[0]?.name ?? UNCATEGORIZED_CATEGORY_NAME;
  }, [
    libraryTab,
    matViewAll,
    erpCatalogActiveKind,
    erpCatalogSel,
    brandNavSel,
    categoryRowsForBrand,
    productSelectCategories,
    categoryDefs,
  ]);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = inTab;
    if (libraryTab === "brand") {
      const fk = brandNavSel.filterKey;
      const pr = brandNavSel.primary;
      if (fk) {
        list = list.filter((m) => m.category === fk);
      } else if (pr) {
        list = list.filter((m) =>
          categoryRowsForBrand.some(
            (d) => d.name === m.category && categoryPrimaryFromLabel(d.name) === pr,
          ),
        );
      }
    }
    if (libraryTab === "product" && !matViewAll) {
      const k = erpCatalogActiveKind;
      const pr = erpCatalogSel[k].primary;
      const fk = erpCatalogSel[k].filterKey;
      if (pr) {
        list = list.filter((m) => materialMatchesErpProductNav(m, k, pr, fk));
      } else {
        list = list.filter((m) => materialMatchesErpKindAll(m, k, servicePrimarySet));
      }
    }
    if (q) {
      list = list.filter(
        (m) =>
          m.fileName.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          MATERIAL_KIND_LABEL[m.imageKind].toLowerCase().includes(q),
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "name") {
        const c = a.fileName.localeCompare(b.fileName, "zh-Hans-CN");
        return c !== 0 ? c * dir : (materialTime(a) - materialTime(b)) * dir;
      }
      const ta = materialTime(a);
      const tb = materialTime(b);
      if (ta !== tb) return (ta - tb) * dir;
      return a.fileName.localeCompare(b.fileName, "zh-Hans-CN") * dir;
    });
  }, [
    inTab,
    brandNavSel,
    categoryRowsForBrand,
    libraryTab,
    matViewAll,
    erpCatalogActiveKind,
    erpCatalogSel,
    servicePrimarySet,
    search,
    sortKey,
    sortDir,
  ]);

  useEffect(() => {
    const visible = new Set(filteredList.map((m) => m.id));
    setSelectedIds((prev) => prev.filter((id) => visible.has(id)));
  }, [filteredList]);

  const moveTargetDefs = useMemo(() => {
    const base = libraryTab === "brand" ? categoryRowsForBrand : productSelectCategories;
    const byName = new Map(base.map((d) => [d.name, d] as const));
    for (const m of filteredList) {
      if (!byName.has(m.category)) byName.set(m.category, { name: m.category, iconKey: "device", nameEn: m.category });
    }
    const q = moveSearch.trim().toLowerCase();
    const defs = [...byName.values()].filter((d) => {
      if (!q) return true;
      const text = `${d.name} ${categoryOptionText(d)} ${categoryPrimaryFromLabel(d.name)}`.toLowerCase();
      return text.includes(q);
    });
    const groups = new Map<string, MaterialCategoryDef[]>();
    for (const d of defs) {
      const p = categoryPrimaryFromLabel(d.name);
      if (!groups.has(p)) groups.set(p, []);
      groups.get(p)!.push(d);
    }
    return [...groups.entries()]
      .map(([primary, defsIn]) => ({
        primary,
        defs: defsIn.sort((a, b) => categoryOptionText(a).localeCompare(categoryOptionText(b), "zh-Hans-CN")),
      }))
      .sort((a, b) => a.primary.localeCompare(b.primary, "zh-Hans-CN"));
  }, [libraryTab, categoryRowsForBrand, productSelectCategories, filteredList, moveSearch]);

  const gcd = (a: number, b: number) => {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x || 1;
  };

  const onFiles = async (files: File[]) => {
    if (!files.length) return;
    setErr(null);
    setBusy(true);
    try {
      for (const f of files) {
        const lower = (f.name || "").toLowerCase();
        const isPdf = lower.endsWith(".pdf") || f.type === "application/pdf";
        const pdfBase = isPdf ? baseNameWithoutExt(f.name) : "";
        const pdfGroupCategory = isPdf ? `${uploadTargetCategory} · ${pdfBase}` : uploadTargetCategory;
        if (isPdf) {
          addCategory(pdfGroupCategory, "device");
        }
        const mats = useQuoteStore.getState().materials;
        const startSerial = mats.filter((m) => m.imageKind === uploadMaterialKind).length + 1;
        const pages = await splitFileToMaterialPages(
          f,
          pdfGroupCategory,
          uploadMaterialKind,
          startSerial,
        );
        addMaterials(
          isPdf
            ? pages.map((p, i) => ({
                ...p,
                fileName: `${pdfBase}-P${i + 1}.jpg`,
              }))
            : pages,
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("mat.importErr"));
      throw e instanceof Error ? e : new Error(t("mat.importErr"));
    } finally {
      setBusy(false);
    }
  };

  const onDeleteCategory = (name: string) => {
    if (name === UNCATEGORIZED_CATEGORY_NAME) return;
    const ok = window.confirm(
      t("mat.deleteCatConfirm", { name, uncat: t("cat.uncategorized") }),
    );
    if (!ok) return;
    removeCategory(name);
    if (brandNavSel.filterKey === name) setMaterialsBrandNavSel({ primary: null, filterKey: null });
  };

  const toggleMaterialSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAllVisible = () => {
    const ids = filteredList.map((m) => m.id);
    if (!ids.length) return;
    const allPicked = ids.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) => {
      if (allPicked) return prev.filter((id) => !ids.includes(id));
      const set = new Set(prev);
      ids.forEach((id) => set.add(id));
      return [...set];
    });
  };

  const selectAllFiltered = () => {
    const ids = filteredList.map((m) => m.id);
    if (!ids.length) return;
    setSelectedIds(ids);
  };

  const clearSelected = () => setSelectedIds([]);

  const moveSelectedToCategory = (targetCategory: string) => {
    const cat = targetCategory.trim();
    if (!selectedIds.length || !cat) return;
    for (const id of selectedIds) {
      setMaterialCategory(id, cat);
    }
    setSelectedIds([]);
  };

  const openMoveModal = () => {
    if (!selectedIds.length) return;
    const first = filteredList.find((m) => m.id === selectedIds[0]);
    setMoveTargetCategory(first?.category ?? "");
    setMoveSearch("");
    setMoveModalOpen(true);
  };

  const confirmMoveModal = () => {
    if (!moveTargetCategory) return;
    moveSelectedToCategory(moveTargetCategory);
    setMoveModalOpen(false);
  };

  const deleteSelected = () => {
    if (!selectedIds.length) return;
    const ok = window.confirm(t("mat.deleteSelectedConfirm", { n: selectedIds.length }));
    if (!ok) return;
    for (const id of selectedIds) {
      removeMaterial(id);
    }
    setSelectedIds([]);
  };

  const uniqueCategoryName = useCallback(
    (candidate: string, used: Set<string>) => {
      let name = candidate.trim();
      if (!name) name = candidate;
      if (!used.has(name)) {
        used.add(name);
        return name;
      }
      let i = 2;
      while (used.has(`${name} (${i})`)) i += 1;
      const out = `${name} (${i})`;
      used.add(out);
      return out;
    },
    [],
  );

  const moveCategoryToPrimary = useCallback(
    (sourceCategory: string, targetPrimary: string) => {
      const source = (sourceCategory || "").trim();
      const target = (targetPrimary || "").trim();
      if (!source || !target) return;
      if (source === UNCATEGORIZED_CATEGORY_NAME) return;
      const sourcePrimary = categoryPrimaryFromLabel(source);
      if (sourcePrimary === target) return;
      const leaf = categoryLeafLabel(source).trim() || source;
      const used = new Set(categoryDefs.map((d) => d.name));
      used.delete(source);
      const next = uniqueCategoryName(`${target} · ${leaf}`, used);
      renameCategoryDef(source, next);
    },
    [categoryDefs, renameCategoryDef, uniqueCategoryName],
  );

  const movePrimaryToPrimary = useCallback(
    (sourcePrimary: string, targetPrimary: string) => {
      const src = (sourcePrimary || "").trim();
      const tgt = (targetPrimary || "").trim();
      if (!src || !tgt || src === tgt) return;
      const defs = categoryDefs.filter((d) => categoryPrimaryFromLabel(d.name) === src);
      if (!defs.length) return;
      const used = new Set(categoryDefs.map((d) => d.name));
      for (const d of defs) {
        used.delete(d.name);
      }
      for (const d of defs) {
        const leaf = categoryLeafLabel(d.name).trim() || d.name;
        const next = uniqueCategoryName(`${tgt} · ${leaf}`, used);
        renameCategoryDef(d.name, next);
      }
    },
    [categoryDefs, renameCategoryDef, uniqueCategoryName],
  );

  const firstCategoryInPrimary = useCallback(
    (primary: string): string | null => {
      const p = (primary || "").trim();
      if (!p) return null;
      const hit = categoryRowsForBrand.find((d) => categoryPrimaryFromLabel(d.name) === p);
      return hit?.name ?? null;
    },
    [categoryRowsForBrand],
  );

  const parseHardwareRowTargetPrimary = (rowId: string): string | null => {
    if (rowId.startsWith("hardware:p:")) return rowId.slice("hardware:p:".length).trim() || null;
    if (rowId.startsWith("hardware:suball:")) return rowId.slice("hardware:suball:".length).trim() || null;
    if (rowId.startsWith("hardware:sub:")) {
      const cat = rowId.slice("hardware:sub:".length).trim();
      return cat ? categoryPrimaryFromLabel(cat) : null;
    }
    return null;
  };

  const dropMaterialsToCategory = useCallback(
    (ids: string[], targetCategory: string) => {
      const cat = (targetCategory || "").trim();
      if (!ids.length || !cat) return;
      for (const id of ids) {
        setMaterialCategory(id, cat);
      }
      setSelectedIds([]);
    },
    [setMaterialCategory],
  );

  const enhanceBrandHardwareRow = useCallback(
    (row: MaterialFolderNavRow): MaterialFolderNavRow => {
      const id = row.id;
      const targetPrimary = parseHardwareRowTargetPrimary(id);
      if (!targetPrimary) return row;
      const isPrimaryRow = id.startsWith("hardware:p:");
      const isSubRow = id.startsWith("hardware:sub:");
      const sourceCategory = isSubRow ? id.slice("hardware:sub:".length).trim() : null;
      const sourcePrimary = isPrimaryRow ? targetPrimary : null;
      return {
        ...row,
        draggable: isPrimaryRow || isSubRow,
        onDragStart: (e) => {
          if (sourceCategory) e.dataTransfer.setData(DND_CATEGORY_NAME, sourceCategory);
          if (sourcePrimary) e.dataTransfer.setData(DND_CATEGORY_PRIMARY, sourcePrimary);
          e.dataTransfer.effectAllowed = "move";
        },
        onDragOver: (e) => {
          const hasMat = e.dataTransfer.types.includes(DND_MATERIAL_IDS);
          const hasCat = e.dataTransfer.types.includes(DND_CATEGORY_NAME);
          const hasPri = e.dataTransfer.types.includes(DND_CATEGORY_PRIMARY);
          if (hasMat || hasCat || hasPri) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }
        },
        onDrop: (e) => {
          e.preventDefault();
          e.stopPropagation();
          const matRaw = e.dataTransfer.getData(DND_MATERIAL_IDS);
          if (matRaw) {
            try {
              const ids = JSON.parse(matRaw) as string[];
              if (Array.isArray(ids) && ids.length) {
                const targetCategory =
                  id.startsWith("hardware:sub:")
                    ? id.slice("hardware:sub:".length)
                    : firstCategoryInPrimary(targetPrimary) ?? "";
                if (targetCategory) dropMaterialsToCategory(ids, targetCategory);
              }
            } catch {
              /* ignore malformed payload */
            }
            return;
          }
          const srcCat = e.dataTransfer.getData(DND_CATEGORY_NAME).trim();
          if (srcCat) {
            moveCategoryToPrimary(srcCat, targetPrimary);
            return;
          }
          const srcPrimary = e.dataTransfer.getData(DND_CATEGORY_PRIMARY).trim();
          if (srcPrimary) {
            movePrimaryToPrimary(srcPrimary, targetPrimary);
          }
        },
      };
    },
    [dropMaterialsToCategory, firstCategoryInPrimary, moveCategoryToPrimary, movePrimaryToPrimary],
  );

  const selectAllMaterials = () => {
    if (libraryTab === "product") {
      setMatViewAll(true);
      resetErpCatalogNavFilters();
    }
    setMaterialsBrandNavSel({ primary: null, filterKey: null });
  };

  const folderLabel = useCallback(
    (d: MaterialCategoryDef) =>
      d.name === UNCATEGORIZED_CATEGORY_NAME ? t("cat.uncategorized") : categoryOptionText(d),
    [t],
  );

  const brandFilterLabel = useMemo(() => {
    if (libraryTab !== "brand") return "";
    if (!brandNavSel.primary && !brandNavSel.filterKey) return "";
    const n = resolveHardwareCategoryNameForNav(brandNavSel.primary, brandNavSel.filterKey, categoryRowsForBrand);
    const def = n ? categoryRowsForBrand.find((d) => d.name === n) : undefined;
    if (def) return folderLabel(def);
    if (brandNavSel.primary) return hardwareNavPrimaryLabel(brandNavSel.primary, categoryDefs);
    return "—";
  }, [libraryTab, brandNavSel, categoryRowsForBrand, categoryDefs, folderLabel]);

  const productFilterSummary = useMemo(() => {
    if (matViewAll) return null;
    const k = erpCatalogActiveKind;
    const st = erpCatalogSel[k];
    const kindLab =
      k === "hardware" ? t("erp.colKindHardware") : k === "software" ? t("erp.colKindSoftware") : t("erp.colKindService");
    if (!st.primary) return `${kindLab} · ${t("mat.allInKind")}`;
    return `${kindLab} · ${st.primary}${st.filterKey ? ` · ${st.filterKey}` : ""}`;
  }, [matViewAll, erpCatalogActiveKind, erpCatalogSel, t]);

  const quoteAdTotal = useMemo(() => materials.filter((m) => m.imageKind === "quoteAd").length, [materials]);

  const brandQuoteAdCountFor = useCallback(
    (kind: ErpStockKind, primary: string, filterKey: string | null) => {
      if (kind !== "hardware") return undefined;
      const mats = materials.filter((m) => m.imageKind === "quoteAd");
      if (filterKey) return mats.filter((m) => m.category === filterKey).length;
      if (primary) {
        return mats.filter((m) =>
          categoryRowsForBrand.some(
            (d) => d.name === m.category && categoryPrimaryFromLabel(d.name) === primary,
          ),
        ).length;
      }
      return mats.length;
    },
    [materials, categoryRowsForBrand],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3 sm:p-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-app-line-subtle pb-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-app-text">{t("mat.title")}</h2>
        </div>
        <div className="ui-seg text-xs" role="group" aria-label={t("mat.title")}>
          <button
            type="button"
            onClick={() => setMaterialsLibraryTab("brand")}
            className={`ui-segBtn${libraryTab === "brand" ? " ui-segBtn--on" : ""}`}
          >
            {t("mat.brand")}
          </button>
          <button
            type="button"
            onClick={() => setMaterialsLibraryTab("product")}
            className={`ui-segBtn${libraryTab === "product" ? " ui-segBtn--on" : ""}`}
          >
            {t("mat.product")}
          </button>
        </div>
      </div>

      <PhotoUploadModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title={t("photo.matAddTitle")}
        description={t("photo.matAddDesc")}
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf"
        multiple
        busy={busy}
        onConfirmFiles={(files) => onFiles(files)}
      />
      {moveModalOpen ? (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-app-overlay-scrim p-4"
          role="presentation"
          onMouseDown={() => setMoveModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-app-line-strong bg-app-surface p-4 shadow-2xl"
            role="dialog"
            aria-modal
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-app-text">{t("mat.moveModalTitle")}</h3>
              <button
                type="button"
                onClick={() => setMoveModalOpen(false)}
                className="rounded border border-app-line-mid px-2 py-1 text-xs text-app-muted hover:bg-app-surface-2"
              >
                {t("photo.cancel")}
              </button>
            </div>
            <input
              value={moveSearch}
              onChange={(e) => setMoveSearch(e.target.value)}
              placeholder={t("mat.moveModalSearchPh")}
              className="mt-3 w-full rounded-lg border border-app-input-border bg-app-input-bg px-3 py-2 text-sm"
            />
            <div className="mt-3 max-h-[52vh] overflow-y-auto rounded-lg border border-app-line-subtle bg-app-surface-2/40 p-2">
              {moveTargetDefs.length === 0 ? (
                <p className="px-1 py-2 text-xs text-app-muted">{t("mat.moveModalEmpty")}</p>
              ) : (
                moveTargetDefs.map((g) => (
                  <div key={g.primary} className="mb-2 rounded-md border border-app-line-subtle/70 bg-app-panel-bg/60 p-2 last:mb-0">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-app-muted">{g.primary}</div>
                    <div className="space-y-1">
                      {g.defs.map((d) => (
                        <label key={d.name} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-app-surface-2">
                          <input
                            type="radio"
                            name="move-target-category"
                            checked={moveTargetCategory === d.name}
                            onChange={() => setMoveTargetCategory(d.name)}
                          />
                          <span className="min-w-0 flex-1 truncate" title={d.name}>
                            {categoryOptionText(d)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveModalOpen(false)}
                className="rounded border border-app-line-mid px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface-2"
              >
                {t("photo.cancel")}
              </button>
              <button
                type="button"
                disabled={!moveTargetCategory || selectedIds.length === 0}
                onClick={confirmMoveModal}
                className="rounded bg-app-primary px-3 py-1.5 text-xs font-semibold text-app-on-primary hover:bg-app-primary-hover disabled:opacity-40"
              >
                {t("mat.moveModalConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {err ? (
        <div className="shrink-0 rounded-lg border border-app-danger-border bg-app-danger-bg px-3 py-2 text-sm text-app-danger-text">
          {err}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row lg:gap-3">
        <aside
          className={`flex min-h-0 w-full flex-col gap-0 rounded-xl border border-app-panel-border bg-app-panel-bg ${
            libraryTab === "product" ? "min-w-0 shrink lg:max-w-sm lg:basis-[min(100%,20rem)] lg:overflow-hidden" : "shrink-0 lg:w-72 xl:w-80"
          }`}
        >
          <div className="shrink-0 border-b border-app-line-subtle px-2 py-2 text-xs font-semibold uppercase tracking-wide text-app-muted">
            {t("mat.folders")}
          </div>
          {libraryTab === "brand" ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <ErpCatalogLeftNav
                className="min-h-0 flex-1"
                hardwareDefsUniverse={categoryRowsForBrand}
                hardwareNavSel={brandNavSel}
                onHardwareNavSelChange={setMaterialsBrandNavSel}
                hardwareFolderSearchQuery={search}
                countFor={brandQuoteAdCountFor}
                countForKindAll={(k) => (k === "hardware" ? quoteAdTotal : undefined)}
                hardwareRowEnhancer={enhanceBrandHardwareRow}
              />
              <AddCategoryFolderFooter
                onAdd={(nameZh, nameEn) => addCategory(nameZh, "device", nameEn)}
                onOpenCategoryLibrary={() => setCatLibOpen(true)}
              />
              {brandNavSel.filterKey && brandNavSel.filterKey !== UNCATEGORIZED_CATEGORY_NAME ? (
                <div className="shrink-0 border-t border-app-line-subtle p-2">
                  <button
                    type="button"
                    className="ui-dangerBtn w-full border px-2 py-1.5 text-xs"
                    onClick={() => onDeleteCategory(brandNavSel.filterKey!)}
                  >
                    {t("mat.deleteCat")}
                  </button>
                </div>
              ) : null}
              <CategoryDefLibraryModal open={catLibOpen} onClose={() => setCatLibOpen(false)} />
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0.5">
              <MaterialFolderNav
                className="shrink-0"
                groups={[
                  {
                    id: "product-all",
                    title: null,
                    rows: [
                      {
                        id: "all-tab",
                        label: t("mat.all"),
                        count: inTab.length,
                        iconKey: null,
                        selected: matViewAll,
                        onClick: selectAllMaterials,
                      },
                    ],
                  },
                ]}
              />
              <ErpCatalogLeftNav
                className="min-h-0 flex-1"
                countFor={productNavCount}
                countForKindAll={productKindAllCount}
                onNavigate={() => setMatViewAll(false)}
              />
            </div>
          )}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("mat.searchPh")}
              className="min-w-[10rem] flex-1 rounded-lg border border-app-input-border bg-app-input-bg px-3 py-2 text-sm sm:max-w-xs"
            />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as "name" | "time")}
              className="rounded-lg border border-app-input-border bg-app-input-bg px-2 py-2 text-xs text-app-text"
            >
              <option value="time">{t("mat.sortTime")}</option>
              <option value="name">{t("mat.sortName")}</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="ui-toolBtn rounded-lg border border-app-line-mid bg-app-surface/35 px-3 py-2 text-xs text-app-text"
            >
              {sortDir === "asc" ? t("mat.sortAsc") : t("mat.sortDesc")}
            </button>
            <div className="ml-auto flex items-center gap-1 rounded-lg border border-app-line-subtle bg-app-surface/40 px-1.5 py-1">
              <span className="hidden text-xs text-app-muted sm:inline">{t("mat.preview")}</span>
              <button
                type="button"
                title={t("mat.zoomOutTitle")}
                className="ui-toolBtn flex h-7 w-7 items-center justify-center rounded text-base font-semibold leading-none text-app-text"
                onClick={() => setGridCols((c) => Math.min(6, c + 1))}
              >
                −
              </button>
              <button
                type="button"
                title={t("mat.zoomInTitle")}
                className="ui-toolBtn flex h-7 w-7 items-center justify-center rounded text-base font-semibold leading-none text-app-text"
                onClick={() => setGridCols((c) => Math.max(2, c - 1))}
              >
                +
              </button>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-app-line-subtle bg-app-surface/35 px-2 py-1.5 text-xs">
            <label className="inline-flex items-center gap-1.5 text-app-muted">
              <input
                type="checkbox"
                checked={filteredList.length > 0 && filteredList.every((m) => selectedIds.includes(m.id))}
                onChange={toggleSelectAllVisible}
              />
              {t("mat.selectVisible")}
            </label>
            <span className="text-app-muted">{t("mat.selectedCount", { n: selectedIds.length })}</span>
            <button
              type="button"
              onClick={selectAllFiltered}
              disabled={!filteredList.length}
              className="rounded border border-app-line-mid bg-app-surface px-2 py-1 text-xs text-app-text hover:bg-app-surface-2 disabled:opacity-40"
            >
              {t("mat.selectAll")}
            </button>
            <button
              type="button"
              onClick={clearSelected}
              disabled={!selectedIds.length}
              className="rounded border border-app-line-mid bg-app-surface px-2 py-1 text-xs text-app-text hover:bg-app-surface-2 disabled:opacity-40"
            >
              {t("mat.clearSelection")}
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={openMoveModal}
              className="rounded border border-app-line-mid bg-app-surface px-2 py-1 text-xs text-app-text hover:bg-app-surface-2 disabled:opacity-40"
            >
              {t("mat.moveSelected")}
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={deleteSelected}
              className="rounded border border-app-danger-border bg-app-danger-bg px-2 py-1 text-xs text-app-danger-text hover:opacity-90 disabled:opacity-40"
            >
              {t("mat.deleteSelected")}
            </button>
          </div>

          {libraryTab === "brand" && (brandNavSel.primary || brandNavSel.filterKey) ? (
            <div className="shrink-0 rounded-lg border border-app-line-mid bg-app-surface-2/40 px-2 py-1.5 text-xs text-app-muted">
              {t("mat.filterCurrent")}
              <span className="ml-1 font-medium text-app-text">{brandFilterLabel}</span>
              <button type="button" className="ml-2 text-app-tone hover:underline" onClick={selectAllMaterials}>
                {t("mat.clearFilter")}
              </button>
            </div>
          ) : null}
          {libraryTab === "product" && !matViewAll && productFilterSummary ? (
            <div className="shrink-0 rounded-lg border border-app-line-mid bg-app-surface-2/40 px-2 py-1.5 text-xs text-app-muted">
              {t("mat.filterCurrent")}
              <span className="ml-1 font-medium text-app-text">{productFilterSummary}</span>
              <button type="button" className="ml-2 text-app-tone hover:underline" onClick={selectAllMaterials}>
                {t("mat.clearFilter")}
              </button>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-app-line-subtle bg-app-surface-2/30 p-2">
            {filteredList.length === 0 ? (
              <p className="mb-3 px-1 text-center text-xs text-app-muted">
                {libraryTab === "brand" && (brandNavSel.primary || brandNavSel.filterKey)
                  ? t("mat.noAssetsInFolder", { name: brandFilterLabel })
                  : libraryTab === "product" && !matViewAll
                    ? t("mat.noAssetsInFolder", { name: productFilterSummary ?? "—" })
                    : t("mat.noAssets")}
              </p>
            ) : null}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
              {filteredList.map((m) => {
                const g = gcd(m.widthPx, m.heightPx);
                return (
                  <article
                    key={m.id}
                    draggable
                    onDragStart={(e) => {
                      const ids = selectedIds.includes(m.id) && selectedIds.length > 0 ? selectedIds : [m.id];
                      e.dataTransfer.setData(DND_MATERIAL_IDS, JSON.stringify(ids));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="ui-matCard overflow-hidden rounded-xl border border-app-panel-border bg-app-panel-bg shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-app-line-subtle px-2 py-1">
                      <label className="inline-flex items-center gap-1 text-[11px] text-app-muted">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(m.id)}
                          onChange={() => toggleMaterialSelected(m.id)}
                        />
                        {t("mat.pick")}
                      </label>
                    </div>
                    <div className="relative aspect-video bg-app-text/40">
                      <img src={m.dataUrl} alt="" className="h-full w-full object-contain" />
                    </div>
                    <div className="space-y-2 p-3 text-xs text-app-muted">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-app-surface-2 px-1.5 py-0.5 text-xs text-app-muted">
                          {MATERIAL_KIND_LABEL[m.imageKind]}
                        </span>
                        <span className="truncate font-medium text-app-text" title={m.fileName}>
                          {m.fileName}
                        </span>
                      </div>
                      <div className="text-xs text-app-muted">
                        {t("mat.timePage", { time: formatTimeLabel(materialTime(m)), page: m.sourcePage + 1 })}
                      </div>
                      <div className="text-app-muted">
                        {t("mat.ratio", { w: m.widthPx, h: m.heightPx, rw: m.widthPx / g, rh: m.heightPx / g })}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={m.category}
                          onChange={(e) => setMaterialCategory(m.id, e.target.value)}
                          className="min-w-0 flex-1 rounded border border-app-input-border bg-app-input-bg px-2 py-1 text-xs"
                        >
                          {libraryTab === "brand" && !categoryRowsForBrand.some((d) => d.name === m.category) ? (
                            <option value={m.category}>
                              {t("mat.unknownFolder")} {m.category}
                            </option>
                          ) : null}
                          {libraryTab === "product" && !productSelectCategories.some((d) => d.name === m.category) ? (
                            <option value={m.category}>
                              {t("mat.unknownFolder")} {m.category}
                            </option>
                          ) : null}
                          {(libraryTab === "brand" ? categoryRowsForBrand : productSelectCategories).map((d) => (
                            <option key={d.name} value={d.name}>
                              {folderLabel(d)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="ui-dangerBtn shrink-0 border px-2 py-1 text-xs"
                          onClick={() => removeMaterial(m.id)}
                        >
                          {t("mat.delete")}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
              <button
                type="button"
                disabled={busy}
                onClick={() => setAddModalOpen(true)}
                className="flex min-h-[11rem] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-app-primary/50 bg-app-panel-bg text-app-muted transition hover:border-app-primary hover:bg-app-surface/80 hover:text-app-text disabled:opacity-50"
              >
                <span className="text-3xl font-light leading-none text-app-primary">+</span>
                <span className="text-sm font-medium">Add new</span>
                <span className="px-2 text-center text-xs text-app-subtle">JPG / PNG / WEBP / PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
