import { create } from "zustand";
import { persist } from "zustand/middleware";
import { allocateNextPisellQuotationRef } from "../utils/quotationRef";
import {
  addonIdsSortedFromQty,
  filterAddonQtyMapForCatalog,
  mergeAddonQtyMap,
} from "../utils/customPlanAddonQty";
import { normalizeSoftwarePriceBilling } from "../utils/softwareBilling";
import { createDebouncedJsonStorage, flushQuotePersistDebouncedStorageNow } from "../storage/debouncedJsonStorage";
import { quoteFolderPersistStorage, QUOTE_PERSIST_API } from "../storage/quoteFolderPersistStorage";
import { readPersistJsonFromIdbOnly } from "../storage/quotePersistStorage";
import type {
  AppUiThemeBundle,
  AppUiThemeBundlePatch,
  AssociationRow,
  CustomPlanSelectStep,
  CustomPlanTab,
  HardwarePlacement,
  MaterialCategoryDef,
  MaterialPage,
  PlanPage,
  PlanPreviewExtraState,
  SavedPlanTemplate,
  PlanTemplatePageEntry,
  EnterpriseResourceMainTab,
  MaterialsLibraryTab,
  QuoteTemplateDocumentRole,
  SavedQuoteTemplate,
  QuotePdfExportStyle,
  ErpInventoryLine,
  ErpInvSubTab,
  ErpModuleTab,
  ErpCatalogSelection,
  ErpCatalogNavSel,
  ErpStockKind,
  ErpHardwareNavSortMode,
  ErpStockMovement,
  QuoteTab,
  CrmCustomer,
  ResourceLibrarySubTab,
  CustomPlanServiceLine,
  CustomPlanSoftwareLine,
  SavedCustomPlan,
  CustomPlanSnapshotData,
  ServiceRow,
  SoftwareFeatureRow,
  UiLocale,
  QuotePriceTier,
  QuoteTableRowKey,
} from "../types";
import { DEFAULT_UI_THEME_BUNDLE, normalizeUiThemeBundle } from "../theme/uiThemePresets";
import { normalizeQuotePdfExportStyle } from "../theme/quotePdfStyle";
import { DEFAULT_MAP_COLOR } from "../theme/mapColorPresets";
import type { MapThemeMode } from "../icons/mapColors";
import { HARDWARE_ICON_IDS } from "../icons/hardwareGlyphs";
import { HARDWARE_IOT_BUCKET_CATEGORY_NAME, UNCATEGORIZED_CATEGORY_NAME } from "../constants/materialCategories";
import {
  buildDefaultMaterialCategoryDefs,
  enrichCategoryDef,
  mergePersistedCategoryDefsWithCanonical,
  migrateLegacyCategoryName,
} from "../constants/defaultMaterialCategories";
import { orderedMaterialIds } from "../utils/layoutOrder";
import { collectDefaultSolutionBookMaterialIds } from "../utils/solutionBookMaterialOrder";
import { buildTemplateEntriesFromPlanPages, materializePlanPagesFromTemplate } from "../utils/planTemplateRules";
import { splitPdfToJpegPages } from "../utils/pdfPages";
import { isMaterialImageKind } from "../utils/materialKinds";
import {
  normalizeAssociationRow,
  normalizeHardwareAddons,
  normalizeHardwareOptions,
  normalizePlacement,
} from "../utils/hardwareOptionsAddons";
import { normalizePlanPreviewExtra } from "../utils/planPreviewExtra";
import { normalizeSoftwareFeatureCategoryStored } from "../constants/softwareFeatureCategories";
import { normalizeServiceCategoryStored } from "../constants/serviceCategoryPresets";
import { migrateSoftwareMaterialCategoryPath } from "../utils/localeDataMigration";
import { findBarcodeClash, normalizeErpInventoryLine, normalizeErpStockMovement } from "../utils/erpInventory";
import type { PisellImportResult } from "../utils/pisellHardwareImport";
import { importPisellHardwareFromWorkbook, inferHardwareCategoryFromItem } from "../utils/pisellHardwareImport";
import { normalizeStorageCategory, reorderCategoryDefsByHardwarePrimary } from "../utils/erpCatalogCategories";
import {
  preferNonEmptyCatalogArray,
  readQuotePersistStateFromLocalStorage,
} from "../utils/quotePersistLocalStorageFallback";
import { parsePersistStateJson, scorePersistState } from "../utils/persistRichness";
import { parseQuoteTableOrder } from "../utils/quoteTableOrder";
import { defaultQuoteTemplateBlocks, normalizeSavedQuoteTemplate } from "../utils/quoteTemplateModel";
import {
  type HardwareCatalogImportBundle,
  patchStateWithHardwareCatalogBundle,
} from "../utils/hardwareCatalogReplace";
import {
  bundledPisellHardwareBuildId,
  bundledPisellHardwarePayload,
  isBundledPisellHardwareCatalogNonEmpty,
} from "../data/bundledPisellCatalog";
import {
  captureCustomPlanSnapshot,
  captureCustomPlanSnapshotFromSlice,
  defaultCustomPlanName,
  emptyCustomPlanSnapshot,
  normalizeSavedCustomPlan,
  resolveCustomPlanHydration,
  snapshotRichness,
  snapshotToWorkspacePatch,
  type CustomPlanSnapshotSource,
} from "../utils/customPlanSnapshot";

const PERSIST_STORE_NAME = "marketing-quote-v1";

function customPlanSnapCtx(s: State) {
  return {
    materials: s.materials,
    softwareFeatureIds: new Set(s.softwareFeatures.map((f) => f.id)),
    serviceIds: new Set(s.serviceItems.map((x) => x.id)),
    associationIds: new Set(s.associations.map((a) => a.id)),
  };
}

async function fetchProjectPersistJson(): Promise<string | null> {
  if (typeof fetch === "undefined") return null;
  try {
    const r = await fetch(QUOTE_PERSIST_API, { method: "GET", cache: "no-store" });
    if (!r.ok) return null;
    const t = await r.text();
    return t?.trim() ? t : null;
  } catch {
    return null;
  }
}

function applyCustomPlanFromPersistJson(
  json: string,
  planIdOrName: string,
  get: () => State,
  set: (partial: Partial<State> | ((s: State) => Partial<State>)) => void,
): { ok: boolean; error?: string; planName?: string } {
  const st = parsePersistStateJson(json);
  if (!st) return { ok: false, error: "invalid file" };
  const snapCtx = customPlanSnapCtx(get());
  const filePlans = parseSavedPlansFromState(st, snapCtx);
  const key = planIdOrName.trim();

  let filePlan = filePlans.find((p) => p.id === key || p.name === key) ?? null;
  if (!filePlan && (key === "5F 2 all" || key.includes("5F"))) {
    const root = captureCustomPlanSnapshotFromSlice(st as Partial<CustomPlanSnapshotSource>);
    if (snapshotRichness(root) > 0) {
      const local = get().savedCustomPlans.find((p) => p.name === "5F 2 all" || p.id === key);
      if (local) {
        filePlan = { ...local, data: root, updatedAt: Date.now() };
      }
    }
  }
  if (!filePlan) return { ok: false, error: "plan-not-found" };

  const s = get();
  const localPlan = s.savedCustomPlans.find((p) => p.id === filePlan!.id || p.name === filePlan!.name);
  if (!localPlan) return { ok: false, error: "plan-not-found" };

  const workspace = filePlan.data;
  const restoredPlan: SavedCustomPlan = { ...filePlan, data: workspace, updatedAt: Date.now() };

  set((state) => {
    const nextPlans = state.savedCustomPlans.map((p) => (p.id === localPlan.id ? restoredPlan : p));
    const patch: Partial<State> = { savedCustomPlans: nextPlans };
    if (state.activeCustomPlanId === localPlan.id) {
      Object.assign(patch, snapshotToWorkspacePatch(workspace));
      patch.activeCustomPlanId = localPlan.id;
    }
    return patch;
  });

  if (typeof document !== "undefined") {
    document.documentElement.dataset.mapTheme = workspace.mapTheme;
  }
  flushQuotePersistDebouncedStorageNow();
  return { ok: true, planName: restoredPlan.name };
}

function parseSavedPlansFromState(
  st: Record<string, unknown>,
  snapCtx: ReturnType<typeof customPlanSnapCtx>,
): SavedCustomPlan[] {
  if (!Array.isArray(st.savedCustomPlans)) return [];
  return (st.savedCustomPlans as unknown[])
    .map((x) => normalizeSavedCustomPlan(x, snapCtx))
    .filter((x): x is SavedCustomPlan => x !== null);
}

async function collectRichestBackupSnapshot(get: () => State): Promise<{
  root: CustomPlanSnapshotData | null;
  plans: SavedCustomPlan[];
}> {
  const snapCtx = customPlanSnapCtx(get());
  const candidates: { root: CustomPlanSnapshotData; plans: SavedCustomPlan[] }[] = [];

  const fileJson = await fetchProjectPersistJson();
  if (fileJson) {
    const st = parsePersistStateJson(fileJson);
    if (st) {
      candidates.push({
        root: captureCustomPlanSnapshotFromSlice(st as Partial<CustomPlanSnapshotSource>),
        plans: parseSavedPlansFromState(st, snapCtx),
      });
    }
  }

  const ls = readQuotePersistStateFromLocalStorage();
  if (ls) {
    candidates.push({
      root: captureCustomPlanSnapshotFromSlice(ls as Partial<CustomPlanSnapshotSource>),
      plans: parseSavedPlansFromState(ls, snapCtx),
    });
  }

  const idbJson = await readPersistJsonFromIdbOnly(PERSIST_STORE_NAME);
  if (idbJson) {
    const st = parsePersistStateJson(idbJson);
    if (st) {
      candidates.push({
        root: captureCustomPlanSnapshotFromSlice(st as Partial<CustomPlanSnapshotSource>),
        plans: parseSavedPlansFromState(st, snapCtx),
      });
    }
  }

  if (!candidates.length) return { root: null, plans: [] };
  let best = candidates[0]!;
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    if (snapshotRichness(c.root) > snapshotRichness(best.root)) best = c;
  }
  return best;
}

let customPlanAutosaveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleCustomPlanAutosave(get: () => State) {
  if (customPlanAutosaveTimer) clearTimeout(customPlanAutosaveTimer);
  customPlanAutosaveTimer = setTimeout(() => {
    customPlanAutosaveTimer = null;
    const s = get();
    if (!s.activeCustomPlanId) return;
    s.flushActiveCustomPlan();
    flushQuotePersistDebouncedStorageNow();
  }, 900);
}

function notifyCustomPlanWorkspaceChanged(get: () => State) {
  scheduleCustomPlanAutosave(get);
}

function normalizeCrmCustomer(raw: unknown): CrmCustomer | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<CrmCustomer>;
  const id = typeof r.id === "string" && r.id.trim() ? r.id : crypto.randomUUID();
  const now = Date.now();
  const name = typeof r.name === "string" && r.name.trim() ? r.name.trim() : "New customer";
  const industry = typeof r.industry === "string" && r.industry.trim() ? r.industry.trim() : "Other";
  const contact = typeof r.contact === "string" ? r.contact : "";
  const solutionPlanIds = Array.isArray(r.solutionPlanIds)
    ? [...new Set(r.solutionPlanIds.filter((x): x is string => typeof x === "string" && !!x))]
    : [];
  return {
    id,
    name,
    industry,
    contact,
    solutionPlanIds,
    createdAt: typeof r.createdAt === "number" && Number.isFinite(r.createdAt) ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === "number" && Number.isFinite(r.updatedAt) ? r.updatedAt : now,
  };
}

type State = {
  activeTab: QuoteTab;
  crmCustomers: CrmCustomer[];
  activeCrmCustomerId: string | null;
  addCrmCustomer: (name?: string) => string;
  updateCrmCustomer: (id: string, patch: Partial<Omit<CrmCustomer, "id" | "createdAt" | "updatedAt">>) => void;
  deleteCrmCustomer: (id: string) => void;
  setActiveCrmCustomerId: (id: string | null) => void;
  resourceLibrarySubTab: ResourceLibrarySubTab;
  /** 企业资源：素材库 vs 报价模板搭建器 */
  enterpriseResourceMainTab: EnterpriseResourceMainTab;
  /** 无代码报价版式模板（持久化） */
  quoteTemplates: SavedQuoteTemplate[];
  /** 报价 PDF 首页使用的模板 id；null 表示内置封面 */
  quotePdfTemplateId: string | null;
  customPlanTab: CustomPlanTab;
  customPlanSelectStep: CustomPlanSelectStep;
  /** 已保存的命名方案列表 */
  savedCustomPlans: SavedCustomPlan[];
  /** 当前工作区对应的方案 id；null 表示尚未纳入任一已保存方案 */
  activeCustomPlanId: string | null;
  /** 将当前工作区写入 active 方案（无 active 时无操作） */
  flushActiveCustomPlan: () => void;
  /** 保存当前工作区（更新 active 或新建并设为 active） */
  saveCustomPlan: (name?: string) => string;
  /** 新建空白方案并切换 */
  createCustomPlan: (name?: string) => string;
  loadCustomPlan: (id: string) => void;
  deleteCustomPlan: (id: string) => void;
  renameCustomPlan: (id: string, name: string) => void;
  /** 从 localStorage / 项目 data 文件 / IndexedDB 恢复当前方案工作区 */
  recoverCustomPlanWorkspaceFromLocalStorageBackup: () => Promise<boolean>;
  /** 强制从 data/marketing-quote-v1.json 重新加载整份数据 */
  reloadPersistFromProjectFile: () => Promise<{ ok: boolean; error?: string; planNames?: string[] }>;
  /** 项目文件比当前更完整时自动同步（启动时用） */
  syncPersistFromProjectFileIfRicher: () => Promise<{ ok: boolean; error?: string; planNames?: string[] }>;
  /** 仅从项目文件恢复指定方案（不改动其他方案） */
  restoreCustomPlanFromProjectFile: (
    planIdOrName: string,
  ) => Promise<{ ok: boolean; error?: string; planName?: string }>;
  /** 从历史备份文件恢复指定方案（不改动其他方案） */
  restoreCustomPlanFromBackupFile: (
    backupName: string,
    planIdOrName: string,
  ) => Promise<{ ok: boolean; error?: string; planName?: string }>;
  /** 列出 data/backups 内可用备份 */
  listCustomPlanBackupFiles: () => Promise<{ name: string; mtime: string; size: number }[]>;
  reconcileCustomPlanWorkspaceAfterHydrate: () => boolean;
  /** 素材库 · 品牌 / 产品子 Tab（持久化） */
  materialsLibraryTab: MaterialsLibraryTab;
  /** 素材库 · 品牌区左侧主类/子类筛选 */
  materialsBrandNavSel: ErpCatalogNavSel;
  setMaterialsLibraryTab: (t: MaterialsLibraryTab) => void;
  setMaterialsBrandNavSel: (next: ErpCatalogNavSel) => void;
  /** 素材分类（顺序即展示顺序）；含「未分类」作为删除分类后的归宿 */
  categoryDefs: MaterialCategoryDef[];
  materials: MaterialPage[];
  /** 素材在报价 PDF 中的顺序（方案排版「按顺序填入」亦用此顺序） */
  layoutMaterialOrder: string[];
  /** 方案排版：PDF 拆页 + 每页覆盖素材 */
  planPages: PlanPage[];
  /** 方案书结构模板（不含画布标注） */
  planTemplates: SavedPlanTemplate[];
  /** 软件功能资料（每功能最多 3 页） */
  softwareFeatures: SoftwareFeatureRow[];
  /** 企业资源库 · 服务（与软件类似，无多页资料槽） */
  serviceItems: ServiceRow[];
  /** 定制方案 · 软件选型（引用 softwareFeatures） */
  customPlanSoftwareLines: CustomPlanSoftwareLine[];
  /** 定制方案 · 服务选型（引用 serviceItems） */
  customPlanServiceLines: CustomPlanServiceLine[];
  associations: AssociationRow[];
  placements: HardwarePlacement[];
  /** 报价单末页：表格下方的自定义说明 */
  quoteFooterCustom: string;
  /**
   * 报价参考号（`PisellYYYYMMDD###`），首次进入报价页或首次生成 PDF 前分配并持久化。
   */
  quotationRef: string | null;
  ensureQuotationRef: () => void;
  /** 硬件布局：平面图（JPEG data URL） */
  floorPlanDataUrl: string | null;
  /** 平面图底图不透明度（0–100） */
  floorPlanOpacityPct: number;
  /**
   * true：xPct/yPct 相对「object-contain 后实际显示的图片矩形」；
   * false：旧数据（相对整个地图容器），打开地图后会一次性换算并写回为 true。
   */
  floorPlanPlacementImageSpace: boolean;
  mapShowName: boolean;
  mapShowQuantity: boolean;
  /** PDF / Excel 汇总表硬件行是否附带产品缩略图 */
  quoteExportIncludeImages: boolean;
  mapTheme: MapThemeMode;
  /** 地图标记主图标缩放（约 0.5–2.5） */
  mapPlacementGlyphScale: number;
  /** 报价汇总表行顺序；null 表示按默认（硬件库序→软件→服务） */
  quoteTableOrder: QuoteTableRowKey[] | null;
  /** 报价 PDF 导出配色与封面装饰（设置中编辑） */
  quotePdfExportStyle: QuotePdfExportStyle;
  /** 企业信息（写入报价 PDF 封面等） */
  companyLogoDataUrl: string | null;
  companyName: string;
  companyTagline: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  /** ISO-like code for list prices (hardware catalog, quote table). */
  companyCatalogCurrency: string;
  /** Multiply stored amounts for display only (default 1). */
  companyCatalogFxMultiplier: number;
  /** Global tier for hardware line totals when every row follows. */
  quoteGlobalPriceTier: QuotePriceTier;
  uiLocale: UiLocale;
  /** 界面风格包 + 配色 + 背景 + 毛玻璃等壳参数（持久化） */
  uiThemeBundle: AppUiThemeBundle;
  setUiLocale: (l: UiLocale) => void;
  setUiThemeBundle: (patch: AppUiThemeBundlePatch) => void;
  setActiveTab: (t: QuoteTab) => void;
  setResourceLibrarySubTab: (t: ResourceLibrarySubTab) => void;
  setEnterpriseResourceMainTab: (t: EnterpriseResourceMainTab) => void;
  addQuoteTemplate: (name?: string, documentRole?: QuoteTemplateDocumentRole) => string;
  updateQuoteTemplate: (tpl: SavedQuoteTemplate) => void;
  removeQuoteTemplate: (id: string) => void;
  setQuotePdfTemplateId: (id: string | null) => void;
  setCustomPlanTab: (t: CustomPlanTab) => void;
  setCustomPlanSelectStep: (s: CustomPlanSelectStep) => void;
  setQuoteFooterCustom: (t: string) => void;
  setFloorPlanDataUrl: (url: string | null) => void;
  setFloorPlanOpacityPct: (pct: number) => void;
  /** 将旧版「容器百分比」坐标批量写入为图片矩形百分比，并标记为 image space */
  migrateFloorPlacementsToImageSpace: (updates: { id: string; xPct: number; yPct: number }[]) => void;
  /** 批量替换地图标记（用于一键清空后的撤销恢复） */
  setPlacements: (placements: HardwarePlacement[]) => void;
  setMapShowName: (v: boolean) => void;
  setMapShowQuantity: (v: boolean) => void;
  setQuoteExportIncludeImages: (v: boolean) => void;
  setMapTheme: (t: MapThemeMode) => void;
  setMapPlacementGlyphScale: (n: number) => void;
  setQuoteTableOrder: (order: QuoteTableRowKey[] | null) => void;
  addCategory: (name: string, iconKey: string, nameEn?: string) => void;
  removeCategory: (name: string) => void;
  /** 将分类库中文名从 `oldName` 改为 `newName`，并同步素材 / 硬件 / 软件与服务分类引用 */
  renameCategoryDef: (oldName: string, newName: string) => void;
  setCategoryIcon: (name: string, iconKey: string) => void;
  /** 更新分类库中的图标、默认地图色、英文名等（按中文名匹配） */
  patchCategoryDef: (
    name: string,
    patch: Partial<Pick<MaterialCategoryDef, "iconKey" | "nameEn" | "defaultMapColor">>,
  ) => void;
  /** 拖曳排序后的分类名顺序（未分类永远在最后） */
  reorderCategoryDefs: (orderedNames: string[]) => void;
  addMaterials: (pages: MaterialPage[]) => void;
  removeMaterial: (id: string) => void;
  /** 局部更新素材（如硬件库槽位交换后同步 imageKind） */
  patchMaterial: (id: string, patch: Partial<Pick<MaterialPage, "imageKind" | "fileName" | "category">>) => void;
  setMaterialCategory: (id: string, category: string) => void;
  setLayoutOrder: (ids: string[]) => void;
  replacePlanFromPdf: (file: File) => Promise<void>;
  clearPlanPages: () => void;
  /** 将多个素材各生成一页方案书（底图=素材图），追加到 planPages 末尾 */
  appendPlanPagesFromMaterials: (materialIds: string[]) => void;
  setPlanPageOverlay: (pageId: string, materialId: string | null) => void;
  /** 当前页叠图裁切比例，如 "16:9"；传 null 清除 */
  setPlanPageOverlayCrop: (pageId: string, aspect: string | null) => void;
  /** 写入该页第三列预览（缩放、旋转、标注）；每页独立 */
  setPlanPagePreviewExtra: (pageId: string, extra: PlanPreviewExtraState) => void;
  /** 在源页后插入副本；可传入当前编辑的 previewExtra，返回新页 id */
  insertPlanPageClone: (sourcePageId: string, previewExtra?: PlanPreviewExtraState | null) => string;
  setPlanPageOrder: (orderedIds: string[]) => void;
  applyLayoutOrderToPlanPages: () => void;
  /** 从指定方案页起，按顺序把该功能的资料叠到连续方案页（每页 overlay，最多 3 页） */
  applySoftwareFeatureToPlan: (featureId: string, startPlanPageId: string) => void;
  /** 按当前选型重建方案页（品牌→地图硬件→方案软件），替换现有页 */
  rebuildPlanPagesFromProposal: () => void;
  /** 将当前方案页结构存为模板（仅页序与底图解析规则 + 裁切比例） */
  savePlanTemplate: (name: string) => void;
  deletePlanTemplate: (id: string) => void;
  /** 按模板与当前选型重新生成方案页（清空叠图与预览标注） */
  applyPlanTemplate: (id: string) => void;
  upsertSoftwareFeature: (row: SoftwareFeatureRow) => void;
  removeSoftwareFeature: (id: string) => void;
  addCustomPlanSoftwareLine: (line: Omit<CustomPlanSoftwareLine, "id"> & { id?: string }) => void;
  patchCustomPlanSoftwareLine: (id: string, patch: Partial<CustomPlanSoftwareLine>) => void;
  removeCustomPlanSoftwareLine: (id: string) => void;
  /** 将一行拖到另一行之前（同列表内排序） */
  reorderCustomPlanSoftwareLines: (draggedLineId: string, targetLineId: string) => void;
  upsertServiceItem: (row: ServiceRow) => void;
  removeServiceItem: (id: string) => void;
  addCustomPlanServiceLine: (line: Omit<CustomPlanServiceLine, "id"> & { id?: string }) => void;
  patchCustomPlanServiceLine: (id: string, patch: Partial<CustomPlanServiceLine>) => void;
  removeCustomPlanServiceLine: (id: string) => void;
  reorderCustomPlanServiceLines: (draggedLineId: string, targetLineId: string) => void;
  upsertAssociation: (row: AssociationRow) => void;
  removeAssociation: (id: string) => void;
  addPlacement: (
    associationId: string,
    optionId?: string | null,
    extras?: { xPct?: number; yPct?: number; addonIds?: string[] },
  ) => void;
  updatePlacement: (placementId: string, xPct: number, yPct: number) => void;
  patchPlacement: (
    placementId: string,
    patch: Partial<Pick<HardwarePlacement, "optionId" | "addonIds" | "qty">>,
  ) => void;
  removePlacement: (placementId: string) => void;
  clearPlacementsForAssociation: (associationId: string) => void;
  patchAssociation: (id: string, patch: Partial<AssociationRow>) => void;
  patchQuotePdfExportStyle: (patch: Partial<QuotePdfExportStyle>) => void;
  erpTopModule: ErpModuleTab;
  erpInvSubTab: ErpInvSubTab;
  /** 打开产品库时滚动到硬件 / 软件 / 服务分区（用完可置 null） */
  erpCatalogFocus: ErpStockKind | null;
  /** 产品库列表与编辑栏同步的当前选中行（仅 ERP 三栏用） */
  erpCatalogSelection: ErpCatalogSelection | null;
  /** 产品库 / 媒体库产品 Tab 共用：当前大类 Tab 与各 kind 下主类筛选 */
  erpCatalogActiveKind: ErpStockKind;
  erpCatalogSel: Record<ErpStockKind, ErpCatalogNavSel>;
  setErpCatalogKindFilter: (kind: ErpStockKind, next: ErpCatalogNavSel) => void;
  /** 清空三 kind 的左侧筛选（媒体库「全部」等） */
  resetErpCatalogNavFilters: () => void;
  erpInventoryLines: ErpInventoryLine[];
  erpStockMovements: ErpStockMovement[];
  /**
   * Last `generatedAt` from `src/data/pisellHardwareSeed.json` applied in this browser.
   * New app builds with a newer seed replace the hardware catalog on first load for everyone.
   */
  bundledHardwareCatalogBuildId: number | null;
  setErpTopModule: (m: ErpModuleTab) => void;
  setErpInvSubTab: (t: ErpInvSubTab) => void;
  setErpCatalogFocus: (k: ErpStockKind | null) => void;
  setErpCatalogSelection: (s: ErpCatalogSelection | null) => void;
  openErpInventoryCatalog: (focus: ErpStockKind | null) => void;
  patchErpInventoryLine: (id: string, patch: Partial<ErpInventoryLine>) => void;
  /** 返回库存行 id（无则新建）；硬件可传 catalogOptionId 拆规格库存 */
  ensureErpInventoryRow: (kind: ErpStockKind, catalogRefId: string, catalogOptionId?: string | null) => string;
  recordErpStockIn: (
    kind: ErpStockKind,
    catalogRefId: string,
    qty: number,
    opts?: { barcode?: string; note?: string; catalogOptionId?: string | null },
  ) => { ok: true } | { ok: false; error: string };
  /** 自 Pisell Hardware List.xlsx 导入硬件目录、产品图与库存行（合并同 WIFI 前缀为多规格） */
  importFromPisellWorkbook: (file: File) => Promise<PisellImportResult>;
  /** 从打包进应用的 `src/data/pisellHardwareSeed.json` 载入目录（与 xlsx 导入相同的替换规则） */
  applyBundledPisellHardwareSeed: () => Promise<{ ok: true } | { ok: false; error: string }>;
  /** 若内置种子的 `generatedAt` 大于本地已应用版本，则替换硬件目录（发布新版本后全员自动对齐） */
  ensureBundledHardwareCatalogSynced: () => void;
  /** 对「未分类 / IoT 兜底」目录或素材类，按 `deviceModel` 推断并同步关联与素材分类 */
  recategorizeUncategorizedHardware: () => void;
  /** 产品库顶栏：分类名 + 型号 + 素材等联合搜索 */
  erpCatalogSearchQuery: string;
  setErpCatalogSearchQuery: (q: string) => void;
  /** 硬件分类侧栏与右侧分类树：Manual 与分类库顺序一致；A–Z 按展示名排序 */
  erpHardwareNavSortMode: ErpHardwareNavSortMode;
  setErpHardwareNavSortMode: (m: ErpHardwareNavSortMode) => void;
  /** 按主类顺序重排 `categoryDefs`（硬件左侧导航顺序） */
  reorderHardwareCategoryPrimaries: (orderedPrimaries: string[]) => void;
  /**
   * 若 IndexedDB 中目录被写成空而 localStorage 仍有旧备份，可尝试把硬件/软件/服务/素材等合并回内存（并触发持久化）。
   * 返回是否写入了至少一项。
   */
  recoverCatalogFromLocalStorageBackup: () => boolean;
  /**
   * 用 localStorage 里残留的整份 persist 状态中的硬件块，覆盖当前硬件目录（与 Excel 导入相同的替换规则）。
   * 用于 IndexedDB 已被空数据覆盖但 localStorage 仍有旧 JSON 时找回全部导入行。
   */
  restoreFullHardwareCatalogFromLocalStorageBackup: () =>
    | { ok: true; count: number }
    | { ok: false; error: "no_backup" | "empty_hardware" | "invalid" };
  setCompanyBranding: (patch: {
    companyLogoDataUrl?: string | null;
    companyName?: string;
    companyTagline?: string;
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
    companyWebsite?: string;
    companyCatalogCurrency?: string;
    companyCatalogFxMultiplier?: number;
  }) => void;
  setQuoteGlobalPriceTier: (t: QuotePriceTier) => void;
  resetHardwareQuoteTierModesToFollow: () => void;
  exportPersistedJson: () => string;
  importPersistedJson: (json: string) => { ok: true } | { ok: false; error: string };
};

function normalizePersistedErpCatalogNavSel(v: unknown): ErpCatalogNavSel {
  if (!v || typeof v !== "object" || Array.isArray(v)) return { primary: null, filterKey: null };
  const o = v as Record<string, unknown>;
  const p = o.primary;
  const f = o.filterKey;
  return {
    primary: typeof p === "string" && p ? p : null,
    filterKey: typeof f === "string" && f ? f : null,
  };
}

function normalizeIconKey(k: string): string {
  return (HARDWARE_ICON_IDS as readonly string[]).includes(k) ? k : "device";
}

function normalizeSoftwareFeatureRow(raw: Partial<SoftwareFeatureRow>): SoftwareFeatureRow {
  const arr = Array.isArray(raw.docMaterialIds) ? raw.docMaterialIds : [];
  const slot = (i: number): string | null =>
    typeof arr[i] === "string" && String(arr[i]).length > 0 ? String(arr[i]) : null;
  const up = raw.unitPrice;
  const unitPrice =
    up === null || up === undefined
      ? null
      : typeof up === "number" && Number.isFinite(up) && up >= 0
        ? up
        : null;
  const optArr = Array.isArray(raw.options) ? raw.options : [];
  const addArr = Array.isArray(raw.addons) ? raw.addons : [];
  const base = unitPrice ?? 0;
  const softwarePriceBilling = normalizeSoftwarePriceBilling(
    (raw as { softwarePriceBilling?: unknown }).softwarePriceBilling,
  );
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
    featureCategory: normalizeSoftwareFeatureCategoryStored(String(raw.featureCategory ?? "")),
    featureName: String(raw.featureName ?? "").trim(),
    unitPrice,
    softwarePriceBilling,
    note: String(raw.note ?? ""),
    docMaterialIds: [slot(0), slot(1), slot(2)],
    options: normalizeHardwareOptions(optArr, base),
    addons: normalizeHardwareAddons(addArr),
  };
}

function normalizeServiceRow(raw: Partial<ServiceRow>): ServiceRow {
  const up = raw.unitPrice;
  const unitPrice =
    up === null || up === undefined
      ? null
      : typeof up === "number" && Number.isFinite(up) && up >= 0
        ? up
        : null;
  const optArr = Array.isArray(raw.options) ? raw.options : [];
  const addArr = Array.isArray(raw.addons) ? raw.addons : [];
  const base = unitPrice ?? 0;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
    serviceCategory: normalizeServiceCategoryStored(String(raw.serviceCategory ?? "")),
    serviceName: String(raw.serviceName ?? "").trim(),
    unitPrice,
    note: String(raw.note ?? ""),
    options: normalizeHardwareOptions(optArr, base),
    addons: normalizeHardwareAddons(addArr),
  };
}

function normalizeCustomPlanSoftwareLine(raw: Partial<CustomPlanSoftwareLine>): CustomPlanSoftwareLine {
  const q = raw.quantity;
  const quantity =
    typeof q === "number" && Number.isFinite(q) ? Math.max(0, Math.floor(q)) : 1;
  const addonIdsLegacy = Array.isArray(raw.addonIds) ? raw.addonIds.filter((x): x is string => typeof x === "string") : [];
  const rq = raw.addonQtyById;
  const addonQtyRaw =
    rq && typeof rq === "object" && !Array.isArray(rq) ? (rq as Record<string, number>) : undefined;
  const addonQtyById = mergeAddonQtyMap({ addonIds: addonIdsLegacy, addonQtyById: addonQtyRaw });
  const addonIds = addonIdsSortedFromQty(addonQtyById);
  const lto = raw.lineTotalOverride;
  const lineTotalOverride =
    lto !== null && lto !== undefined && typeof lto === "number" && Number.isFinite(lto) && lto >= 0
      ? lto
      : null;
  const quoteLineNote = typeof raw.quoteLineNote === "string" ? raw.quoteLineNote : "";
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
    catalogFeatureId: String(raw.catalogFeatureId ?? ""),
    quantity,
    optionId: typeof raw.optionId === "string" && raw.optionId ? raw.optionId : null,
    addonIds,
    addonQtyById,
    lineTotalOverride,
    quoteLineNote,
  };
}

function moveLineBeforeTarget<T extends { id: string }>(rows: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...rows];
  const [item] = next.splice(fromIndex, 1);
  let insert = toIndex;
  if (fromIndex < toIndex) insert = toIndex - 1;
  next.splice(insert, 0, item);
  return next;
}

function normalizeCustomPlanServiceLine(raw: Partial<CustomPlanServiceLine>): CustomPlanServiceLine {
  const q = raw.quantity;
  const quantity =
    typeof q === "number" && Number.isFinite(q) ? Math.max(0, Math.floor(q)) : 1;
  const addonIdsLegacy = Array.isArray(raw.addonIds) ? raw.addonIds.filter((x): x is string => typeof x === "string") : [];
  const rq = raw.addonQtyById;
  const addonQtyRaw =
    rq && typeof rq === "object" && !Array.isArray(rq) ? (rq as Record<string, number>) : undefined;
  const addonQtyById = mergeAddonQtyMap({ addonIds: addonIdsLegacy, addonQtyById: addonQtyRaw });
  const addonIds = addonIdsSortedFromQty(addonQtyById);
  const lto = raw.lineTotalOverride;
  const lineTotalOverride =
    lto !== null && lto !== undefined && typeof lto === "number" && Number.isFinite(lto) && lto >= 0
      ? lto
      : null;
  const quoteLineNote = typeof raw.quoteLineNote === "string" ? raw.quoteLineNote : "";
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
    catalogServiceId: String(raw.catalogServiceId ?? ""),
    quantity,
    optionId: typeof raw.optionId === "string" && raw.optionId ? raw.optionId : null,
    addonIds,
    addonQtyById,
    lineTotalOverride,
    quoteLineNote,
  };
}

const defaultCategoryDefs: MaterialCategoryDef[] = buildDefaultMaterialCategoryDefs();

function ensureUncategorized(defs: MaterialCategoryDef[]): MaterialCategoryDef[] {
  if (defs.some((d) => d.name === UNCATEGORIZED_CATEGORY_NAME)) return defs;
  return [...defs, { name: UNCATEGORIZED_CATEGORY_NAME, iconKey: "device" }];
}

type MaterializedBundledPisell = {
  buildId: number;
  materials: MaterialPage[];
  associations: AssociationRow[];
  erpInventoryLines: ErpInventoryLine[];
};

function materializeBundledPisellCatalog(): MaterializedBundledPisell | null {
  const buildId = bundledPisellHardwareBuildId();
  if (!buildId || !isBundledPisellHardwareCatalogNonEmpty()) return null;
  const raw = bundledPisellHardwarePayload;
  if (!Array.isArray(raw.materials) || !Array.isArray(raw.associations)) return null;
  const materials = raw.materials as MaterialPage[];
  const associations = (raw.associations as AssociationRow[]).map((a) => normalizeAssociationRow(a));
  const erpInventoryLines = Array.isArray(raw.erpInventoryLines)
    ? (raw.erpInventoryLines as Partial<ErpInventoryLine>[]).map((l) => normalizeErpInventoryLine(l))
    : [];
  return { buildId, materials, associations, erpInventoryLines };
}

export const useQuoteStore = create<State>()(
  persist(
    (set, get) => ({
      activeTab: "erp",
      crmCustomers: [],
      activeCrmCustomerId: null,
      resourceLibrarySubTab: "brandMaterials",
      enterpriseResourceMainTab: "mediaLibrary",
      quoteTemplates: [],
      quotePdfTemplateId: null,
      customPlanTab: "select",
      customPlanSelectStep: "map",
      savedCustomPlans: [],
      activeCustomPlanId: null,
      materialsLibraryTab: "brand",
      materialsBrandNavSel: { primary: null, filterKey: null },
      categoryDefs: defaultCategoryDefs,
      materials: [],
      layoutMaterialOrder: [],
      planPages: [],
      planTemplates: [],
      softwareFeatures: [],
      serviceItems: [],
      customPlanSoftwareLines: [],
      customPlanServiceLines: [],
      associations: [],
      placements: [],
      quoteFooterCustom: "",
      quotationRef: null,
      floorPlanDataUrl: null,
      floorPlanOpacityPct: 100,
      floorPlanPlacementImageSpace: true,
      mapShowName: true,
      mapShowQuantity: false,
      quoteExportIncludeImages: false,
      mapTheme: "dark",
      mapPlacementGlyphScale: 1,
      quoteTableOrder: null,
      quotePdfExportStyle: normalizeQuotePdfExportStyle(undefined),
      companyLogoDataUrl: null,
      companyName: "",
      companyTagline: "",
      companyAddress: "",
      companyPhone: "",
      companyEmail: "",
      companyWebsite: "",
      companyCatalogCurrency: "AUD",
      companyCatalogFxMultiplier: 1,
      quoteGlobalPriceTier: "regular",
      uiLocale: "en",
      uiThemeBundle: DEFAULT_UI_THEME_BUNDLE,
      erpTopModule: "inventory",
      erpInvSubTab: "inbound",
      erpCatalogFocus: null,
      erpCatalogSelection: null,
      erpCatalogActiveKind: "hardware",
      erpCatalogSel: {
        hardware: { primary: null, filterKey: null },
        software: { primary: null, filterKey: null },
        service: { primary: null, filterKey: null },
      },
      erpCatalogSearchQuery: "",
      erpHardwareNavSortMode: "manual",
      erpInventoryLines: [],
      erpStockMovements: [],
      bundledHardwareCatalogBuildId: null,
      addCrmCustomer: (name) => {
        const now = Date.now();
        const id = crypto.randomUUID();
        const customer: CrmCustomer = {
          id,
          name: name?.trim() || "New customer",
          industry: "Other",
          contact: "",
          solutionPlanIds: [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ crmCustomers: [customer, ...s.crmCustomers], activeCrmCustomerId: id }));
        flushQuotePersistDebouncedStorageNow();
        return id;
      },
      updateCrmCustomer: (id, patch) => {
        set((s) => ({
          crmCustomers: s.crmCustomers.map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...patch,
                  name: patch.name !== undefined ? patch.name.trim() || c.name : c.name,
                  solutionPlanIds:
                    patch.solutionPlanIds !== undefined
                      ? [...new Set(patch.solutionPlanIds.filter(Boolean))]
                      : c.solutionPlanIds,
                  updatedAt: Date.now(),
                }
              : c,
          ),
        }));
        flushQuotePersistDebouncedStorageNow();
      },
      deleteCrmCustomer: (id) => {
        set((s) => {
          const next = s.crmCustomers.filter((c) => c.id !== id);
          return {
            crmCustomers: next,
            activeCrmCustomerId: s.activeCrmCustomerId === id ? (next[0]?.id ?? null) : s.activeCrmCustomerId,
          };
        });
        flushQuotePersistDebouncedStorageNow();
      },
      setActiveCrmCustomerId: (id) => {
        set((s) => ({
          activeCrmCustomerId: id && s.crmCustomers.some((c) => c.id === id) ? id : null,
        }));
        flushQuotePersistDebouncedStorageNow();
      },
      setUiLocale: (l) => set({ uiLocale: l === "zh" ? "zh" : "en" }),
      setUiThemeBundle: (patch) =>
        set((s) => {
          const {
            wireframeColorOverride: wfPatch,
            panelFillColorOverride: pfPatch,
            primaryColorOverride: primaryPatch,
            shellFrameColorOverride: shellFramePatch,
            customBackgroundArtDataUrl: customPatch,
            accentBorderColorOverride: _legacyAb,
            chrome: chromePatch,
            ...patchRest
          } = patch as AppUiThemeBundlePatch & { accentBorderColorOverride?: unknown };
          const next: AppUiThemeBundle = {
            ...s.uiThemeBundle,
            ...patchRest,
            chrome: { ...s.uiThemeBundle.chrome, ...(chromePatch ?? {}) },
          };
          if ("wireframeColorOverride" in patch) {
            if (wfPatch === null || wfPatch === "") delete next.wireframeColorOverride;
            else if (typeof wfPatch === "string") next.wireframeColorOverride = wfPatch;
          }
          if ("panelFillColorOverride" in patch) {
            if (pfPatch === null || pfPatch === "") delete next.panelFillColorOverride;
            else if (typeof pfPatch === "string") next.panelFillColorOverride = pfPatch;
          }
          if ("customBackgroundArtDataUrl" in patch) {
            if (customPatch === null || customPatch === "") delete next.customBackgroundArtDataUrl;
            else if (typeof customPatch === "string") next.customBackgroundArtDataUrl = customPatch;
          }
          if ("primaryColorOverride" in patch) {
            if (primaryPatch === null || primaryPatch === "") delete next.primaryColorOverride;
            else if (typeof primaryPatch === "string") next.primaryColorOverride = primaryPatch;
          }
          if ("shellFrameColorOverride" in patch) {
            if (shellFramePatch === null || shellFramePatch === "") delete next.shellFrameColorOverride;
            else if (typeof shellFramePatch === "string") next.shellFrameColorOverride = shellFramePatch;
          }
          return { uiThemeBundle: normalizeUiThemeBundle(next) };
        }),

      setActiveTab: (t) => {
        set((s) => {
          const tab = t as unknown as string;
          if (tab === "inventory") return { ...s, activeTab: "erp" as QuoteTab, erpTopModule: "inventory" };
          if (tab === "relations")
            return {
              ...s,
              activeTab: "erp",
              erpTopModule: "inventory",
              erpInvSubTab: "catalog",
              erpCatalogFocus: "hardware",
            };
          if (tab === "softwareLibrary")
            return {
              ...s,
              activeTab: "erp",
              erpTopModule: "inventory",
              erpInvSubTab: "catalog",
              erpCatalogFocus: "software",
            };
          if (tab === "hardwareLayout")
            return {
              ...s,
              activeTab: "customPlan" as QuoteTab,
            };
          if (tab === "planLayout") return { ...s, activeTab: "customPlan" as QuoteTab };
          if (tab === "quote") return { ...s, activeTab: "customPlan" as QuoteTab };
          if (tab === "materials")
            return { ...s, activeTab: "enterpriseResources" as QuoteTab, resourceLibrarySubTab: "brandMaterials" };
          return { ...s, activeTab: t };
        });
        flushQuotePersistDebouncedStorageNow();
      },
      setResourceLibrarySubTab: (t) => {
        set({
          /** Tab 1 仅素材库；硬件/软件/服务改在 ERP，误入旧子 Tab 时落到市场资料 */
          resourceLibrarySubTab: t === "hardware" || t === "software" || t === "services" ? "brandMaterials" : t,
        });
        flushQuotePersistDebouncedStorageNow();
      },
      setEnterpriseResourceMainTab: (tab) => {
        set({
          enterpriseResourceMainTab:
            tab === "mediaLibrary" || tab === "templateBuilder" ? tab : "mediaLibrary",
        });
        flushQuotePersistDebouncedStorageNow();
      },
      addQuoteTemplate: (name, documentRole) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        const role: QuoteTemplateDocumentRole =
          documentRole === "invoice" || documentRole === "other" ? documentRole : "quote";
        const tpl: SavedQuoteTemplate = {
          id,
          name: (name?.trim() || "New quote template").trim() || "New quote template",
          documentRole: role,
          createdAt: now,
          updatedAt: now,
          blocks: defaultQuoteTemplateBlocks(),
        };
        set((s) => ({ quoteTemplates: [...s.quoteTemplates, tpl] }));
        return id;
      },
      updateQuoteTemplate: (tpl) =>
        set((s) => {
          const ix = s.quoteTemplates.findIndex((x) => x.id === tpl.id);
          const next = [...s.quoteTemplates];
          const merged = { ...tpl, updatedAt: Date.now() };
          if (ix >= 0) next[ix] = merged;
          else next.push(merged);
          return { quoteTemplates: next };
        }),
      removeQuoteTemplate: (id) =>
        set((s) => ({
          quoteTemplates: s.quoteTemplates.filter((t) => t.id !== id),
          quotePdfTemplateId: s.quotePdfTemplateId === id ? null : s.quotePdfTemplateId,
        })),
      setQuotePdfTemplateId: (id) =>
        set({
          quotePdfTemplateId: id === null || id === "" ? null : id,
        }),
      setCustomPlanTab: (t) => {
        set({ customPlanTab: t === "plan" ? "select" : t });
        flushQuotePersistDebouncedStorageNow();
      },
      setCustomPlanSelectStep: (s) => {
        set({ customPlanSelectStep: s });
        flushQuotePersistDebouncedStorageNow();
      },

      flushActiveCustomPlan: () => {
        const s = get();
        const aid = s.activeCustomPlanId;
        if (!aid) return;
        const data = captureCustomPlanSnapshot(s);
        const now = Date.now();
        set({
          savedCustomPlans: s.savedCustomPlans.map((p) =>
            p.id === aid ? { ...p, data, updatedAt: now } : p,
          ),
        });
      },

      saveCustomPlan: (name) => {
        const s = get();
        const data = captureCustomPlanSnapshot(s);
        const now = Date.now();
        const locale = s.uiLocale === "zh" ? "zh" : "en";
        if (s.activeCustomPlanId) {
          const trimmed = name?.trim();
          set({
            savedCustomPlans: s.savedCustomPlans.map((p) =>
              p.id === s.activeCustomPlanId
                ? {
                    ...p,
                    data,
                    updatedAt: now,
                    ...(trimmed ? { name: trimmed } : {}),
                  }
                : p,
            ),
          });
          return s.activeCustomPlanId;
        }
        const id = crypto.randomUUID();
        const planName = name?.trim() || defaultCustomPlanName(s.savedCustomPlans, locale);
        const plan: SavedCustomPlan = { id, name: planName, createdAt: now, updatedAt: now, data };
        set({
          savedCustomPlans: [...s.savedCustomPlans, plan],
          activeCustomPlanId: id,
        });
        return id;
      },

      createCustomPlan: (name) => {
        get().flushActiveCustomPlan();
        const now = Date.now();
        const locale = get().uiLocale === "zh" ? "zh" : "en";
        const id = crypto.randomUUID();
        const planName = name?.trim() || defaultCustomPlanName(get().savedCustomPlans, locale);
        const data = emptyCustomPlanSnapshot();
        const plan: SavedCustomPlan = { id, name: planName, createdAt: now, updatedAt: now, data };
        set({
          savedCustomPlans: [...get().savedCustomPlans, plan],
          activeCustomPlanId: id,
          ...snapshotToWorkspacePatch(data),
        });
        if (typeof document !== "undefined") {
          document.documentElement.dataset.mapTheme = data.mapTheme;
        }
        return id;
      },

      loadCustomPlan: (id) => {
        if (get().activeCustomPlanId === id) return;
        get().flushActiveCustomPlan();
        const target = get().savedCustomPlans.find((p) => p.id === id);
        if (!target) return;
        const patch = snapshotToWorkspacePatch(target.data);
        set({ ...patch, activeCustomPlanId: id });
        if (typeof document !== "undefined") {
          document.documentElement.dataset.mapTheme = target.data.mapTheme;
        }
      },

      deleteCustomPlan: (id) => {
        const s = get();
        const nextPlans = s.savedCustomPlans.filter((p) => p.id !== id);
        if (s.activeCustomPlanId === id) {
          const fallback = nextPlans[0] ?? null;
          if (fallback) {
            set({
              savedCustomPlans: nextPlans,
              activeCustomPlanId: fallback.id,
              ...snapshotToWorkspacePatch(fallback.data),
            });
            if (typeof document !== "undefined") {
              document.documentElement.dataset.mapTheme = fallback.data.mapTheme;
            }
          } else {
            set({
              savedCustomPlans: nextPlans,
              activeCustomPlanId: null,
              ...snapshotToWorkspacePatch(emptyCustomPlanSnapshot()),
            });
            if (typeof document !== "undefined") {
              document.documentElement.dataset.mapTheme = "dark";
            }
          }
          return;
        }
        set({ savedCustomPlans: nextPlans });
      },

      renameCustomPlan: (id, name) => {
        const n = name.trim();
        if (!n) return;
        set((s) => ({
          savedCustomPlans: s.savedCustomPlans.map((p) => (p.id === id ? { ...p, name: n, updatedAt: Date.now() } : p)),
        }));
      },

      recoverCustomPlanWorkspaceFromLocalStorageBackup: async () => {
        const s = get();
        const locale = s.uiLocale === "zh" ? "zh" : "en";
        const currentSnap = captureCustomPlanSnapshot(s);
        const backup = await collectRichestBackupSnapshot(get);
        const resolved = resolveCustomPlanHydration({
          locale,
          rootSnapshot: currentSnap,
          savedPlans: s.savedCustomPlans,
          activePlanId: s.activeCustomPlanId,
          backupRootSnapshot: backup.root,
          backupPlans: backup.plans,
        });
        if (snapshotRichness(resolved.workspace) <= snapshotRichness(currentSnap)) return false;
        set({
          ...snapshotToWorkspacePatch(resolved.workspace),
          savedCustomPlans: resolved.savedCustomPlans,
          activeCustomPlanId: resolved.activeCustomPlanId,
        });
        if (typeof document !== "undefined") {
          document.documentElement.dataset.mapTheme = resolved.workspace.mapTheme;
        }
        flushQuotePersistDebouncedStorageNow();
        return true;
      },

      reloadPersistFromProjectFile: async () => {
        const json = await fetchProjectPersistJson();
        if (!json) {
          return { ok: false, error: "no-api" };
        }
        const st = parsePersistStateJson(json);
        const planNames = Array.isArray(st?.savedCustomPlans)
          ? (st!.savedCustomPlans as { name?: string }[])
              .map((p) => (typeof p.name === "string" ? p.name.trim() : ""))
              .filter(Boolean)
          : [];
        const imp = get().importPersistedJson(json);
        if (!imp.ok) return { ok: false, error: imp.error ?? "invalid file" };
        get().reconcileCustomPlanWorkspaceAfterHydrate();
        flushQuotePersistDebouncedStorageNow();
        return { ok: true, planNames };
      },

      syncPersistFromProjectFileIfRicher: async () => {
        const json = await fetchProjectPersistJson();
        if (!json) return { ok: false, error: "no-api" };
        const fileSt = parsePersistStateJson(json);
        if (!fileSt) return { ok: false, error: "invalid file" };
        const s = get();
        const curScore = scorePersistState({
          placements: s.placements,
          floorPlanDataUrl: s.floorPlanDataUrl,
          savedCustomPlans: s.savedCustomPlans,
        });
        const fileScore = scorePersistState(fileSt);
        if (fileScore <= curScore) return { ok: true };
        return get().reloadPersistFromProjectFile();
      },

      restoreCustomPlanFromProjectFile: async (planIdOrName) => {
        const json = await fetchProjectPersistJson();
        if (!json) return { ok: false, error: "no-api" };
        return applyCustomPlanFromPersistJson(json, planIdOrName, get, set);
      },

      listCustomPlanBackupFiles: async () => {
        if (typeof fetch === "undefined") return [];
        try {
          const r = await fetch("/api/quote-persist/backups", { cache: "no-store" });
          if (!r.ok) return [];
          const data = (await r.json()) as { files?: { name: string; mtime: string; size: number }[] };
          return Array.isArray(data.files) ? data.files : [];
        } catch {
          return [];
        }
      },

      restoreCustomPlanFromBackupFile: async (backupName, planIdOrName) => {
        if (typeof fetch === "undefined") return { ok: false, error: "no-api" };
        try {
          const r = await fetch(`/api/quote-persist/backups/${encodeURIComponent(backupName)}`, {
            cache: "no-store",
          });
          if (!r.ok) return { ok: false, error: "backup-not-found" };
          const json = await r.text();
          return applyCustomPlanFromPersistJson(json, planIdOrName, get, set);
        } catch {
          return { ok: false, error: "backup-read-failed" };
        }
      },

      reconcileCustomPlanWorkspaceAfterHydrate: () => {
        const s = get();
        const locale = s.uiLocale === "zh" ? "zh" : "en";
        const currentSnap = captureCustomPlanSnapshot(s);
        const ls = readQuotePersistStateFromLocalStorage();
        const snapCtx = customPlanSnapCtx(s);
        const backupRoot = ls ? captureCustomPlanSnapshotFromSlice(ls as Partial<CustomPlanSnapshotSource>) : null;
        const backupPlans =
          ls && Array.isArray((ls as { savedCustomPlans?: unknown }).savedCustomPlans)
            ? ((ls as { savedCustomPlans: unknown[] }).savedCustomPlans)
                .map((x) => normalizeSavedCustomPlan(x, snapCtx))
                .filter((x): x is SavedCustomPlan => x !== null)
            : [];
        const resolved = resolveCustomPlanHydration({
          locale,
          rootSnapshot: currentSnap,
          savedPlans: s.savedCustomPlans,
          activePlanId: s.activeCustomPlanId,
          backupRootSnapshot: backupRoot,
          backupPlans,
        });
        if (
          snapshotRichness(resolved.workspace) <= snapshotRichness(currentSnap) &&
          resolved.activeCustomPlanId === s.activeCustomPlanId &&
          resolved.savedCustomPlans.length === s.savedCustomPlans.length
        ) {
          return false;
        }
        set({
          ...snapshotToWorkspacePatch(resolved.workspace),
          savedCustomPlans: resolved.savedCustomPlans,
          activeCustomPlanId: resolved.activeCustomPlanId,
        });
        if (typeof document !== "undefined") {
          document.documentElement.dataset.mapTheme = resolved.workspace.mapTheme;
        }
        flushQuotePersistDebouncedStorageNow();
        return true;
      },

      setMaterialsLibraryTab: (t) => {
        set({ materialsLibraryTab: t === "product" ? "product" : "brand" });
        flushQuotePersistDebouncedStorageNow();
      },
      setMaterialsBrandNavSel: (next) => {
        set({
          materialsBrandNavSel: {
            primary: next.primary === null || next.primary === undefined ? null : String(next.primary),
            filterKey:
              next.filterKey === null || next.filterKey === undefined ? null : String(next.filterKey),
          },
        });
        flushQuotePersistDebouncedStorageNow();
      },
      setQuoteFooterCustom: (t) => set({ quoteFooterCustom: t }),
      ensureQuotationRef: () =>
        set((s) => {
          if (s.quotationRef?.trim()) return {};
          return { quotationRef: allocateNextPisellQuotationRef() };
        }),
      setFloorPlanDataUrl: (url) => {
        let changed = false;
        set((s) => {
          const prev = s.floorPlanDataUrl;
          if (url === prev) return {};
          changed = true;
          const next: {
            floorPlanDataUrl: string | null;
            floorPlanPlacementImageSpace?: boolean;
          } = { floorPlanDataUrl: url };
          if (url != null && prev != null && url !== prev) {
            next.floorPlanPlacementImageSpace = false;
          }
          return next;
        });
        if (changed) notifyCustomPlanWorkspaceChanged(get);
      },
      setFloorPlanOpacityPct: (pct) => {
        set({
          floorPlanOpacityPct:
            typeof pct === "number" && Number.isFinite(pct) ? Math.min(100, Math.max(0, Math.round(pct))) : 100,
        });
        notifyCustomPlanWorkspaceChanged(get);
      },
      setPlacements: (placements) => {
        set({
          placements: placements.map((p) => normalizePlacement(p)),
        });
        notifyCustomPlanWorkspaceChanged(get);
      },
      migrateFloorPlacementsToImageSpace: (updates) => {
        set((s) => {
          if (!updates.length) {
            return { floorPlanPlacementImageSpace: true };
          }
          const m = new Map(updates.map((u) => [u.id, u]));
          return {
            placements: s.placements.map((p) => {
              const u = m.get(p.id);
              return u ? { ...p, xPct: u.xPct, yPct: u.yPct } : p;
            }),
            floorPlanPlacementImageSpace: true,
          };
        });
        if (updates.length) notifyCustomPlanWorkspaceChanged(get);
      },
      setMapShowName: (v) => set({ mapShowName: v }),
      setMapShowQuantity: (v) => set({ mapShowQuantity: v }),
      setQuoteExportIncludeImages: (v) => set({ quoteExportIncludeImages: v }),
      setMapTheme: (t) => set({ mapTheme: t }),
      setMapPlacementGlyphScale: (n: number) =>
        set({
          mapPlacementGlyphScale:
            typeof n === "number" && Number.isFinite(n) ? Math.min(2.5, Math.max(0.5, n)) : 1,
        }),
      setQuoteTableOrder: (order: QuoteTableRowKey[] | null) => set({ quoteTableOrder: order }),

      addCategory: (name, iconKey, nameEn) => {
        const n = name.trim();
        if (!n) return;
        const key = normalizeIconKey(iconKey);
        const en = nameEn?.trim();
        const { categoryDefs } = get();
        if (categoryDefs.some((d) => d.name === n)) return;
        set({
          categoryDefs: [
            ...categoryDefs,
            { name: n, iconKey: key, ...(en ? { nameEn: en } : {}) },
          ],
        });
      },

      removeCategory: (name) => {
        if (name === UNCATEGORIZED_CATEGORY_NAME) return;
        const { categoryDefs, materials, associations } = get();
        if (!categoryDefs.some((d) => d.name === name)) return;
        set({
          categoryDefs: categoryDefs.filter((d) => d.name !== name),
          materials: materials.map((m) =>
            m.category === name ? { ...m, category: UNCATEGORIZED_CATEGORY_NAME } : m,
          ),
          associations: associations.map((a) =>
            a.hardwareName === name ? { ...a, hardwareName: UNCATEGORIZED_CATEGORY_NAME } : a,
          ),
        });
      },

      renameCategoryDef: (oldName, newName) => {
        const f = oldName.trim();
        const t = newName.trim();
        if (!f || !t || f === t) return;
        if (f === UNCATEGORIZED_CATEGORY_NAME || t === UNCATEGORIZED_CATEGORY_NAME) return;
        const s = get();
        if (!s.categoryDefs.some((d) => d.name === f)) return;
        if (s.categoryDefs.some((d) => d.name === t)) return;
        set({
          categoryDefs: s.categoryDefs.map((d) => (d.name === f ? { ...d, name: t } : d)),
          materials: s.materials.map((m) => (m.category === f ? { ...m, category: t } : m)),
          associations: s.associations.map((a) => (a.hardwareName === f ? { ...a, hardwareName: t } : a)),
          softwareFeatures: s.softwareFeatures.map((row) =>
            row.featureCategory === f ? { ...row, featureCategory: t } : row,
          ),
          serviceItems: s.serviceItems.map((row) => (row.serviceCategory === f ? { ...row, serviceCategory: t } : row)),
        });
      },

      setCategoryIcon: (name, iconKey) =>
        set((s) => ({
          categoryDefs: s.categoryDefs.map((d) =>
            d.name === name ? { ...d, iconKey: normalizeIconKey(iconKey) } : d,
          ),
        })),

      patchCategoryDef: (name, patch) => {
        const n = name.trim();
        if (!n) return;
        set((s) => ({
          categoryDefs: s.categoryDefs.map((d) => {
            if (d.name !== n) return d;
            const next: MaterialCategoryDef = { ...d };
            if (patch.iconKey !== undefined) next.iconKey = normalizeIconKey(patch.iconKey);
            if (patch.nameEn !== undefined) {
              const en = patch.nameEn?.trim();
              if (en) next.nameEn = en;
              else delete next.nameEn;
            }
            if (patch.defaultMapColor !== undefined) {
              const c = patch.defaultMapColor.trim();
              if (/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/i.test(c)) next.defaultMapColor = c;
              else delete next.defaultMapColor;
            }
            return next;
          }),
        }));
      },

      reorderCategoryDefs: (orderedNames) => {
        set((s) => {
          const by = new Map(s.categoryDefs.map((d) => [d.name, d]));
          const unc = UNCATEGORIZED_CATEGORY_NAME;
          const next: MaterialCategoryDef[] = [];
          const seen = new Set<string>();
          for (const name of orderedNames) {
            if (name === unc) continue;
            const d = by.get(name);
            if (d) {
              next.push(d);
              seen.add(d.name);
            }
          }
          for (const d of s.categoryDefs) {
            if (d.name === unc || seen.has(d.name)) continue;
            next.push(d);
            seen.add(d.name);
          }
          const u = by.get(unc);
          return { categoryDefs: u ? [...next, u] : next };
        });
      },

      addMaterials: (pages) =>
        set((s) => {
          const ids = pages.map((p) => p.id);
          return {
            materials: [...s.materials, ...pages],
            layoutMaterialOrder: [...s.layoutMaterialOrder, ...ids],
          };
        }),

      removeMaterial: (id) =>
        set((s) => ({
          materials: s.materials.filter((m) => m.id !== id),
          layoutMaterialOrder: s.layoutMaterialOrder.filter((x) => x !== id),
          associations: s.associations.map((a) => ({
            ...a,
            productMaterialId: a.productMaterialId === id ? null : a.productMaterialId,
            quoteAdMaterialId: a.quoteAdMaterialId === id ? null : a.quoteAdMaterialId,
            technicalMaterialId: a.technicalMaterialId === id ? null : a.technicalMaterialId,
          })),
          softwareFeatures: s.softwareFeatures.map((f) => ({
            ...f,
            docMaterialIds: f.docMaterialIds.map((mid) => (mid === id ? null : mid)) as SoftwareFeatureRow["docMaterialIds"],
          })),
          planPages: s.planPages.map((p) =>
            p.overlayMaterialId === id ? { ...p, overlayMaterialId: null, overlayCropAspect: null } : p,
          ),
        })),

      patchMaterial: (id, patch) =>
        set((s) => ({
          materials: s.materials.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),

      setMaterialCategory: (id, category) =>
        set((s) => ({
          materials: s.materials.map((m) => (m.id === id ? { ...m, category } : m)),
        })),

      setLayoutOrder: (ids) => set({ layoutMaterialOrder: ids }),

      replacePlanFromPdf: async (file) => {
        const slices = await splitPdfToJpegPages(file);
        set({
          planPages: slices.map((s) => ({
            id: crypto.randomUUID(),
            backgroundDataUrl: s.dataUrl,
            widthPx: s.widthPx,
            heightPx: s.heightPx,
            sourceFileName: file.name,
            sourcePage: s.sourcePage,
            backgroundMaterialId: null,
            overlayMaterialId: null,
            overlayCropAspect: null,
          })),
        });
      },

      clearPlanPages: () => set({ planPages: [] }),

      appendPlanPagesFromMaterials: (materialIds) =>
        set((s) => {
          const byId = new Map(s.materials.map((m) => [m.id, m]));
          const additions: PlanPage[] = [];
          for (const mid of materialIds) {
            const m = byId.get(mid);
            if (!m) continue;
            additions.push({
              id: crypto.randomUUID(),
              backgroundDataUrl: m.dataUrl,
              widthPx: m.widthPx,
              heightPx: m.heightPx,
              sourceFileName: m.fileName,
              sourcePage: m.sourcePage,
              backgroundMaterialId: m.id,
              overlayMaterialId: null,
              overlayCropAspect: null,
            });
          }
          if (!additions.length) return s;
          return { planPages: [...s.planPages, ...additions] };
        }),

      setPlanPageOverlay: (pageId, materialId) =>
        set((s) => ({
          planPages: s.planPages.map((p) => {
            if (p.id !== pageId) return p;
            if (materialId === null) {
              return { ...p, overlayMaterialId: null, overlayCropAspect: null };
            }
            const same = materialId === p.overlayMaterialId;
            return {
              ...p,
              overlayMaterialId: materialId,
              overlayCropAspect: same ? p.overlayCropAspect : null,
            };
          }),
        })),

      setPlanPageOverlayCrop: (pageId, aspect) =>
        set((s) => ({
          planPages: s.planPages.map((p) => {
            if (p.id !== pageId) return p;
            const a = aspect?.trim();
            if (!a) return { ...p, overlayCropAspect: null };
            if (/^\d+:\d+$/.test(a)) return { ...p, overlayCropAspect: a };
            return p;
          }),
        })),

      setPlanPagePreviewExtra: (pageId, extra) =>
        set((s) => ({
          planPages: s.planPages.map((p) =>
            p.id === pageId ? { ...p, previewExtra: normalizePlanPreviewExtra(extra) } : p,
          ),
        })),

      insertPlanPageClone: (sourcePageId, previewExtra) => {
        let newId = "";
        set((s) => {
          const i = s.planPages.findIndex((p) => p.id === sourcePageId);
          if (i < 0) return s;
          const base = s.planPages[i]!;
          newId = crypto.randomUUID();
          const ex =
            previewExtra !== undefined && previewExtra !== null
              ? normalizePlanPreviewExtra(previewExtra)
              : base.previewExtra
                ? normalizePlanPreviewExtra(base.previewExtra)
                : null;
          const baseName = base.sourceFileName.replace(/\s*（副本）$/u, "");
          const copy: PlanPage = {
            ...base,
            id: newId,
            sourceFileName: `${baseName}（副本）`,
            previewExtra: ex ?? null,
          };
          return { planPages: [...s.planPages.slice(0, i + 1), copy, ...s.planPages.slice(i + 1)] };
        });
        return newId;
      },

      setPlanPageOrder: (orderedIds) =>
        set((s) => {
          const m = new Map(s.planPages.map((p) => [p.id, p]));
          const next = orderedIds.map((id) => m.get(id)).filter(Boolean) as PlanPage[];
          const tail = s.planPages.filter((p) => !orderedIds.includes(p.id));
          return { planPages: [...next, ...tail] };
        }),

      applyLayoutOrderToPlanPages: () =>
        set((s) => {
          const order = orderedMaterialIds(s.materials, s.layoutMaterialOrder).filter((mid) => {
            const k = s.materials.find((m) => m.id === mid)?.imageKind;
            return k !== "softwareDoc";
          });
          return {
            planPages: s.planPages.map((p, i) => ({
              ...p,
              overlayMaterialId: order[i] ?? null,
              overlayCropAspect: null,
            })),
          };
        }),

      applySoftwareFeatureToPlan: (featureId, startPlanPageId) =>
        set((s) => {
          const feat = s.softwareFeatures.find((f) => f.id === featureId);
          if (!feat) return s;
          const docIds: string[] = [];
          for (let i = 0; i < 3; i++) {
            const mid = feat.docMaterialIds[i];
            if (mid) docIds.push(mid);
          }
          if (!docIds.length) return s;
          const start = s.planPages.findIndex((p) => p.id === startPlanPageId);
          if (start < 0) return s;
          return {
            planPages: s.planPages.map((p, i) => {
              const oi = i - start;
              if (oi >= 0 && oi < docIds.length) {
                return { ...p, overlayMaterialId: docIds[oi]!, overlayCropAspect: null };
              }
              return p;
            }),
          };
        }),

      rebuildPlanPagesFromProposal: () =>
        set((s) => {
          const ids = collectDefaultSolutionBookMaterialIds({
            materials: s.materials,
            layoutMaterialOrder: s.layoutMaterialOrder,
            placements: s.placements,
            associations: s.associations,
            customPlanSoftwareLines: s.customPlanSoftwareLines,
            softwareFeatures: s.softwareFeatures,
          });
          const byId = new Map(s.materials.map((m) => [m.id, m]));
          const next: PlanPage[] = [];
          for (const mid of ids) {
            const m = byId.get(mid);
            if (!m) continue;
            next.push({
              id: crypto.randomUUID(),
              backgroundDataUrl: m.dataUrl,
              widthPx: m.widthPx,
              heightPx: m.heightPx,
              sourceFileName: m.fileName,
              sourcePage: m.sourcePage,
              backgroundMaterialId: m.id,
              overlayMaterialId: null,
              overlayCropAspect: null,
              previewExtra: null,
            });
          }
          return { planPages: next };
        }),

      savePlanTemplate: (name) =>
        set((s) => {
          const trimmed = name.trim();
          if (!trimmed || s.planPages.length === 0) return s;
          const slice = {
            materials: s.materials,
            layoutMaterialOrder: s.layoutMaterialOrder,
            placements: s.placements,
            associations: s.associations,
            customPlanSoftwareLines: s.customPlanSoftwareLines,
            softwareFeatures: s.softwareFeatures,
          };
          const pages = buildTemplateEntriesFromPlanPages(s.planPages, slice);
          const tpl: SavedPlanTemplate = {
            id: crypto.randomUUID(),
            name: trimmed,
            createdAt: Date.now(),
            pages,
          };
          return { planTemplates: [...s.planTemplates, tpl] };
        }),

      deletePlanTemplate: (id) => set((s) => ({ planTemplates: s.planTemplates.filter((t) => t.id !== id) })),

      applyPlanTemplate: (id) =>
        set((s) => {
          const t = s.planTemplates.find((x) => x.id === id);
          if (!t?.pages?.length) return s;
          const slice = {
            materials: s.materials,
            layoutMaterialOrder: s.layoutMaterialOrder,
            placements: s.placements,
            associations: s.associations,
            customPlanSoftwareLines: s.customPlanSoftwareLines,
            softwareFeatures: s.softwareFeatures,
          };
          const planPages = materializePlanPagesFromTemplate(t.pages, slice);
          if (!planPages.length) return s;
          return { planPages };
        }),

      upsertSoftwareFeature: (row) => {
        const normalized = normalizeSoftwareFeatureRow(row);
        set((s) => {
          const idx = s.softwareFeatures.findIndex((f) => f.id === normalized.id);
          if (idx === -1) return { softwareFeatures: [...s.softwareFeatures, normalized] };
          const next = [...s.softwareFeatures];
          next[idx] = normalized;
          return { softwareFeatures: next };
        });
        flushQuotePersistDebouncedStorageNow();
      },

      removeSoftwareFeature: (id) => {
        set((s) => ({
          softwareFeatures: s.softwareFeatures.filter((f) => f.id !== id),
          customPlanSoftwareLines: s.customPlanSoftwareLines.filter((l) => l.catalogFeatureId !== id),
        }));
        flushQuotePersistDebouncedStorageNow();
      },

      addCustomPlanSoftwareLine: (line) =>
        set((s) => {
          const row = normalizeCustomPlanSoftwareLine({ ...line, id: line.id ?? crypto.randomUUID() });
          if (!row.catalogFeatureId || !s.softwareFeatures.some((f) => f.id === row.catalogFeatureId)) return s;
          const feat = s.softwareFeatures.find((f) => f.id === row.catalogFeatureId);
          if (!feat) return s;
          let optionId = row.optionId;
          if (feat.options.length) {
            if (!optionId || !feat.options.some((o) => o.id === optionId)) optionId = feat.options[0]!.id;
          } else {
            optionId = null;
          }
          const validAd = new Set(feat.addons.map((a) => a.id));
          const addonQtyById = filterAddonQtyMapForCatalog(mergeAddonQtyMap(row), validAd);
          const addonIds = addonIdsSortedFromQty(addonQtyById);
          return {
            customPlanSoftwareLines: [
              ...s.customPlanSoftwareLines,
              { ...row, optionId, addonIds, addonQtyById },
            ],
          };
        }),

      patchCustomPlanSoftwareLine: (id, patch) =>
        set((s) => {
          const cur = s.customPlanSoftwareLines.find((l) => l.id === id);
          if (!cur) return s;
          const feat = s.softwareFeatures.find((f) => f.id === (patch.catalogFeatureId ?? cur.catalogFeatureId));
          if (!feat) return s;
          const merged = normalizeCustomPlanSoftwareLine({ ...cur, ...patch, id });
          let optionId = merged.optionId;
          if (feat.options.length) {
            if (!optionId || !feat.options.some((o) => o.id === optionId)) optionId = feat.options[0]!.id;
          } else {
            optionId = null;
          }
          const validAd = new Set(feat.addons.map((a) => a.id));
          const addonQtyById = filterAddonQtyMapForCatalog(mergeAddonQtyMap(merged), validAd);
          const addonIds = addonIdsSortedFromQty(addonQtyById);
          return {
            customPlanSoftwareLines: s.customPlanSoftwareLines.map((l) =>
              l.id === id ? { ...merged, optionId, addonIds, addonQtyById } : l,
            ),
          };
        }),

      removeCustomPlanSoftwareLine: (id) =>
        set((s) => ({
          customPlanSoftwareLines: s.customPlanSoftwareLines.filter((l) => l.id !== id),
        })),

      reorderCustomPlanSoftwareLines: (draggedLineId, targetLineId) =>
        set((s) => {
          if (draggedLineId === targetLineId) return s;
          const lines = s.customPlanSoftwareLines;
          const from = lines.findIndex((l) => l.id === draggedLineId);
          const to = lines.findIndex((l) => l.id === targetLineId);
          if (from === -1 || to === -1) return s;
          return { customPlanSoftwareLines: moveLineBeforeTarget(lines, from, to) };
        }),

      upsertServiceItem: (row) => {
        const normalized = normalizeServiceRow(row);
        set((s) => {
          const idx = s.serviceItems.findIndex((f) => f.id === normalized.id);
          if (idx === -1) return { serviceItems: [...s.serviceItems, normalized] };
          const next = [...s.serviceItems];
          next[idx] = normalized;
          return { serviceItems: next };
        });
        flushQuotePersistDebouncedStorageNow();
      },

      removeServiceItem: (id) => {
        set((s) => ({
          serviceItems: s.serviceItems.filter((f) => f.id !== id),
          customPlanServiceLines: s.customPlanServiceLines.filter((l) => l.catalogServiceId !== id),
        }));
        flushQuotePersistDebouncedStorageNow();
      },

      addCustomPlanServiceLine: (line) =>
        set((s) => {
          const row = normalizeCustomPlanServiceLine({ ...line, id: line.id ?? crypto.randomUUID() });
          if (!row.catalogServiceId || !s.serviceItems.some((x) => x.id === row.catalogServiceId)) return s;
          const svc = s.serviceItems.find((x) => x.id === row.catalogServiceId);
          if (!svc) return s;
          let optionId = row.optionId;
          if (svc.options.length) {
            if (!optionId || !svc.options.some((o) => o.id === optionId)) optionId = svc.options[0]!.id;
          } else {
            optionId = null;
          }
          const validAd = new Set(svc.addons.map((a) => a.id));
          const addonQtyById = filterAddonQtyMapForCatalog(mergeAddonQtyMap(row), validAd);
          const addonIds = addonIdsSortedFromQty(addonQtyById);
          return {
            customPlanServiceLines: [...s.customPlanServiceLines, { ...row, optionId, addonIds, addonQtyById }],
          };
        }),

      patchCustomPlanServiceLine: (id, patch) =>
        set((s) => {
          const cur = s.customPlanServiceLines.find((l) => l.id === id);
          if (!cur) return s;
          const svc = s.serviceItems.find((x) => x.id === (patch.catalogServiceId ?? cur.catalogServiceId));
          if (!svc) return s;
          const merged = normalizeCustomPlanServiceLine({ ...cur, ...patch, id });
          let optionId = merged.optionId;
          if (svc.options.length) {
            if (!optionId || !svc.options.some((o) => o.id === optionId)) optionId = svc.options[0]!.id;
          } else {
            optionId = null;
          }
          const validAd = new Set(svc.addons.map((a) => a.id));
          const addonQtyById = filterAddonQtyMapForCatalog(mergeAddonQtyMap(merged), validAd);
          const addonIds = addonIdsSortedFromQty(addonQtyById);
          return {
            customPlanServiceLines: s.customPlanServiceLines.map((l) =>
              l.id === id ? { ...merged, optionId, addonIds, addonQtyById } : l,
            ),
          };
        }),

      removeCustomPlanServiceLine: (id) =>
        set((s) => ({
          customPlanServiceLines: s.customPlanServiceLines.filter((l) => l.id !== id),
        })),

      reorderCustomPlanServiceLines: (draggedLineId, targetLineId) =>
        set((s) => {
          if (draggedLineId === targetLineId) return s;
          const lines = s.customPlanServiceLines;
          const from = lines.findIndex((l) => l.id === draggedLineId);
          const to = lines.findIndex((l) => l.id === targetLineId);
          if (from === -1 || to === -1) return s;
          return { customPlanServiceLines: moveLineBeforeTarget(lines, from, to) };
        }),

      upsertAssociation: (row) =>
        set((s) => {
          const r = normalizeAssociationRow(row);
          const idx = s.associations.findIndex((a) => a.id === r.id);
          if (idx === -1) return { associations: [...s.associations, r] };
          const next = [...s.associations];
          next[idx] = r;
          return { associations: next };
        }),

      removeAssociation: (id) =>
        set((s) => ({
          associations: s.associations.filter((a) => a.id !== id),
          placements: s.placements.filter((p) => p.associationId !== id),
        })),

      addPlacement: (associationId, optionId, extras) => {
        let added = false;
        set((s) => {
          const assoc = s.associations.find((a) => a.id === associationId);
          if (!assoc) return s;
          added = true;
          const opts = assoc.options ?? [];
          let resolvedOptionId: string | null = optionId ?? null;
          if (opts.length) {
            if (!resolvedOptionId || !opts.some((o) => o.id === resolvedOptionId)) {
              resolvedOptionId = opts[0]!.id;
            }
          } else {
            resolvedOptionId = null;
          }
          const n = s.placements.filter((p) => p.associationId === associationId).length;
          const k = Math.max(1, opts.length);
          const lane = resolvedOptionId ? Math.max(0, opts.findIndex((o) => o.id === resolvedOptionId)) : 0;

          const hasXY =
            extras &&
            typeof extras.xPct === "number" &&
            Number.isFinite(extras.xPct) &&
            typeof extras.yPct === "number" &&
            Number.isFinite(extras.yPct);
          let xPct: number;
          let yPct: number;
          if (hasXY) {
            xPct = Math.min(94, Math.max(2, extras!.xPct!));
            yPct = Math.min(94, Math.max(2, extras!.yPct!));
          } else {
            const xCenter = k <= 1 ? 50 : 10 + ((lane + 0.5) / k) * 80;
            xPct = Math.min(90, Math.max(8, xCenter + ((n % 3) - 1) * 5));
            yPct = 10 + Math.floor(n / 6) * 14;
          }

          const validAd = new Set(assoc.addons.map((ad) => ad.id));
          const addonIds = (extras?.addonIds ?? []).filter((id) => validAd.has(id));

          return {
            placements: [
              ...s.placements,
              {
                id: crypto.randomUUID(),
                associationId,
                xPct,
                yPct,
                qty: 1,
                optionId: resolvedOptionId,
                addonIds,
              },
            ],
          };
        });
        if (added) notifyCustomPlanWorkspaceChanged(get);
      },

      updatePlacement: (placementId, xPct, yPct) => {
        set((s) => ({
          placements: s.placements.map((p) => (p.id === placementId ? { ...p, xPct, yPct } : p)),
        }));
        notifyCustomPlanWorkspaceChanged(get);
      },

      patchPlacement: (placementId, patch) => {
        set((s) => ({
          placements: s.placements.map((p) => {
            if (p.id !== placementId) return p;
            const next = normalizePlacement({ ...p, ...patch });
            const assoc = s.associations.find((a) => a.id === next.associationId);
            if (!assoc) return next;
            const optIds = new Set(assoc.options.map((o) => o.id));
            let optionId = next.optionId;
            if (assoc.options.length === 0) optionId = null;
            else if (!optionId || !optIds.has(optionId)) optionId = assoc.options[0]!.id;
            const validAd = new Set(assoc.addons.map((ad) => ad.id));
            const addonIds = (next.addonIds ?? []).filter((id) => validAd.has(id));
            return { ...next, optionId, addonIds };
          }),
        }));
        notifyCustomPlanWorkspaceChanged(get);
      },

      removePlacement: (placementId) => {
        set((s) => ({
          placements: s.placements.filter((p) => p.id !== placementId),
        }));
        notifyCustomPlanWorkspaceChanged(get);
      },

      clearPlacementsForAssociation: (associationId) => {
        set((s) => ({
          placements: s.placements.filter((p) => p.associationId !== associationId),
        }));
        notifyCustomPlanWorkspaceChanged(get);
      },

      patchAssociation: (id, patch) =>
        set((s) => {
          const associations = s.associations.map((a) =>
            a.id === id ? normalizeAssociationRow({ ...a, ...patch }) : a,
          );
          const nextAssoc = associations.find((a) => a.id === id);
          let placements = s.placements;
          if (nextAssoc && (patch.options !== undefined || patch.addons !== undefined)) {
            placements = placements.map((p) => {
              if (p.associationId !== id) return p;
              let q = normalizePlacement(p);
              if (nextAssoc.options.length === 0) q = { ...q, optionId: null };
              else if (!q.optionId || !nextAssoc.options.some((o) => o.id === q.optionId)) {
                q = { ...q, optionId: nextAssoc.options[0]!.id };
              }
              const validAd = new Set(nextAssoc.addons.map((ad) => ad.id));
              q = { ...q, addonIds: (q.addonIds ?? []).filter((x) => validAd.has(x)) };
              return q;
            });
          }
          return { associations, placements };
        }),

      patchQuotePdfExportStyle: (patch) =>
        set((s) => ({
          quotePdfExportStyle: normalizeQuotePdfExportStyle({ ...s.quotePdfExportStyle, ...patch }),
        })),

      setErpTopModule: (m) => {
        set({ erpTopModule: m === "customer" || m === "inventory" || m === "staff" ? m : "inventory" });
        flushQuotePersistDebouncedStorageNow();
      },
      setErpInvSubTab: (t) => {
        set({ erpInvSubTab: t === "inbound" || t === "catalog" ? t : "inbound" });
        flushQuotePersistDebouncedStorageNow();
      },
      setErpCatalogFocus: (k) => set({ erpCatalogFocus: k }),
      setErpCatalogSelection: (s) => set({ erpCatalogSelection: s }),
      setErpCatalogKindFilter: (kind, next) => {
        set((s) => ({
          erpCatalogActiveKind: kind,
          erpCatalogSel: { ...s.erpCatalogSel, [kind]: next },
          erpCatalogSelection: null,
        }));
        flushQuotePersistDebouncedStorageNow();
      },
      resetErpCatalogNavFilters: () =>
        set(() => ({
          erpCatalogSel: {
            hardware: { primary: null, filterKey: null },
            software: { primary: null, filterKey: null },
            service: { primary: null, filterKey: null },
          },
          erpCatalogSelection: null,
        })),
      setErpCatalogSearchQuery: (q) => set({ erpCatalogSearchQuery: q }),
      setErpHardwareNavSortMode: (m) =>
        set({ erpHardwareNavSortMode: m === "az" || m === "manual" ? m : "manual" }),
      reorderHardwareCategoryPrimaries: (orderedPrimaries) =>
        set((s) => ({
          categoryDefs: reorderCategoryDefsByHardwarePrimary(s.categoryDefs, orderedPrimaries),
        })),
      openErpInventoryCatalog: (focus) => {
        set({
          activeTab: "erp",
          erpTopModule: "inventory",
          erpInvSubTab: "catalog",
          erpCatalogFocus: focus,
        });
        flushQuotePersistDebouncedStorageNow();
      },

      patchErpInventoryLine: (id, patch) =>
        set((s) => ({
          erpInventoryLines: s.erpInventoryLines.map((row) =>
            row.id === id ? normalizeErpInventoryLine({ ...row, ...patch, id: row.id }) : row,
          ),
        })),

      ensureErpInventoryRow: (kind, catalogRefId, catalogOptionId) => {
        const ref = catalogRefId.trim();
        if (!ref) return "";
        const opt =
          kind === "hardware" && typeof catalogOptionId === "string" && catalogOptionId.trim()
            ? catalogOptionId.trim()
            : null;
        let outId = "";
        set((s) => {
          const hit = s.erpInventoryLines.find(
            (l) => l.kind === kind && l.catalogRefId === ref && (l.catalogOptionId ?? null) === opt,
          );
          if (hit) {
            outId = hit.id;
            return s;
          }
          const row = normalizeErpInventoryLine({ kind, catalogRefId: ref, catalogOptionId: opt });
          outId = row.id;
          return { erpInventoryLines: [...s.erpInventoryLines, row] };
        });
        return outId;
      },

      recordErpStockIn: (kind, catalogRefId, qty, opts) => {
        const ref = catalogRefId.trim();
        const q = Math.floor(Number(qty));
        if (!ref) return { ok: false, error: "bad_ref" };
        if (!Number.isFinite(q) || q <= 0) return { ok: false, error: "bad_qty" };
        const bc = (opts?.barcode ?? "").trim();
        const catalogOptionId =
          kind === "hardware" && typeof opts?.catalogOptionId === "string" && opts.catalogOptionId.trim()
            ? opts.catalogOptionId.trim()
            : null;
        let err: string | null = null;
        set((s) => {
          let lines = [...s.erpInventoryLines];
          const idx = lines.findIndex(
            (l) => l.kind === kind && l.catalogRefId === ref && (l.catalogOptionId ?? null) === catalogOptionId,
          );
          const clash = bc
            ? findBarcodeClash(
                lines,
                bc,
                idx >= 0 ? { lineId: lines[idx]!.id } : { kind, catalogRefId: ref, catalogOptionId },
                s.associations,
              )
            : null;
          if (clash) {
            err = "barcode_conflict";
            return s;
          }
          if (idx < 0) {
            lines.push(
              normalizeErpInventoryLine({
                kind,
                catalogRefId: ref,
                catalogOptionId,
                barcode: bc,
                quantityOnHand: q,
                lastInboundAt: Date.now(),
              }),
            );
          } else {
            const cur = lines[idx]!;
            if (bc && cur.barcode.trim() && cur.barcode.trim() !== bc) {
              err = "barcode_mismatch";
              return s;
            }
            const nextBarcode = bc && !cur.barcode.trim() ? bc : cur.barcode;
            lines[idx] = normalizeErpInventoryLine({
              ...cur,
              barcode: nextBarcode,
              quantityOnHand: cur.quantityOnHand + q,
              lastInboundAt: Date.now(),
            });
          }
          const mov = normalizeErpStockMovement({
            direction: "in",
            kind,
            catalogRefId: ref,
            ...(catalogOptionId ? { catalogOptionId } : {}),
            qty: q,
            note: opts?.note,
            barcodeSnapshot: bc || undefined,
          });
          return {
            erpInventoryLines: lines,
            erpStockMovements: [mov, ...s.erpStockMovements].slice(0, 500),
          };
        });
        return err ? { ok: false, error: err } : { ok: true };
      },

      importFromPisellWorkbook: async (file) => {
        const buf = await file.arrayBuffer();
        const { categoryDefs } = get();
        const bundle = await importPisellHardwareFromWorkbook(buf, {
          categoryDefs,
        });
        const bid = bundledPisellHardwareBuildId();
        set((s) => ({
          ...s,
          ...patchStateWithHardwareCatalogBundle(s, bundle),
          bundledHardwareCatalogBuildId: bid > 0 ? bid : s.bundledHardwareCatalogBuildId,
        }));
        flushQuotePersistDebouncedStorageNow();
        return bundle.result;
      },

      applyBundledPisellHardwareSeed: async () => {
        try {
          const m = materializeBundledPisellCatalog();
          if (!m) {
            return {
              ok: false,
              error: "Bundled catalog is empty. Run: npm run generate:pisell-seed (writes src/data/pisellHardwareSeed.json)",
            };
          }
          const bundle = {
            materials: m.materials,
            associations: m.associations,
            erpInventoryLines: m.erpInventoryLines,
          };
          set((s) => ({
            ...s,
            ...patchStateWithHardwareCatalogBundle(s, bundle),
            bundledHardwareCatalogBuildId: m.buildId,
          }));
          flushQuotePersistDebouncedStorageNow();
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : "Load failed" };
        }
      },

      ensureBundledHardwareCatalogSynced: () => {
        const m = materializeBundledPisellCatalog();
        if (!m) return;
        const s = get();
        if ((s.bundledHardwareCatalogBuildId ?? null) === m.buildId) return;
        // 已有用户硬件目录时只对齐版本号，避免启动时用内置种子覆盖导入数据
        if (s.associations.length > 0) {
          set({ bundledHardwareCatalogBuildId: m.buildId });
          return;
        }
        const bundle = {
          materials: m.materials,
          associations: m.associations,
          erpInventoryLines: m.erpInventoryLines,
        };
        set((state) => ({
          ...state,
          ...patchStateWithHardwareCatalogBundle(state, bundle),
          bundledHardwareCatalogBuildId: m.buildId,
        }));
      },

      recategorizeUncategorizedHardware: () => {
        set((s) => {
          const STALE = new Set<string>([UNCATEGORIZED_CATEGORY_NAME, HARDWARE_IOT_BUCKET_CATEGORY_NAME]);
          const matById = new Map(s.materials.map((m) => [m.id, m]));
          let touched = false;
          const matCategoryPatches = new Map<string, string>();
          const nextAss = s.associations.map((a) => {
            const model = String(a.deviceModel ?? "").trim();
            const inferred =
              model.length > 0 ? inferHardwareCategoryFromItem(model, s.categoryDefs) : UNCATEGORIZED_CATEGORY_NAME;
            const hw = normalizeStorageCategory(a.hardwareName);
            const shouldFixHw = inferred !== UNCATEGORIZED_CATEGORY_NAME && STALE.has(hw);
            let next = a;
            if (shouldFixHw) {
              touched = true;
              next = { ...a, hardwareName: inferred };
            }
            for (const mid of [a.productMaterialId, a.quoteAdMaterialId, a.technicalMaterialId]) {
              if (!mid) continue;
              const m = matById.get(mid);
              const mc = normalizeStorageCategory(m?.category);
              if (m && inferred !== UNCATEGORIZED_CATEGORY_NAME && STALE.has(mc)) {
                matCategoryPatches.set(mid, inferred);
                touched = true;
              }
            }
            return next;
          });
          if (!touched) return s;
          const nextMats = s.materials.map((m) => {
            const nextCat = matCategoryPatches.get(m.id);
            if (!nextCat) return m;
            return { ...m, category: nextCat };
          });
          return { ...s, associations: nextAss, materials: nextMats };
        });
      },

      setQuoteGlobalPriceTier: (t) => {
        if (t === "regular" || t === "vip" || t === "vvip") set({ quoteGlobalPriceTier: t });
      },

      resetHardwareQuoteTierModesToFollow: () =>
        set((s) => ({
          associations: s.associations.map((a) => ({ ...a, quoteTierMode: "follow" as const })),
        })),

      exportPersistedJson: () => {
        const s = get();
        const slice = {
          categoryDefs: s.categoryDefs,
          materials: s.materials,
          layoutMaterialOrder: s.layoutMaterialOrder,
          planPages: s.planPages,
          planTemplates: s.planTemplates,
          quoteTemplates: s.quoteTemplates,
          quotePdfTemplateId: s.quotePdfTemplateId,
          enterpriseResourceMainTab: s.enterpriseResourceMainTab,
          softwareFeatures: s.softwareFeatures,
          serviceItems: s.serviceItems,
          customPlanSoftwareLines: s.customPlanSoftwareLines,
          customPlanServiceLines: s.customPlanServiceLines,
          associations: s.associations,
          placements: s.placements,
          quoteFooterCustom: s.quoteFooterCustom,
          quotationRef: s.quotationRef,
          floorPlanDataUrl: s.floorPlanDataUrl,
          floorPlanOpacityPct: s.floorPlanOpacityPct,
          floorPlanPlacementImageSpace: s.floorPlanPlacementImageSpace,
          mapShowName: s.mapShowName,
          mapShowQuantity: s.mapShowQuantity,
          quoteExportIncludeImages: s.quoteExportIncludeImages,
          mapTheme: s.mapTheme,
          mapPlacementGlyphScale: s.mapPlacementGlyphScale,
          quoteTableOrder: s.quoteTableOrder,
          quotePdfExportStyle: s.quotePdfExportStyle,
          companyLogoDataUrl: s.companyLogoDataUrl,
          companyName: s.companyName,
          companyTagline: s.companyTagline,
          companyAddress: s.companyAddress,
          companyPhone: s.companyPhone,
          companyEmail: s.companyEmail,
          companyWebsite: s.companyWebsite,
          companyCatalogCurrency: s.companyCatalogCurrency,
          companyCatalogFxMultiplier: s.companyCatalogFxMultiplier,
          quoteGlobalPriceTier: s.quoteGlobalPriceTier,
          uiLocale: s.uiLocale,
          uiThemeBundle: s.uiThemeBundle,
          erpTopModule: s.erpTopModule,
          erpInvSubTab: s.erpInvSubTab,
          erpCatalogFocus: s.erpCatalogFocus,
          erpCatalogActiveKind: s.erpCatalogActiveKind,
          erpCatalogSel: s.erpCatalogSel,
          erpCatalogSearchQuery: s.erpCatalogSearchQuery,
          erpInventoryLines: s.erpInventoryLines,
          erpStockMovements: s.erpStockMovements,
          bundledHardwareCatalogBuildId: s.bundledHardwareCatalogBuildId,
          activeTab: s.activeTab,
          crmCustomers: s.crmCustomers,
          activeCrmCustomerId: s.activeCrmCustomerId,
          resourceLibrarySubTab: s.resourceLibrarySubTab,
          customPlanTab: s.customPlanTab,
          customPlanSelectStep: s.customPlanSelectStep,
          savedCustomPlans: s.savedCustomPlans,
          activeCustomPlanId: s.activeCustomPlanId,
          materialsLibraryTab: s.materialsLibraryTab,
          materialsBrandNavSel: s.materialsBrandNavSel,
        };
        return JSON.stringify({ v: 1, exportedAt: Date.now(), state: slice });
      },

      importPersistedJson: (json) => {
        try {
          const parsed = JSON.parse(json) as { state?: Record<string, unknown> };
          const st = parsed?.state;
          if (!st || typeof st !== "object") return { ok: false, error: "Invalid file" };
          set((s) => {
            const next = { ...s } as State;
            if (Array.isArray(st.materials)) next.materials = st.materials as MaterialPage[];
            if (Array.isArray(st.associations))
              next.associations = (st.associations as Partial<AssociationRow>[]).map((a) =>
                normalizeAssociationRow(a as AssociationRow),
              );
            if (Array.isArray(st.placements))
              next.placements = (st.placements as Partial<HardwarePlacement>[]).map((p) =>
                normalizePlacement(p as HardwarePlacement),
              );
            if (Array.isArray(st.categoryDefs)) next.categoryDefs = st.categoryDefs as MaterialCategoryDef[];
            if (Array.isArray(st.layoutMaterialOrder))
              next.layoutMaterialOrder = st.layoutMaterialOrder as string[];
            if (Array.isArray(st.planPages)) next.planPages = st.planPages as PlanPage[];
            if (Array.isArray(st.softwareFeatures))
              next.softwareFeatures = (st.softwareFeatures as Partial<SoftwareFeatureRow>[]).map((x) =>
                normalizeSoftwareFeatureRow(x),
              );
            if (Array.isArray(st.serviceItems))
              next.serviceItems = (st.serviceItems as Partial<ServiceRow>[]).map((x) => normalizeServiceRow(x));
            if (typeof st.companyCatalogCurrency === "string")
              next.companyCatalogCurrency = st.companyCatalogCurrency;
            if (typeof st.companyCatalogFxMultiplier === "number" && Number.isFinite(st.companyCatalogFxMultiplier))
              next.companyCatalogFxMultiplier = Math.max(0.0001, st.companyCatalogFxMultiplier);
            if (st.quoteGlobalPriceTier === "regular" || st.quoteGlobalPriceTier === "vip" || st.quoteGlobalPriceTier === "vvip")
              next.quoteGlobalPriceTier = st.quoteGlobalPriceTier;
            if (typeof st.quoteFooterCustom === "string") next.quoteFooterCustom = st.quoteFooterCustom;
            if (typeof st.floorPlanDataUrl === "string" || st.floorPlanDataUrl === null)
              next.floorPlanDataUrl = st.floorPlanDataUrl as string | null;
            if (typeof (st as { floorPlanOpacityPct?: unknown }).floorPlanOpacityPct === "number") {
              const v = (st as { floorPlanOpacityPct: number }).floorPlanOpacityPct;
              if (Number.isFinite(v)) next.floorPlanOpacityPct = Math.min(100, Math.max(0, Math.round(v)));
            }
            if (typeof st.floorPlanPlacementImageSpace === "boolean")
              next.floorPlanPlacementImageSpace = st.floorPlanPlacementImageSpace;
            if (typeof st.mapShowName === "boolean") next.mapShowName = st.mapShowName;
            if (typeof st.mapShowQuantity === "boolean") next.mapShowQuantity = st.mapShowQuantity;
            if (typeof (st as { quoteExportIncludeImages?: unknown }).quoteExportIncludeImages === "boolean")
              next.quoteExportIncludeImages = (st as { quoteExportIncludeImages: boolean }).quoteExportIncludeImages;
            if (st.mapTheme === "light" || st.mapTheme === "dark") next.mapTheme = st.mapTheme;
            const stExt = st as { mapPlacementGlyphScale?: unknown; quoteTableOrder?: unknown };
            if (typeof stExt.mapPlacementGlyphScale === "number" && Number.isFinite(stExt.mapPlacementGlyphScale)) {
              next.mapPlacementGlyphScale = Math.min(2.5, Math.max(0.5, stExt.mapPlacementGlyphScale));
            }
            if (stExt.quoteTableOrder === null) next.quoteTableOrder = null;
            else if (stExt.quoteTableOrder !== undefined) {
              const parsed = parseQuoteTableOrder(stExt.quoteTableOrder);
              if (parsed) next.quoteTableOrder = parsed;
            }
            if (st.quotePdfExportStyle && typeof st.quotePdfExportStyle === "object")
              next.quotePdfExportStyle = normalizeQuotePdfExportStyle(
                st.quotePdfExportStyle as Partial<QuotePdfExportStyle>,
              );
            if (typeof st.companyLogoDataUrl === "string" || st.companyLogoDataUrl === null)
              next.companyLogoDataUrl = st.companyLogoDataUrl as string | null;
            if (typeof st.companyName === "string") next.companyName = st.companyName;
            if (typeof st.companyTagline === "string") next.companyTagline = st.companyTagline;
            if (typeof st.companyAddress === "string") next.companyAddress = st.companyAddress;
            if (typeof st.companyPhone === "string") next.companyPhone = st.companyPhone;
            if (typeof st.companyEmail === "string") next.companyEmail = st.companyEmail;
            if (typeof st.companyWebsite === "string") next.companyWebsite = st.companyWebsite;
            if (st.uiLocale === "zh" || st.uiLocale === "en") next.uiLocale = st.uiLocale;
            if (st.uiThemeBundle && typeof st.uiThemeBundle === "object")
              next.uiThemeBundle = normalizeUiThemeBundle(st.uiThemeBundle as AppUiThemeBundle);
            if (Array.isArray(st.planTemplates)) next.planTemplates = st.planTemplates as SavedPlanTemplate[];
            const stQt = (st as { quoteTemplates?: unknown }).quoteTemplates;
            if (Array.isArray(stQt)) {
              next.quoteTemplates = stQt
                .map((x) => normalizeSavedQuoteTemplate(x))
                .filter((x): x is SavedQuoteTemplate => x !== null);
            }
            const stErm = (st as { enterpriseResourceMainTab?: unknown }).enterpriseResourceMainTab;
            if (stErm === "mediaLibrary" || stErm === "templateBuilder") {
              next.enterpriseResourceMainTab = stErm;
            }
            const stQpt = (st as { quotePdfTemplateId?: unknown }).quotePdfTemplateId;
            if (stQpt === null || stQpt === "") next.quotePdfTemplateId = null;
            else if (typeof stQpt === "string") next.quotePdfTemplateId = stQpt;
            if (Array.isArray(st.customPlanSoftwareLines))
              next.customPlanSoftwareLines = (st.customPlanSoftwareLines as Partial<CustomPlanSoftwareLine>[]).map(
                (x) => normalizeCustomPlanSoftwareLine(x),
              );
            if (Array.isArray(st.customPlanServiceLines))
              next.customPlanServiceLines = (st.customPlanServiceLines as Partial<CustomPlanServiceLine>[]).map(
                (x) => normalizeCustomPlanServiceLine(x),
              );
            if (Array.isArray(st.erpInventoryLines))
              next.erpInventoryLines = (st.erpInventoryLines as Partial<ErpInventoryLine>[]).map((x) =>
                normalizeErpInventoryLine(x as ErpInventoryLine),
              );
            if (Array.isArray(st.erpStockMovements))
              next.erpStockMovements = (st.erpStockMovements as Partial<ErpStockMovement>[]).map((x) =>
                normalizeErpStockMovement(x as ErpStockMovement),
              );
            const bh = (st as { bundledHardwareCatalogBuildId?: unknown }).bundledHardwareCatalogBuildId;
            if (typeof bh === "number" && Number.isFinite(bh)) {
              next.bundledHardwareCatalogBuildId = bh;
            }
            const stNav = st as {
              activeTab?: unknown;
              activeCrmCustomerId?: unknown;
              resourceLibrarySubTab?: unknown;
              customPlanTab?: unknown;
              customPlanSelectStep?: unknown;
              materialsLibraryTab?: unknown;
              materialsBrandNavSel?: unknown;
              erpCatalogActiveKind?: unknown;
              erpCatalogSel?: unknown;
              erpCatalogSearchQuery?: unknown;
              erpTopModule?: unknown;
              erpInvSubTab?: unknown;
            };
            const ra = stNav.activeTab;
            if (ra === "enterpriseResources" || ra === "crm" || ra === "customPlan" || ra === "erp" || ra === "settings") {
              next.activeTab = ra;
            }
            if (Array.isArray((st as { crmCustomers?: unknown }).crmCustomers)) {
              next.crmCustomers = ((st as { crmCustomers: unknown[] }).crmCustomers)
                .map((x) => normalizeCrmCustomer(x))
                .filter((x): x is CrmCustomer => x !== null);
            }
            if (
              typeof stNav.activeCrmCustomerId === "string" &&
              next.crmCustomers.some((c) => c.id === stNav.activeCrmCustomerId)
            ) {
              next.activeCrmCustomerId = stNav.activeCrmCustomerId;
            }
            const rr = stNav.resourceLibrarySubTab;
            if (rr === "brandMaterials") next.resourceLibrarySubTab = "brandMaterials";
            const rc = stNav.customPlanTab;
            if (rc === "select" || rc === "plan" || rc === "quote") next.customPlanTab = rc;
            const rcs = stNav.customPlanSelectStep;
            if (rcs === "map" || rcs === "software" || rcs === "services") next.customPlanSelectStep = rcs;
            const rml = stNav.materialsLibraryTab;
            if (rml === "brand" || rml === "product") next.materialsLibraryTab = rml;
            if (stNav.materialsBrandNavSel !== undefined) {
              next.materialsBrandNavSel = normalizePersistedErpCatalogNavSel(stNav.materialsBrandNavSel);
            }
            const reck = stNav.erpCatalogActiveKind;
            if (reck === "hardware" || reck === "software" || reck === "service") {
              next.erpCatalogActiveKind = reck;
            }
            if (stNav.erpCatalogSel && typeof stNav.erpCatalogSel === "object" && !Array.isArray(stNav.erpCatalogSel)) {
              const ecs = stNav.erpCatalogSel as Record<string, unknown>;
              next.erpCatalogSel = {
                hardware: normalizePersistedErpCatalogNavSel(ecs.hardware),
                software: normalizePersistedErpCatalogNavSel(ecs.software),
                service: normalizePersistedErpCatalogNavSel(ecs.service),
              };
            }
            if (typeof stNav.erpCatalogSearchQuery === "string") {
              next.erpCatalogSearchQuery = stNav.erpCatalogSearchQuery.slice(0, 500);
            }
            if (stNav.erpTopModule === "customer" || stNav.erpTopModule === "inventory" || stNav.erpTopModule === "staff") {
              next.erpTopModule = stNav.erpTopModule;
            }
            const ris = stNav.erpInvSubTab;
            if (ris === "inbound" || ris === "catalog") next.erpInvSubTab = ris;
            const snapCtx = {
              materials: next.materials,
              softwareFeatureIds: new Set(next.softwareFeatures.map((f) => f.id)),
              serviceIds: new Set(next.serviceItems.map((x) => x.id)),
              associationIds: new Set(next.associations.map((a) => a.id)),
            };
            if (Array.isArray((st as { savedCustomPlans?: unknown }).savedCustomPlans)) {
              next.savedCustomPlans = ((st as { savedCustomPlans: unknown[] }).savedCustomPlans)
                .map((x) => normalizeSavedCustomPlan(x, snapCtx))
                .filter((x): x is SavedCustomPlan => x !== null);
            }
            const rawAid = (st as { activeCustomPlanId?: unknown }).activeCustomPlanId;
            if (rawAid === null) next.activeCustomPlanId = null;
            else if (
              typeof rawAid === "string" &&
              rawAid &&
              next.savedCustomPlans.some((p) => p.id === rawAid)
            ) {
              next.activeCustomPlanId = rawAid;
            }
            const activeImported = next.activeCustomPlanId
              ? next.savedCustomPlans.find((p) => p.id === next.activeCustomPlanId)
              : null;
            if (activeImported) {
              Object.assign(next, snapshotToWorkspacePatch(activeImported.data));
            }
            return next;
          });
          flushQuotePersistDebouncedStorageNow();
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON" };
        }
      },

      recoverCatalogFromLocalStorageBackup: () => {
        const ls = readQuotePersistStateFromLocalStorage();
        if (!ls) return false;
        let changed = false;
        set((s) => {
          const patch: Partial<State> = {};
          if (s.associations.length === 0 && Array.isArray(ls.associations) && (ls.associations as []).length > 0) {
            patch.associations = (ls.associations as Array<Partial<AssociationRow> & { materialId?: unknown }>).map(
              (a) => {
                const legacyId = typeof a.materialId === "string" ? a.materialId : null;
                const prod =
                  typeof a.productMaterialId === "string" && a.productMaterialId
                    ? a.productMaterialId
                    : legacyId;
                const qo = (a as Partial<AssociationRow>).quoteLineTotalOverride;
                const quoteLineTotalOverride =
                  qo !== null && qo !== undefined && typeof qo === "number" && Number.isFinite(qo) && qo >= 0
                    ? qo
                    : null;
                const ar = a as Partial<AssociationRow>;
                return normalizeAssociationRow({
                  id: String(a.id ?? crypto.randomUUID()),
                  hardwareName: String(a.hardwareName ?? ""),
                  deviceModel: String(a.deviceModel ?? ""),
                  color: String(a.color ?? DEFAULT_MAP_COLOR),
                  productMaterialId: prod,
                  quoteAdMaterialId: typeof a.quoteAdMaterialId === "string" ? a.quoteAdMaterialId : null,
                  technicalMaterialId: typeof a.technicalMaterialId === "string" ? a.technicalMaterialId : null,
                  unitPrice: typeof a.unitPrice === "number" ? a.unitPrice : 0,
                  priceBand: ar.priceBand,
                  warrantyMonthsAfterShip: ar.warrantyMonthsAfterShip,
                  quoteTierMode: ar.quoteTierMode,
                  note: String(a.note ?? ""),
                  quoteTableNote: String(a.quoteTableNote ?? ""),
                  options: Array.isArray(a.options) ? a.options : [],
                  addons: Array.isArray(a.addons) ? a.addons : [],
                  quoteLineTotalOverride,
                  mapLabelAbbrev: typeof ar.mapLabelAbbrev === "string" ? ar.mapLabelAbbrev : undefined,
                });
              },
            );
            changed = true;
          }
          if (s.softwareFeatures.length === 0 && Array.isArray(ls.softwareFeatures) && ls.softwareFeatures.length > 0) {
            patch.softwareFeatures = (ls.softwareFeatures as Partial<SoftwareFeatureRow>[]).map((x) =>
              normalizeSoftwareFeatureRow(x),
            );
            changed = true;
          }
          if (s.serviceItems.length === 0 && Array.isArray(ls.serviceItems) && ls.serviceItems.length > 0) {
            patch.serviceItems = (ls.serviceItems as Partial<ServiceRow>[]).map((x) => normalizeServiceRow(x));
            changed = true;
          }
          if (s.materials.length === 0 && Array.isArray(ls.materials) && ls.materials.length > 0) {
            const categoryNames = new Set(s.categoryDefs.map((d) => d.name));
            patch.materials = (ls.materials as MaterialPage[]).map((m) => {
              const migrated = migrateSoftwareMaterialCategoryPath(migrateLegacyCategoryName(m.category));
              const cat = categoryNames.has(migrated) ? migrated : UNCATEGORIZED_CATEGORY_NAME;
              const createdAt =
                typeof m.createdAt === "number" && m.createdAt > 0 ? m.createdAt : 0;
              return {
                ...m,
                category: cat,
                imageKind: isMaterialImageKind(m.imageKind) ? m.imageKind : "product",
                createdAt,
              };
            });
            changed = true;
          }
          if (
            s.layoutMaterialOrder.length === 0 &&
            Array.isArray(ls.layoutMaterialOrder) &&
            (ls.layoutMaterialOrder as string[]).length > 0
          ) {
            patch.layoutMaterialOrder = ls.layoutMaterialOrder as string[];
            changed = true;
          }
          if (s.placements.length === 0 && Array.isArray(ls.placements) && (ls.placements as []).length > 0) {
            patch.placements = (ls.placements as Partial<HardwarePlacement>[]).map((x) =>
              normalizePlacement({
                id: typeof x.id === "string" && x.id ? x.id : crypto.randomUUID(),
                associationId: String(x.associationId),
                xPct: Number(x.xPct),
                yPct: Number(x.yPct),
                optionId: x.optionId ?? null,
                addonIds: Array.isArray(x.addonIds) ? x.addonIds : [],
              }),
            );
            changed = true;
          }
          return patch;
        });
        if (changed) flushQuotePersistDebouncedStorageNow();
        return changed;
      },

      restoreFullHardwareCatalogFromLocalStorageBackup: () => {
        const ls = readQuotePersistStateFromLocalStorage();
        if (!ls) return { ok: false, error: "no_backup" };
        const rawAss = ls.associations as unknown;
        if (!Array.isArray(rawAss) || rawAss.length === 0) return { ok: false, error: "empty_hardware" };
        try {
          const associations = (
            rawAss as Array<Partial<AssociationRow> & { materialId?: unknown }>
          ).map((a) => {
            const legacyId = typeof a.materialId === "string" ? a.materialId : null;
            const prod =
              typeof a.productMaterialId === "string" && a.productMaterialId ? a.productMaterialId : legacyId;
            const qo = (a as Partial<AssociationRow>).quoteLineTotalOverride;
            const quoteLineTotalOverride =
              qo !== null && qo !== undefined && typeof qo === "number" && Number.isFinite(qo) && qo >= 0 ? qo : null;
            const ar = a as Partial<AssociationRow>;
            return normalizeAssociationRow({
              id: String(a.id ?? crypto.randomUUID()),
              hardwareName: String(a.hardwareName ?? ""),
              deviceModel: String(a.deviceModel ?? ""),
              color: String(a.color ?? DEFAULT_MAP_COLOR),
              productMaterialId: prod,
              quoteAdMaterialId: typeof a.quoteAdMaterialId === "string" ? a.quoteAdMaterialId : null,
              technicalMaterialId: typeof a.technicalMaterialId === "string" ? a.technicalMaterialId : null,
              unitPrice: typeof a.unitPrice === "number" ? a.unitPrice : 0,
              priceBand: ar.priceBand,
              warrantyMonthsAfterShip: ar.warrantyMonthsAfterShip,
              quoteTierMode: ar.quoteTierMode,
              note: String(a.note ?? ""),
              quoteTableNote: String(a.quoteTableNote ?? ""),
              options: Array.isArray(a.options) ? a.options : [],
              addons: Array.isArray(a.addons) ? a.addons : [],
              quoteLineTotalOverride,
              mapLabelAbbrev: typeof ar.mapLabelAbbrev === "string" ? ar.mapLabelAbbrev : undefined,
            });
          });
          const lsBh = (ls as { bundledHardwareCatalogBuildId?: unknown }).bundledHardwareCatalogBuildId;
          const nextBuildId =
            typeof lsBh === "number" && Number.isFinite(lsBh) ? lsBh : get().bundledHardwareCatalogBuildId;
          set((s) => {
            const categoryNames = new Set(s.categoryDefs.map((d) => d.name));
            const rawMats = Array.isArray(ls.materials) ? (ls.materials as MaterialPage[]) : [];
            const materials = rawMats.map((m) => {
              const migrated = migrateSoftwareMaterialCategoryPath(migrateLegacyCategoryName(m.category));
              const cat = categoryNames.has(migrated) ? migrated : UNCATEGORIZED_CATEGORY_NAME;
              const createdAt = typeof m.createdAt === "number" && m.createdAt > 0 ? m.createdAt : 0;
              return {
                ...m,
                category: cat,
                imageKind: isMaterialImageKind(m.imageKind) ? m.imageKind : "product",
                createdAt,
              };
            });
            const rawErp = Array.isArray(ls.erpInventoryLines) ? ls.erpInventoryLines : [];
            const erpInventoryLines = rawErp
              .filter(
                (l): l is Partial<ErpInventoryLine> & { kind?: unknown } =>
                  !!l && typeof l === "object" && (l as ErpInventoryLine).kind === "hardware",
              )
              .map((x) => normalizeErpInventoryLine(x as ErpInventoryLine));
            const bundle: HardwareCatalogImportBundle = { materials, associations, erpInventoryLines };
            return {
              ...s,
              ...patchStateWithHardwareCatalogBundle(s, bundle),
              bundledHardwareCatalogBuildId: nextBuildId,
            };
          });
          flushQuotePersistDebouncedStorageNow();
          return { ok: true, count: associations.length };
        } catch {
          return { ok: false, error: "invalid" };
        }
      },

      setCompanyBranding: (patch) =>
        set((s) => ({
          companyLogoDataUrl:
            patch.companyLogoDataUrl !== undefined ? patch.companyLogoDataUrl : s.companyLogoDataUrl,
          companyName: patch.companyName !== undefined ? patch.companyName : s.companyName,
          companyTagline: patch.companyTagline !== undefined ? patch.companyTagline : s.companyTagline,
          companyAddress: patch.companyAddress !== undefined ? patch.companyAddress : s.companyAddress,
          companyPhone: patch.companyPhone !== undefined ? patch.companyPhone : s.companyPhone,
          companyEmail: patch.companyEmail !== undefined ? patch.companyEmail : s.companyEmail,
          companyWebsite: patch.companyWebsite !== undefined ? patch.companyWebsite : s.companyWebsite,
          companyCatalogCurrency:
            patch.companyCatalogCurrency !== undefined
              ? String(patch.companyCatalogCurrency || "AUD")
                  .trim()
                  .slice(0, 8)
                  .toUpperCase() || "AUD"
              : s.companyCatalogCurrency,
          companyCatalogFxMultiplier:
            patch.companyCatalogFxMultiplier !== undefined &&
            typeof patch.companyCatalogFxMultiplier === "number" &&
            Number.isFinite(patch.companyCatalogFxMultiplier)
              ? Math.max(0.0001, patch.companyCatalogFxMultiplier)
              : s.companyCatalogFxMultiplier,
        })),

    }),
    {
      name: "marketing-quote-v1",
      storage: createDebouncedJsonStorage(() => quoteFolderPersistStorage),
      partialize: (s) => ({
        categoryDefs: s.categoryDefs,
        materials: s.materials,
        layoutMaterialOrder: s.layoutMaterialOrder,
        planPages: s.planPages,
        planTemplates: s.planTemplates,
          quoteTemplates: s.quoteTemplates,
          quotePdfTemplateId: s.quotePdfTemplateId,
          enterpriseResourceMainTab: s.enterpriseResourceMainTab,
          softwareFeatures: s.softwareFeatures,
        serviceItems: s.serviceItems,
        customPlanSoftwareLines: s.customPlanSoftwareLines,
        customPlanServiceLines: s.customPlanServiceLines,
        associations: s.associations,
        placements: s.placements,
        quoteFooterCustom: s.quoteFooterCustom,
        quotationRef: s.quotationRef,
        floorPlanDataUrl: s.floorPlanDataUrl,
        floorPlanOpacityPct: s.floorPlanOpacityPct,
        floorPlanPlacementImageSpace: s.floorPlanPlacementImageSpace,
        mapShowName: s.mapShowName,
        mapShowQuantity: s.mapShowQuantity,
        quoteExportIncludeImages: s.quoteExportIncludeImages,
        mapTheme: s.mapTheme,
        mapPlacementGlyphScale: s.mapPlacementGlyphScale,
        quoteTableOrder: s.quoteTableOrder,
        quotePdfExportStyle: s.quotePdfExportStyle,
        companyLogoDataUrl: s.companyLogoDataUrl,
        companyName: s.companyName,
        companyTagline: s.companyTagline,
        companyAddress: s.companyAddress,
        companyPhone: s.companyPhone,
        companyEmail: s.companyEmail,
        companyWebsite: s.companyWebsite,
        companyCatalogCurrency: s.companyCatalogCurrency,
        companyCatalogFxMultiplier: s.companyCatalogFxMultiplier,
        quoteGlobalPriceTier: s.quoteGlobalPriceTier,
        uiLocale: s.uiLocale,
        uiThemeBundle: s.uiThemeBundle,
        erpTopModule: s.erpTopModule,
        erpInvSubTab: s.erpInvSubTab,
        erpCatalogFocus: s.erpCatalogFocus,
        erpCatalogActiveKind: s.erpCatalogActiveKind,
        erpCatalogSel: s.erpCatalogSel,
        erpCatalogSearchQuery: s.erpCatalogSearchQuery,
        erpHardwareNavSortMode: s.erpHardwareNavSortMode,
        erpInventoryLines: s.erpInventoryLines,
        erpStockMovements: s.erpStockMovements,
        bundledHardwareCatalogBuildId: s.bundledHardwareCatalogBuildId,
        activeTab: s.activeTab,
        crmCustomers: s.crmCustomers,
        activeCrmCustomerId: s.activeCrmCustomerId,
        resourceLibrarySubTab: s.resourceLibrarySubTab,
        customPlanTab: s.customPlanTab,
        customPlanSelectStep: s.customPlanSelectStep,
        savedCustomPlans: s.savedCustomPlans,
        activeCustomPlanId: s.activeCustomPlanId,
        materialsLibraryTab: s.materialsLibraryTab,
        materialsBrandNavSel: s.materialsBrandNavSel,
      }),
      merge: (persisted, current) => {
        const p = persisted as {
          categoryDefs?: MaterialCategoryDef[];
          categories?: string[];
          materials?: MaterialPage[];
          layoutMaterialOrder?: string[];
          planPages?: Partial<PlanPage>[];
          softwareFeatures?: Partial<SoftwareFeatureRow>[];
          serviceItems?: Partial<ServiceRow>[];
          associations?: Array<
            Partial<AssociationRow> & { icon?: unknown; iconKey?: unknown; materialId?: unknown }
          >;
          placements?: HardwarePlacement[];
          quoteFooterCustom?: string;
          floorPlanDataUrl?: string | null;
          floorPlanOpacityPct?: number;
          floorPlanPlacementImageSpace?: boolean;
          mapShowName?: boolean;
          mapShowQuantity?: boolean;
          quoteExportIncludeImages?: boolean;
          mapTheme?: MapThemeMode;
          mapPlacementGlyphScale?: number;
          quoteTableOrder?: QuoteTableRowKey[] | unknown[] | null;
          quotePdfTemplate?: "modern" | "classic";
          quotePdfExportStyle?: Partial<QuotePdfExportStyle>;
          companyLogoDataUrl?: string | null;
          companyName?: string;
          companyTagline?: string;
          companyAddress?: string;
          companyPhone?: string;
          companyEmail?: string;
          companyWebsite?: string;
          uiLocale?: UiLocale;
          uiThemeBundle?: AppUiThemeBundle;
          crmCustomers?: unknown[];
          activeCrmCustomerId?: string | null;
          erpTopModule?: ErpModuleTab;
          erpInvSubTab?: ErpInvSubTab;
          erpCatalogFocus?: ErpStockKind | null;
          erpInventoryLines?: Partial<ErpInventoryLine>[];
          erpStockMovements?: Partial<ErpStockMovement>[];
          bundledHardwareCatalogBuildId?: number | null;
        } | null;
        if (!p) return current;

        const lsState = readQuotePersistStateFromLocalStorage();

        let categoryDefs: MaterialCategoryDef[] = current.categoryDefs;
        const canonicalDefs = buildDefaultMaterialCategoryDefs();
        const rawDefs = p.categoryDefs;
        if (Array.isArray(rawDefs) && rawDefs.length > 0) {
          const parsed = rawDefs
            .map((d) => {
              const raw = d as MaterialCategoryDef;
              const dc = raw.defaultMapColor;
              const defaultMapColor =
                typeof dc === "string" && /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/i.test(dc.trim())
                  ? dc.trim()
                  : undefined;
              return {
                name: String(raw.name ?? ""),
                nameEn:
                  typeof raw.nameEn === "string" ? String(raw.nameEn).trim() || undefined : undefined,
                iconKey: String(raw.iconKey ?? "device"),
                ...(defaultMapColor ? { defaultMapColor } : {}),
              };
            })
            .filter((d) => d.name);
          if (parsed.length > 0) {
            const persistDefs: MaterialCategoryDef[] = [];
            for (const raw of parsed) {
              const d = enrichCategoryDef(raw as MaterialCategoryDef);
              if (d.name) persistDefs.push(d);
            }
            categoryDefs = mergePersistedCategoryDefsWithCanonical(persistDefs, canonicalDefs);
          }
        } else if (Array.isArray(p.categories) && p.categories.length > 0) {
          const persistDefs: MaterialCategoryDef[] = [];
          for (const n of p.categories) {
            const d = enrichCategoryDef({ name: String(n), iconKey: "device" });
            if (d.name) persistDefs.push(d);
          }
          categoryDefs = mergePersistedCategoryDefsWithCanonical(persistDefs, canonicalDefs);
        }
        categoryDefs = ensureUncategorized(categoryDefs);
        const categoryNames = new Set(categoryDefs.map((d) => d.name));
        const rawMaterials = preferNonEmptyCatalogArray(
          Array.isArray(p.materials) ? (p.materials as MaterialPage[]) : undefined,
          lsState?.materials ? (lsState.materials as MaterialPage[]) : undefined,
          current.materials,
        );
        for (const m of rawMaterials) {
          const mc = migrateLegacyCategoryName(String((m as MaterialPage).category ?? ""));
          categoryNames.add(migrateSoftwareMaterialCategoryPath(mc));
        }

        const materials = rawMaterials.map((m) => {
          const migrated = migrateSoftwareMaterialCategoryPath(migrateLegacyCategoryName(m.category));
          const cat = categoryNames.has(migrated) ? migrated : UNCATEGORIZED_CATEGORY_NAME;
          const createdAt =
            typeof (m as MaterialPage).createdAt === "number" && (m as MaterialPage).createdAt! > 0
              ? (m as MaterialPage).createdAt
              : 0;
          return {
            ...m,
            category: cat,
            imageKind: isMaterialImageKind(m.imageKind) ? m.imageKind : "product",
            createdAt,
          };
        });

        const associationsSource = preferNonEmptyCatalogArray(
          Array.isArray(p.associations) ? (p.associations as Partial<AssociationRow>[]) : undefined,
          lsState?.associations ? (lsState.associations as Partial<AssociationRow>[]) : undefined,
          current.associations,
        );
        const mergedAssociations = associationsSource.map((raw) => {
          const a = raw as Partial<AssociationRow> & { materialId?: unknown };
          const legacyId = typeof a.materialId === "string" ? a.materialId : null;
          const prod =
            typeof a.productMaterialId === "string" && a.productMaterialId
              ? a.productMaterialId
              : legacyId;
          const qo = (a as Partial<AssociationRow>).quoteLineTotalOverride;
          const quoteLineTotalOverride =
            qo !== null && qo !== undefined && typeof qo === "number" && Number.isFinite(qo) && qo >= 0
              ? qo
              : null;
          const ar = a as Partial<AssociationRow>;
          return normalizeAssociationRow({
            id: String(a.id ?? crypto.randomUUID()),
            hardwareName: String(a.hardwareName ?? ""),
            deviceModel: String(a.deviceModel ?? ""),
            color: String(a.color ?? DEFAULT_MAP_COLOR),
            productMaterialId: prod,
            quoteAdMaterialId: typeof a.quoteAdMaterialId === "string" ? a.quoteAdMaterialId : null,
            technicalMaterialId: typeof a.technicalMaterialId === "string" ? a.technicalMaterialId : null,
            unitPrice: typeof a.unitPrice === "number" ? a.unitPrice : 0,
            priceBand: ar.priceBand,
            warrantyMonthsAfterShip: ar.warrantyMonthsAfterShip,
            quoteTierMode: ar.quoteTierMode,
            note: String(a.note ?? ""),
            quoteTableNote: String(a.quoteTableNote ?? ""),
            options: Array.isArray(a.options) ? a.options : [],
            addons: Array.isArray(a.addons) ? a.addons : [],
            quoteLineTotalOverride,
            mapLabelAbbrev: typeof ar.mapLabelAbbrev === "string" ? ar.mapLabelAbbrev : undefined,
          });
        });

        const mergedPlanPages: PlanPage[] = Array.isArray(p.planPages)
          ? p.planPages
              .map((o, i) => {
                const x = o as Partial<PlanPage>;
                const bg = String(x.backgroundDataUrl ?? "");
                if (!bg) return null;
                const cropRaw = x.overlayCropAspect;
                const crop =
                  typeof cropRaw === "string" && /^\d+:\d+$/.test(String(cropRaw).trim())
                    ? String(cropRaw).trim()
                    : undefined;
                const bgMidRaw = (x as Partial<PlanPage>).backgroundMaterialId;
                const bgMidGuess =
                  typeof bgMidRaw === "string" && bgMidRaw
                    ? bgMidRaw
                    : (materials.find((mm) => mm.dataUrl === bg)?.id ?? null);
                const page: PlanPage = {
                  id: typeof x.id === "string" && x.id ? x.id : crypto.randomUUID(),
                  backgroundDataUrl: bg,
                  widthPx: Number(x.widthPx) || 800,
                  heightPx: Number(x.heightPx) || 600,
                  sourceFileName: String(x.sourceFileName ?? "方案.pdf"),
                  sourcePage: Number.isFinite(Number(x.sourcePage)) ? Number(x.sourcePage) : i,
                  backgroundMaterialId: bgMidGuess,
                  overlayMaterialId:
                    typeof x.overlayMaterialId === "string" && x.overlayMaterialId ? x.overlayMaterialId : null,
                };
                if (crop) page.overlayCropAspect = crop;
                if (x.previewExtra !== undefined && x.previewExtra !== null) {
                  page.previewExtra = normalizePlanPreviewExtra(x.previewExtra);
                }
                return page;
              })
              .filter((x): x is PlanPage => x !== null)
          : current.planPages;

        const softwareFeaturesSource = preferNonEmptyCatalogArray(
          Array.isArray(p.softwareFeatures) ? (p.softwareFeatures as Partial<SoftwareFeatureRow>[]) : undefined,
          lsState?.softwareFeatures
            ? (lsState.softwareFeatures as Partial<SoftwareFeatureRow>[])
            : undefined,
          current.softwareFeatures,
        );
        const mergedSoftwareFeatures: SoftwareFeatureRow[] = softwareFeaturesSource.map((x) =>
          normalizeSoftwareFeatureRow(x as Partial<SoftwareFeatureRow>),
        );

        const serviceItemsSource = preferNonEmptyCatalogArray(
          Array.isArray(p.serviceItems) ? (p.serviceItems as Partial<ServiceRow>[]) : undefined,
          lsState?.serviceItems ? (lsState.serviceItems as Partial<ServiceRow>[]) : undefined,
          current.serviceItems,
        );
        const mergedServiceItems: ServiceRow[] = serviceItemsSource.map((x) =>
          normalizeServiceRow(x as Partial<ServiceRow>),
        );

        const pExt = p as {
          customPlanSoftwareLines?: Partial<CustomPlanSoftwareLine>[];
          customPlanServiceLines?: Partial<CustomPlanServiceLine>[];
        };
        const lsExt = lsState as {
          customPlanSoftwareLines?: Partial<CustomPlanSoftwareLine>[];
          customPlanServiceLines?: Partial<CustomPlanServiceLine>[];
        } | null;
        const customPlanSwSource = preferNonEmptyCatalogArray(
          Array.isArray(pExt.customPlanSoftwareLines) ? pExt.customPlanSoftwareLines : undefined,
          lsExt?.customPlanSoftwareLines,
          current.customPlanSoftwareLines,
        );
        const mergedCustomPlanSoftwareLines: CustomPlanSoftwareLine[] = customPlanSwSource.map((x) =>
          normalizeCustomPlanSoftwareLine(x),
        );
        const customPlanSvSource = preferNonEmptyCatalogArray(
          Array.isArray(pExt.customPlanServiceLines) ? pExt.customPlanServiceLines : undefined,
          lsExt?.customPlanServiceLines,
          current.customPlanServiceLines,
        );
        const mergedCustomPlanServiceLines: CustomPlanServiceLine[] = customPlanSvSource.map((x) =>
          normalizeCustomPlanServiceLine(x),
        );
        const featIdSet = new Set(mergedSoftwareFeatures.map((f) => f.id));
        const svcIdSet = new Set(mergedServiceItems.map((x) => x.id));
        const customPlanSoftwareLines = mergedCustomPlanSoftwareLines.filter((l) =>
          featIdSet.has(l.catalogFeatureId),
        );
        const customPlanServiceLines = mergedCustomPlanServiceLines.filter((l) =>
          svcIdSet.has(l.catalogServiceId),
        );

        let mergedPlacements = (p.placements ?? current.placements).map((pl) => {
          const x = pl as Partial<HardwarePlacement>;
          if (typeof x.id === "string" && x.id) {
            return normalizePlacement({
              id: x.id,
              associationId: String(x.associationId),
              xPct: Number(x.xPct),
              yPct: Number(x.yPct),
              optionId: x.optionId ?? null,
              addonIds: Array.isArray(x.addonIds) ? x.addonIds : [],
            });
          }
          return normalizePlacement({
            id: crypto.randomUUID(),
            associationId: String(x.associationId),
            xPct: Number(x.xPct),
            yPct: Number(x.yPct),
            optionId: x.optionId ?? null,
            addonIds: Array.isArray(x.addonIds) ? x.addonIds : [],
          });
        });

        const assocById = new Map(mergedAssociations.map((a) => [a.id, a]));
        mergedPlacements = mergedPlacements.map((p) => {
          const assoc = assocById.get(p.associationId);
          if (!assoc) return normalizePlacement(p);
          let q = normalizePlacement(p);
          if (assoc.options.length === 0) q = { ...q, optionId: null };
          else if (!q.optionId || !assoc.options.some((o) => o.id === q.optionId)) {
            q = { ...q, optionId: assoc.options[0]!.id };
          }
          const validAd = new Set(assoc.addons.map((ad) => ad.id));
          return { ...q, addonIds: (q.addonIds ?? []).filter((id) => validAd.has(id)) };
        });

        const legacyTpl =
          p.quotePdfTemplate === "classic" || p.quotePdfTemplate === "modern" ? p.quotePdfTemplate : undefined;
        const persistedPdfStyle =
          typeof p.quotePdfExportStyle === "object" && p.quotePdfExportStyle !== null ? p.quotePdfExportStyle : undefined;
        const mergedQuotePdfExportStyle = normalizeQuotePdfExportStyle(
          persistedPdfStyle as Partial<QuotePdfExportStyle>,
          persistedPdfStyle ? undefined : legacyTpl,
        );

        const mergedUiLocale: UiLocale = p.uiLocale === "zh" ? "zh" : "en";
        const mergedUiThemeBundle = normalizeUiThemeBundle(p.uiThemeBundle ?? current.uiThemeBundle);

        const mergedErpTopModule: ErpModuleTab =
          p.erpTopModule === "customer" || p.erpTopModule === "staff" || p.erpTopModule === "inventory"
            ? p.erpTopModule
            : current.erpTopModule;
        const rawInvSub = (p as { erpInvSubTab?: unknown }).erpInvSubTab;
        const mergedErpInvSubTab: ErpInvSubTab =
          rawInvSub === "inbound" || rawInvSub === "catalog"
            ? rawInvSub
            : rawInvSub === "ledger"
              ? "inbound"
              : current.erpInvSubTab;

        const rawActive = (p as { activeTab?: unknown }).activeTab;
        const mergedActiveTab: QuoteTab =
          rawActive === "enterpriseResources" ||
          rawActive === "crm" ||
          rawActive === "customPlan" ||
          rawActive === "erp" ||
          rawActive === "settings"
            ? rawActive
            : current.activeTab;

        const rawResSub = (p as { resourceLibrarySubTab?: unknown }).resourceLibrarySubTab;
        const mergedResourceLibrarySubTab: ResourceLibrarySubTab =
          rawResSub === "brandMaterials"
            ? "brandMaterials"
            : rawResSub === "hardware" || rawResSub === "software" || rawResSub === "services"
              ? "brandMaterials"
              : current.resourceLibrarySubTab;

        const rawCpt = (p as { customPlanTab?: unknown }).customPlanTab;
        const mergedCustomPlanTab: CustomPlanTab =
          rawCpt === "select" || rawCpt === "plan" || rawCpt === "quote" ? rawCpt : current.customPlanTab;

        const rawCps = (p as { customPlanSelectStep?: unknown }).customPlanSelectStep;
        const mergedCustomPlanSelectStep: CustomPlanSelectStep =
          rawCps === "map" || rawCps === "software" || rawCps === "services"
            ? rawCps
            : current.customPlanSelectStep;
        const mergedErpCatalogFocus: ErpStockKind | null =
          p.erpCatalogFocus === "hardware" || p.erpCatalogFocus === "software" || p.erpCatalogFocus === "service"
            ? p.erpCatalogFocus
            : p.erpCatalogFocus === null
              ? null
              : current.erpCatalogFocus;

        const rawEck = (p as { erpCatalogActiveKind?: unknown }).erpCatalogActiveKind;
        const mergedErpCatalogActiveKind: ErpStockKind =
          rawEck === "hardware" || rawEck === "software" || rawEck === "service"
            ? rawEck
            : current.erpCatalogActiveKind;

        const rawEcs = (p as { erpCatalogSel?: unknown }).erpCatalogSel;
        const mergedErpCatalogSel: Record<ErpStockKind, ErpCatalogNavSel> =
          rawEcs && typeof rawEcs === "object" && !Array.isArray(rawEcs)
            ? {
                hardware: normalizePersistedErpCatalogNavSel((rawEcs as Record<string, unknown>).hardware),
                software: normalizePersistedErpCatalogNavSel((rawEcs as Record<string, unknown>).software),
                service: normalizePersistedErpCatalogNavSel((rawEcs as Record<string, unknown>).service),
              }
            : current.erpCatalogSel;

        const rawEcq = (p as { erpCatalogSearchQuery?: unknown }).erpCatalogSearchQuery;
        const mergedErpCatalogSearchQuery =
          typeof rawEcq === "string" ? rawEcq.slice(0, 500) : current.erpCatalogSearchQuery;

        const rawMlt = (p as { materialsLibraryTab?: unknown }).materialsLibraryTab;
        const mergedMaterialsLibraryTab: MaterialsLibraryTab =
          rawMlt === "brand" || rawMlt === "product" ? rawMlt : current.materialsLibraryTab;

        const rawMbn = (p as { materialsBrandNavSel?: unknown }).materialsBrandNavSel;
        const mergedMaterialsBrandNavSel: ErpCatalogNavSel =
          rawMbn !== undefined
            ? normalizePersistedErpCatalogNavSel(rawMbn)
            : current.materialsBrandNavSel;

        const rawHwSort = (p as { erpHardwareNavSortMode?: unknown }).erpHardwareNavSortMode;
        const mergedErpHardwareNavSortMode: ErpHardwareNavSortMode =
          rawHwSort === "az" || rawHwSort === "manual" ? rawHwSort : current.erpHardwareNavSortMode;
        const mergedErpLines: ErpInventoryLine[] = Array.isArray(p.erpInventoryLines)
          ? p.erpInventoryLines.map((x) => normalizeErpInventoryLine(x as Partial<ErpInventoryLine>))
          : current.erpInventoryLines;
        const mergedErpMoves: ErpStockMovement[] = Array.isArray(p.erpStockMovements)
          ? p.erpStockMovements.map((x) => normalizeErpStockMovement(x as Partial<ErpStockMovement>))
          : current.erpStockMovements;

        const rawPlanTemplates = (p as { planTemplates?: unknown }).planTemplates;
        const mergedPlanTemplates: SavedPlanTemplate[] = Array.isArray(rawPlanTemplates)
          ? (rawPlanTemplates as SavedPlanTemplate[])
              .map((t) => {
                if (!t || typeof t.id !== "string" || !Array.isArray(t.pages)) return null;
                const pages = (t.pages as PlanTemplatePageEntry[]).filter(
                  (e) => e && e.background && typeof e.background === "object" && "kind" in e.background,
                );
                return {
                  id: t.id,
                  name: typeof t.name === "string" && t.name.trim() ? t.name.trim() : "Template",
                  createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
                  pages,
                } satisfies SavedPlanTemplate;
              })
              .filter((x): x is SavedPlanTemplate => x !== null)
          : (current.planTemplates ?? []);

        const rawQuoteTemplates = (p as { quoteTemplates?: unknown }).quoteTemplates;
        const mergedQuoteTemplates: SavedQuoteTemplate[] = Array.isArray(rawQuoteTemplates)
          ? rawQuoteTemplates
              .map((x) => normalizeSavedQuoteTemplate(x))
              .filter((x): x is SavedQuoteTemplate => x !== null)
          : (current.quoteTemplates ?? []);

        const rawErm = (p as { enterpriseResourceMainTab?: unknown }).enterpriseResourceMainTab;
        const mergedEnterpriseResourceMainTab: EnterpriseResourceMainTab =
          rawErm === "mediaLibrary" || rawErm === "templateBuilder"
            ? rawErm
            : current.enterpriseResourceMainTab;

        const rawQuotePdfTplId = (p as { quotePdfTemplateId?: unknown }).quotePdfTemplateId;
        const mergedQuotePdfTemplateId: string | null =
          rawQuotePdfTplId === null || rawQuotePdfTplId === ""
            ? null
            : typeof rawQuotePdfTplId === "string"
              ? rawQuotePdfTplId
              : current.quotePdfTemplateId;

        const mergedCrmCustomers: CrmCustomer[] = Array.isArray(p.crmCustomers)
          ? p.crmCustomers.map((x) => normalizeCrmCustomer(x)).filter((x): x is CrmCustomer => x !== null)
          : current.crmCustomers;
        const rawActiveCrmCustomerId = (p as { activeCrmCustomerId?: unknown }).activeCrmCustomerId;
        const mergedActiveCrmCustomerId: string | null =
          typeof rawActiveCrmCustomerId === "string" &&
          mergedCrmCustomers.some((c) => c.id === rawActiveCrmCustomerId)
            ? rawActiveCrmCustomerId
            : mergedCrmCustomers[0]?.id ?? null;

        const snapshotCtx = {
          materials,
          softwareFeatureIds: new Set(mergedSoftwareFeatures.map((f) => f.id)),
          serviceIds: new Set(mergedServiceItems.map((x) => x.id)),
          associationIds: new Set(mergedAssociations.map((a) => a.id)),
        };

        const rawSavedPlans = (p as { savedCustomPlans?: unknown }).savedCustomPlans;
        const mergedSavedCustomPlans: SavedCustomPlan[] = Array.isArray(rawSavedPlans)
          ? rawSavedPlans
              .map((x) => normalizeSavedCustomPlan(x, snapshotCtx))
              .filter((x): x is SavedCustomPlan => x !== null)
          : current.savedCustomPlans;

        const rawActivePlanId = (p as { activeCustomPlanId?: unknown }).activeCustomPlanId;
        let mergedActiveCustomPlanId: string | null =
          typeof rawActivePlanId === "string" &&
          rawActivePlanId &&
          mergedSavedCustomPlans.some((x) => x.id === rawActivePlanId)
            ? rawActivePlanId
            : mergedSavedCustomPlans[0]?.id ?? current.activeCustomPlanId ?? null;
        if (
          mergedActiveCustomPlanId &&
          !mergedSavedCustomPlans.some((x) => x.id === mergedActiveCustomPlanId)
        ) {
          mergedActiveCustomPlanId = mergedSavedCustomPlans[0]?.id ?? null;
        }

        const mergedBase = {
          ...current,
          activeTab: mergedActiveTab,
          crmCustomers: mergedCrmCustomers,
          activeCrmCustomerId: mergedActiveCrmCustomerId,
          resourceLibrarySubTab: mergedResourceLibrarySubTab,
          enterpriseResourceMainTab: mergedEnterpriseResourceMainTab,
          quoteTemplates: mergedQuoteTemplates,
          quotePdfTemplateId: mergedQuotePdfTemplateId,
          customPlanTab: mergedCustomPlanTab,
          customPlanSelectStep: mergedCustomPlanSelectStep,
          uiLocale: mergedUiLocale,
          uiThemeBundle: mergedUiThemeBundle,
          erpTopModule: mergedErpTopModule,
          erpInvSubTab: mergedErpInvSubTab,
          erpCatalogFocus: mergedErpCatalogFocus,
          erpCatalogActiveKind: mergedErpCatalogActiveKind,
          erpCatalogSel: mergedErpCatalogSel,
          erpCatalogSearchQuery: mergedErpCatalogSearchQuery,
          materialsLibraryTab: mergedMaterialsLibraryTab,
          materialsBrandNavSel: mergedMaterialsBrandNavSel,
          erpHardwareNavSortMode: mergedErpHardwareNavSortMode,
          erpInventoryLines: mergedErpLines,
          erpStockMovements: mergedErpMoves,
          categoryDefs,
          materials,
          layoutMaterialOrder: preferNonEmptyCatalogArray(
            Array.isArray(p.layoutMaterialOrder) ? p.layoutMaterialOrder : undefined,
            lsState?.layoutMaterialOrder ? (lsState.layoutMaterialOrder as string[]) : undefined,
            current.layoutMaterialOrder,
          ),
          planPages: mergedPlanPages,
          planTemplates: mergedPlanTemplates,
          softwareFeatures: mergedSoftwareFeatures,
          serviceItems: mergedServiceItems,
          customPlanSoftwareLines,
          customPlanServiceLines,
          placements: mergedPlacements,
          quoteFooterCustom: p.quoteFooterCustom ?? current.quoteFooterCustom,
          quotationRef:
            typeof (p as { quotationRef?: unknown }).quotationRef === "string" &&
            String((p as { quotationRef?: string }).quotationRef).trim()
              ? String((p as { quotationRef?: string }).quotationRef).trim()
              : current.quotationRef,
          floorPlanDataUrl: p.floorPlanDataUrl ?? current.floorPlanDataUrl,
          floorPlanOpacityPct:
            typeof p.floorPlanOpacityPct === "number" && Number.isFinite(p.floorPlanOpacityPct)
              ? Math.min(100, Math.max(0, Math.round(p.floorPlanOpacityPct)))
              : current.floorPlanOpacityPct,
          floorPlanPlacementImageSpace: p.floorPlanPlacementImageSpace === true,
          mapShowName: p.mapShowName ?? current.mapShowName,
          mapShowQuantity: p.mapShowQuantity ?? current.mapShowQuantity,
          quoteExportIncludeImages:
            typeof (p as { quoteExportIncludeImages?: unknown }).quoteExportIncludeImages === "boolean"
              ? (p as { quoteExportIncludeImages: boolean }).quoteExportIncludeImages
              : current.quoteExportIncludeImages,
          mapTheme: p.mapTheme === "light" || p.mapTheme === "dark" ? p.mapTheme : current.mapTheme,
          mapPlacementGlyphScale:
            typeof p.mapPlacementGlyphScale === "number" && Number.isFinite(p.mapPlacementGlyphScale)
              ? Math.min(2.5, Math.max(0.5, p.mapPlacementGlyphScale))
              : current.mapPlacementGlyphScale,
          quoteTableOrder: ((): QuoteTableRowKey[] | null => {
            if (p.quoteTableOrder === null) return null;
            if (p.quoteTableOrder !== undefined) {
              const parsed = parseQuoteTableOrder(p.quoteTableOrder);
              if (parsed) return parsed;
            }
            return current.quoteTableOrder;
          })(),
          associations: mergedAssociations,
          quotePdfExportStyle: mergedQuotePdfExportStyle,
          companyLogoDataUrl: p.companyLogoDataUrl ?? current.companyLogoDataUrl,
          companyName: typeof p.companyName === "string" ? p.companyName : current.companyName,
          companyTagline: typeof p.companyTagline === "string" ? p.companyTagline : current.companyTagline,
          companyAddress: typeof p.companyAddress === "string" ? p.companyAddress : current.companyAddress,
          companyPhone: typeof p.companyPhone === "string" ? p.companyPhone : current.companyPhone,
          companyEmail: typeof p.companyEmail === "string" ? p.companyEmail : current.companyEmail,
          companyWebsite: typeof p.companyWebsite === "string" ? p.companyWebsite : current.companyWebsite,
          companyCatalogCurrency:
            typeof (p as { companyCatalogCurrency?: unknown }).companyCatalogCurrency === "string" &&
            String((p as { companyCatalogCurrency?: string }).companyCatalogCurrency).trim()
              ? String((p as { companyCatalogCurrency?: string }).companyCatalogCurrency)
                  .trim()
                  .slice(0, 8)
                  .toUpperCase()
              : current.companyCatalogCurrency,
          companyCatalogFxMultiplier:
            typeof (p as { companyCatalogFxMultiplier?: unknown }).companyCatalogFxMultiplier === "number" &&
            Number.isFinite((p as { companyCatalogFxMultiplier?: number }).companyCatalogFxMultiplier!)
              ? Math.max(0.0001, (p as { companyCatalogFxMultiplier?: number }).companyCatalogFxMultiplier!)
              : current.companyCatalogFxMultiplier,
          quoteGlobalPriceTier: ((): QuotePriceTier => {
            const g = (p as { quoteGlobalPriceTier?: unknown }).quoteGlobalPriceTier;
            return g === "regular" || g === "vip" || g === "vvip" ? g : current.quoteGlobalPriceTier;
          })(),
          bundledHardwareCatalogBuildId:
            typeof p.bundledHardwareCatalogBuildId === "number" && Number.isFinite(p.bundledHardwareCatalogBuildId)
              ? p.bundledHardwareCatalogBuildId
              : current.bundledHardwareCatalogBuildId,
        };

        const rootSnapshot = captureCustomPlanSnapshotFromSlice({
          placements: mergedPlacements,
          floorPlanDataUrl: mergedBase.floorPlanDataUrl,
          floorPlanOpacityPct: mergedBase.floorPlanOpacityPct,
          floorPlanPlacementImageSpace: mergedBase.floorPlanPlacementImageSpace,
          mapShowName: mergedBase.mapShowName,
          mapShowQuantity: mergedBase.mapShowQuantity,
          mapTheme: mergedBase.mapTheme,
          mapPlacementGlyphScale: mergedBase.mapPlacementGlyphScale,
          customPlanSoftwareLines,
          customPlanServiceLines,
          planPages: mergedPlanPages,
          quoteFooterCustom: mergedBase.quoteFooterCustom,
          quoteTableOrder: mergedBase.quoteTableOrder,
          quotationRef: mergedBase.quotationRef,
          quoteExportIncludeImages: mergedBase.quoteExportIncludeImages,
          quoteGlobalPriceTier: mergedBase.quoteGlobalPriceTier,
          customPlanTab: mergedCustomPlanTab,
          customPlanSelectStep: mergedCustomPlanSelectStep,
        });

        let backupRootSnapshot: CustomPlanSnapshotData | null = null;
        let backupPlans: SavedCustomPlan[] = [];
        if (lsState) {
          backupRootSnapshot = captureCustomPlanSnapshotFromSlice(lsState as Partial<CustomPlanSnapshotSource>);
          if (Array.isArray((lsState as { savedCustomPlans?: unknown }).savedCustomPlans)) {
            backupPlans = ((lsState as { savedCustomPlans: unknown[] }).savedCustomPlans)
              .map((x) => normalizeSavedCustomPlan(x, snapshotCtx))
              .filter((x): x is SavedCustomPlan => x !== null);
          }
        }

        const resolved = resolveCustomPlanHydration({
          locale: mergedUiLocale === "zh" ? "zh" : "en",
          rootSnapshot,
          savedPlans: mergedSavedCustomPlans,
          activePlanId: mergedActiveCustomPlanId,
          backupRootSnapshot,
          backupPlans,
        });

        return {
          ...mergedBase,
          ...snapshotToWorkspacePatch(resolved.workspace),
          savedCustomPlans: resolved.savedCustomPlans,
          activeCustomPlanId: resolved.activeCustomPlanId,
        };
      },
    },
  ),
);
