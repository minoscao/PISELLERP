import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuoteStore } from "../store/quoteStore";
import type { AssociationRow, MaterialCategoryDef, MaterialImageKind, MaterialPage, UiLocale } from "../types";
import { HARDWARE_ICON_IDS, HARDWARE_ICON_LABELS, HardwareGlyph } from "../icons/hardwareGlyphs";
import {
  associationLineMaxUnit,
  associationLineMinUnit,
  formatMoneyRange,
  normalizeAssociationRow,
} from "../utils/hardwareOptionsAddons";
import {
  associationMatchesErpCatalogSearch,
  buildHardwareCatRows,
  buildServiceCatRows,
  buildSoftwareCatRows,
  erpCatalogRowMatchesQuery,
  filterAssociationsByCatalogNav,
  listHardwareNavPrimaries,
  resolveHardwareCategoryNameForNav,
  sortHardwareNavPrimariesByMode,
} from "../utils/erpCatalogCategories";
import { iconKeyForAssociation } from "../utils/categoryIcon";
import { autoMaterialDisplayName, fileExtFromUploadName } from "../utils/materialKinds";
import { splitFileToMaterialPages } from "../utils/pdfPages";
import { UNCATEGORIZED_CATEGORY_NAME, isBrandOnlyMaterialCategory } from "../constants/materialCategories";
import { associationMapCategory } from "../utils/associationCatalog";
import { categoryOptionText } from "../utils/categoryDisplay";
import { MaterialFolderNav, categoryDefsToPickerGroups } from "./MaterialFolderNav";
import { DEFAULT_MAP_COLOR, MAP_COLOR_PRESETS, nextDistinctMapColor } from "../utils/hardwareMapColor";
import { findBarcodeClash } from "../utils/erpInventory";
import type { PriceBand } from "../types";
import {
  formatPriceTriple,
  normalizePriceBandPartial,
  normalizePriceSeparators,
  parsePriceTripleString,
} from "../utils/priceTriple";
import { ErpCatalogQtyInput } from "./erp/ErpCatalogQtyInput";
import { SkuSpecificationsEditor } from "./erp/SkuSpecificationsEditor";
import { inferSkuClass, SKU_CLASS_LABEL, skuFootprintLabel } from "../utils/skuSpecifications";
import { translate } from "../i18n/bundle";
import { useT } from "../i18n/useT";
import { PhotoUploadModal } from "./PhotoUploadModal";

const DND_SLOT_KIND = "application/x-marketing-slot-kind";

function tripleInputParts(raw: string): [string, string, string] {
  const s = normalizePriceSeparators(String(raw ?? "").trim());
  if (!s) return ["", "", ""];
  const p = s.split(";").map((x: string) => x.trim());
  return [p[0] ?? "", p[1] ?? "", p[2] ?? ""];
}

function IconTrashSpec() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
    </svg>
  );
}

function FileTagIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={active ? "text-app-tone" : "text-app-subtle/35"}
      aria-hidden
    >
      <path d="M14 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function AssociationTagIcons({ r }: { r: AssociationRow }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <FileTagIcon active={!!r.productMaterialId} />
      <FileTagIcon active={!!r.quoteAdMaterialId} />
      <FileTagIcon active={!!r.technicalMaterialId} />
    </span>
  );
}

function normIconKey(k: string): string {
  return (HARDWARE_ICON_IDS as readonly string[]).includes(k) ? k : "device";
}

function slotField(k: MaterialImageKind): "productMaterialId" | "quoteAdMaterialId" | "technicalMaterialId" {
  if (k === "product") return "productMaterialId";
  if (k === "quoteAd") return "quoteAdMaterialId";
  return "technicalMaterialId";
}

function emptyRow(): AssociationRow {
  return {
    id: crypto.randomUUID(),
    hardwareName: "",
    deviceModel: "",
    skuClass: "main_device",
    lengthCm: 300,
    widthCm: 300,
    heightCm: null,
    weightKg: null,
    powerWatts: null,
    mapLabelAbbrev: null,
    color: DEFAULT_MAP_COLOR,
    productMaterialId: null,
    quoteAdMaterialId: null,
    technicalMaterialId: null,
    unitPrice: 0,
    priceBand: { regular: 0, vip: 0, vvip: 0 },
    warrantyMonthsAfterShip: null,
    quoteTierMode: "follow",
    note: "",
    quoteTableNote: "",
    options: [],
    addons: [],
  };
}

function cloneRow(r: AssociationRow): AssociationRow {
  return structuredClone(r);
}

/** 与 commitDraft 写入 store 的形状一致，用于脏检查 */
function persistedRowShape(d: AssociationRow, rowBand: PriceBand): AssociationRow {
  const qo = d.quoteLineTotalOverride;
  const quoteLineTotalOverride =
    qo !== null && qo !== undefined && typeof qo === "number" && Number.isFinite(qo) && qo >= 0 ? qo : null;
  return {
    id: d.id,
    hardwareName: d.hardwareName.trim(),
    deviceModel: d.deviceModel,
    skuClass: d.skuClass,
    lengthCm: d.lengthCm ?? null,
    widthCm: d.widthCm ?? null,
    heightCm: d.heightCm ?? null,
    weightKg: d.weightKg ?? null,
    powerWatts: d.powerWatts ?? null,
    mapLabelAbbrev: (d.mapLabelAbbrev ?? "").trim() || null,
    color: d.color,
    productMaterialId: d.productMaterialId,
    quoteAdMaterialId: d.quoteAdMaterialId,
    technicalMaterialId: d.technicalMaterialId,
    unitPrice: rowBand.regular,
    priceBand: rowBand,
    warrantyMonthsAfterShip: d.warrantyMonthsAfterShip ?? null,
    quoteTierMode: d.quoteTierMode ?? "follow",
    note: d.note,
    quoteTableNote: d.quoteTableNote,
    quoteLineTotalOverride,
    options: d.options
      .filter((o) => o.label.trim())
      .map((o) => {
        const ob = normalizePriceBandPartial(o.priceBand, o.optionPrice);
        return {
          ...o,
          id: o.id,
          label: o.label.trim(),
          optionPrice: ob.regular,
          priceBand: ob,
          ...(String(o.barcode ?? "").trim() ? { barcode: String(o.barcode).trim() } : {}),
          ...(o.productMaterialId?.trim() ? { productMaterialId: o.productMaterialId.trim() } : {}),
          ...(o.technicalMaterialId?.trim() ? { technicalMaterialId: o.technicalMaterialId.trim() } : {}),
        };
      }),
    addons: d.addons
      .filter((o) => o.label.trim())
      .map((o) => ({ ...o, id: o.id, label: o.label.trim(), price: Math.max(0, o.price) })),
  };
}

function persistedRowsEqual(a: AssociationRow, b: AssociationRow): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function rowSpecAddonSummary(r: AssociationRow, locale: UiLocale): string {
  const sn = r.options.filter((o) => o.label.trim()).length;
  const an = r.addons.filter((a) => a.label.trim()).length;
  const bits: string[] = [];
  if (sn) bits.push(translate(locale, "rel.nOptions", { n: sn }));
  if (an) bits.push(translate(locale, "rel.nAddons", { n: an }));
  return bits.join(" · ") || "—";
}

function summarizeSpecsAddonsForRows(rows: AssociationRow[], locale: UiLocale): string {
  const specs = new Set<string>();
  const addons = new Set<string>();
  for (const r of rows) {
    for (const o of r.options) {
      if (o.label.trim()) specs.add(o.label.trim());
    }
    for (const a of r.addons) {
      if (a.label.trim()) addons.add(a.label.trim());
    }
  }
  const sp = specs.size;
  const ad = addons.size;
  const bits: string[] = [];
  if (sp) bits.push(translate(locale, "rel.nOptions", { n: sp }));
  if (ad) bits.push(translate(locale, "rel.nAddons", { n: ad }));
  return bits.join(" · ") || "—";
}

type KindSlotProps = {
  label: string;
  kind: MaterialImageKind;
  material: MaterialPage | null;
  uploadCategory: string;
  selectedId: string | null;
  onBind: (id: string | null) => void;
  onSwapKinds: (from: MaterialImageKind, to: MaterialImageKind) => void;
  onUploadError: (msg: string | null) => void;
  /** ERP compact: dashed square + “+” only */
  slotStyle?: "default" | "compact";
};

function KindUploadSlot({
  label,
  kind,
  material,
  uploadCategory,
  selectedId,
  onBind,
  onSwapKinds,
  onUploadError,
  slotStyle = "default",
}: KindSlotProps) {
  const t = useT();
  const [pickerOpen, setPickerOpen] = useState(false);
  const addMaterials = useQuoteStore((s) => s.addMaterials);
  const compact = slotStyle === "compact";

  const tryIngestFile = async (f: File | undefined | null, opts: { throwOnError: boolean }) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      const msg = t("rel.errImagesOnly");
      onUploadError(msg);
      if (opts.throwOnError) throw new Error(msg);
      return;
    }
    onUploadError(null);
    try {
      const cat = uploadCategory.trim() || UNCATEGORIZED_CATEGORY_NAME;
      const mats = useQuoteStore.getState().materials;
      const startSerial = mats.filter((m) => m.imageKind === kind).length + 1;
      const pages = await splitFileToMaterialPages(f, cat, kind, startSerial);
      addMaterials(pages);
      const first = pages[0];
      if (first) onBind(first.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("rel.uploadFailed");
      onUploadError(msg);
      if (opts.throwOnError) throw e instanceof Error ? e : new Error(msg);
    }
  };

  return (
    <div className={compact ? "relative" : "flex flex-col gap-1"}>
      {!compact ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-app-muted">{label}</span>
          {selectedId ? (
            <button type="button" className="text-xs text-app-danger-text/90 hover:underline" onClick={() => onBind(null)}>
              {t("rel.clearSlot")}
            </button>
          ) : null}
        </div>
      ) : null}
      <PhotoUploadModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t("photo.modalTitle", { label })}
        accept="image/jpeg,image/png,image/webp"
        onConfirmFiles={(files) => tryIngestFile(files[0], { throwOnError: true })}
      />
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setPickerOpen(true);
          }
        }}
        onClick={() => setPickerOpen(true)}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = e.dataTransfer.types.includes("Files") ? "copy" : "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          const from = e.dataTransfer.getData(DND_SLOT_KIND) as MaterialImageKind;
          if (from && (from === "product" || from === "quoteAd" || from === "technical") && from !== kind) {
            onSwapKinds(from, kind);
            onUploadError(null);
            return;
          }
          if (e.dataTransfer.files?.length) void tryIngestFile(e.dataTransfer.files[0], { throwOnError: false });
        }}
        draggable={!!material}
        onDragStart={(e) => {
          if (material) {
            e.dataTransfer.setData(DND_SLOT_KIND, kind);
            e.dataTransfer.effectAllowed = "copyMove";
          } else {
            e.preventDefault();
          }
        }}
        className={
          compact
            ? `relative flex aspect-square w-full min-h-[5rem] cursor-pointer flex-col overflow-hidden rounded-lg border-2 bg-app-surface-2 text-left outline-none transition ${
                material
                  ? "border-app-success-border bg-app-success-tint/15 shadow-sm ring-2 ring-app-success-ring"
                  : "border-dashed border-app-line-mid hover:border-app-line-strong"
              }`
            : `relative flex min-h-[5.25rem] w-full cursor-pointer flex-col overflow-hidden rounded-lg border-2 bg-app-surface-2 text-left transition outline-none ${
                material
                  ? "border-app-success-border bg-app-success-tint/15 shadow-sm ring-2 ring-app-success-ring"
                  : "border-dashed border-app-line-mid hover:border-app-line-strong"
              }`
        }
      >
        {material ? (
          <>
            <img src={material.dataUrl} alt="" className="h-full w-full object-cover" draggable={false} />
            {compact ? (
              <button
                type="button"
                className="absolute right-1 top-1 z-[1] flex h-6 w-6 items-center justify-center rounded-md border border-app-line-strong bg-app-surface/90 text-xs text-app-muted shadow hover:bg-app-danger-bg hover:text-app-danger-text"
                onClick={(e) => {
                  e.stopPropagation();
                  onBind(null);
                }}
                aria-label={t("rel.clearImageAria")}
              >
                ×
              </button>
            ) : (
              <span className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-app-text/75 to-transparent px-1 py-1 text-xs text-app-text">
                <span className="line-clamp-2">{material.fileName}</span>
              </span>
            )}
          </>
        ) : compact ? (
          <span className="m-auto flex flex-col items-center justify-center gap-0.5 px-0.5 text-center">
            <span className="text-2xl font-light leading-none text-app-muted">+</span>
            <span className="text-[9px] leading-tight text-app-subtle">{label}</span>
          </span>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 text-center">
            <span className="text-sm text-app-muted">{t("rel.slotEmpty")}</span>
            <span className="text-[10px] leading-tight text-app-subtle">{label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function RelationsPanel({
  erpEditorOnly = false,
  erpListOnly = false,
  erpAssociationId = null,
  hideModuleHeader = false,
  erpStackedCatalog = false,
  erpCompactEditor = false,
}: {
  /** ERP 产品库三栏布局时仅显示右侧表单项，由左侧列表选择条目 */
  erpEditorOnly?: boolean;
  /** ERP 产品库三栏时仅显示列表，选中行写入 store，供右侧 `erpEditorOnly` 实例加载 */
  erpListOnly?: boolean;
  erpAssociationId?: string | null;
  /** ERP 产品目录外层已有分区标题与导航时隐藏本面板顶栏，避免重复 */
  hideModuleHeader?: boolean;
  /** true：目录/列表/编辑上下独立堆叠，列表区可滚动且表头 sticky */
  erpStackedCatalog?: boolean;
  /** 产品库右侧栏：去顶栏大标题、弱化外框 */
  erpCompactEditor?: boolean;
} = {}) {
  const t = useT();
  /** ERP 硬件表列数：分类、型号、地图缩写、规格、标签、备注、单价区间［、库存］ */
  const erpHwTableCols = erpListOnly ? 8 : 7;
  const uiLocale = useQuoteStore((s) => s.uiLocale);
  const erpCatalogSelection = useQuoteStore((s) => s.erpCatalogSelection);
  const erpCatalogActiveKind = useQuoteStore((s) => s.erpCatalogActiveKind);
  const erpCatalogSel = useQuoteStore((s) => s.erpCatalogSel);
  const erpCatalogSearchQuery = useQuoteStore((s) => s.erpCatalogSearchQuery);
  const setErpCatalogSelection = useQuoteStore((s) => s.setErpCatalogSelection);
  const materials = useQuoteStore((s) => s.materials);
  const categoryDefs = useQuoteStore((s) => s.categoryDefs);
  const softwareFeatures = useQuoteStore((s) => s.softwareFeatures);
  const serviceItems = useQuoteStore((s) => s.serviceItems);
  const associations = useQuoteStore((s) => s.associations);
  const upsertAssociation = useQuoteStore((s) => s.upsertAssociation);
  const removeAssociation = useQuoteStore((s) => s.removeAssociation);
  const setActiveTab = useQuoteStore((s) => s.setActiveTab);
  const addCategory = useQuoteStore((s) => s.addCategory);
  const patchCategoryDef = useQuoteStore((s) => s.patchCategoryDef);
  const patchMaterial = useQuoteStore((s) => s.patchMaterial);
  const erpLines = useQuoteStore((s) => s.erpInventoryLines);
  const quoteGlobalPriceTier = useQuoteStore((s) => s.quoteGlobalPriceTier);
  const companyCatalogCurrency = useQuoteStore((s) => s.companyCatalogCurrency);
  const companyCatalogFxMultiplier = useQuoteStore((s) => s.companyCatalogFxMultiplier);
  const erpHardwareNavSortMode = useQuoteStore((s) => s.erpHardwareNavSortMode);
  const setErpHardwareNavSortMode = useQuoteStore((s) => s.setErpHardwareNavSortMode);

  const fmtCatalogRange = useCallback(
    (lo: number, hi: number) =>
      formatMoneyRange(
        lo * (Number.isFinite(companyCatalogFxMultiplier) ? companyCatalogFxMultiplier : 1),
        hi * (Number.isFinite(companyCatalogFxMultiplier) ? companyCatalogFxMultiplier : 1),
        companyCatalogCurrency,
      ),
    [companyCatalogCurrency, companyCatalogFxMultiplier],
  );

  const hardwareCategoryLabel = useCallback(
    (r: AssociationRow) => {
      const raw = r.hardwareName.trim();
      if (!raw) return "—";
      if (raw === UNCATEGORIZED_CATEGORY_NAME) return t("cat.uncategorized");
      const d = categoryDefs.find((x) => x.name === raw);
      return d ? categoryOptionText(d) : raw;
    },
    [categoryDefs, t],
  );

  const notePreview = useCallback((s: string, max = 20) => {
    const x = s.trim();
    if (!x) return "—";
    return x.length > max ? `${x.slice(0, max)}…` : x;
  }, []);

  const [draft, setDraft] = useState<AssociationRow>(() => emptyRow());
  const [optionBarcodeErr, setOptionBarcodeErr] = useState<Record<string, string>>({});
  const [priceBandStr, setPriceBandStr] = useState("");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [pickerIconKey, setPickerIconKey] = useState("device");
  const [slotErr, setSlotErr] = useState<string | null>(null);
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [catQuery, setCatQuery] = useState("");
  const [hwGroupCollapsed, setHwGroupCollapsed] = useState<Record<string, boolean>>({});
  const [skuDeleteConfirmOpen, setSkuDeleteConfirmOpen] = useState(false);
  const pendingSkuDeleteIdRef = useRef<string | null>(null);
  const catWrapRef = useRef<HTMLDivElement | null>(null);
  const undoBaselineRef = useRef<AssociationRow | null>(null);
  const [baselineRev, setBaselineRev] = useState(0);
  /** ERP 产品库右侧紧凑编辑栏（分段线 + 图标弹窗等） */
  const useCatalogCompactEditor = erpEditorOnly && erpCompactEditor && hideModuleHeader;
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const customColorInputRef = useRef<HTMLInputElement>(null);

  const showList = !erpEditorOnly;
  const showEditor = !erpListOnly;

  const syncPriceStr = (row: AssociationRow) => {
    setPriceBandStr(formatPriceTriple(normalizePriceBandPartial(row.priceBand, row.unitPrice)));
  };

  const listPriceLocked = draft.options.length > 0;
  const tripleParts = tripleInputParts(priceBandStr);
  const setListPriceIdx = (idx: 0 | 1 | 2, raw: string) => {
    if (listPriceLocked) return;
    const parts: [string, string, string] = [tripleParts[0], tripleParts[1], tripleParts[2]];
    parts[idx] = raw;
    const joined = parts.join(";");
    const nb = parsePriceTripleString(joined);
    const nextStr = formatPriceTriple(nb);
    setPriceBandStr(nextStr);
    setDraft((prev) => ({ ...prev, unitPrice: nb.regular, priceBand: nb }));
  };

  const pushUndoBaseline = (row: AssociationRow) => {
    undoBaselineRef.current = cloneRow(row);
    setBaselineRev((x) => x + 1);
  };

  const loadRowIntoEditor = (r: AssociationRow) => {
    const c = cloneRow(r);
    setDraft(c);
    syncPriceStr(c);
    pushUndoBaseline(c);
    setSelectedRowId(r.id);
    if (hideModuleHeader) {
      const cur = useQuoteStore.getState().erpCatalogSelection;
      const sameHardwareSel =
        cur?.kind === "hardware" &&
        cur.id === r.id &&
        (cur.catalogOptionId ?? null) === null;
      if (!sameHardwareSel) {
        setErpCatalogSelection({ kind: "hardware", id: r.id, catalogOptionId: null });
      }
    }
    const st = useQuoteStore.getState();
    const def = st.categoryDefs.find((d) => d.name === r.hardwareName.trim());
    setPickerIconKey(
      def
        ? normIconKey(def.iconKey ?? "device")
        : normIconKey(iconKeyForAssociation(r, st.materials, st.categoryDefs)),
    );
    setCatQuery(c.hardwareName);
    setCatMenuOpen(false);
  };

  useEffect(() => {
    if (!erpEditorOnly) return;
    if (erpCatalogSelection?.kind === "hardware") {
      const r = useQuoteStore.getState().associations.find((a) => a.id === erpCatalogSelection.id);
      if (r) loadRowIntoEditor(r);
      return;
    }
    if (!erpAssociationId) return;
    const r = useQuoteStore.getState().associations.find((a) => a.id === erpAssociationId);
    if (r) loadRowIntoEditor(r);
  }, [erpEditorOnly, erpCatalogSelection, erpAssociationId, associations]);

  /** 左侧已选目录且中间未选中行时：右侧表单重置为「当前目录」下的新条目模板，避免仍显示上一行的设备数据 */
  useEffect(() => {
    if (!erpEditorOnly || !hideModuleHeader) return;
    if (erpCatalogActiveKind !== "hardware") return;
    if (erpCatalogSelection?.kind === "hardware") return;
    const { primary, filterKey } = erpCatalogSel.hardware;
    if (primary == null && filterKey == null) return;

    // Read defs from store here — do not depend on `categoryDefs` or icon/color patches re-run this and wipe the editor.
    const defsNow = useQuoteStore.getState().categoryDefs;
    const categoryName = resolveHardwareCategoryNameForNav(primary, filterKey, defsNow);
    const base = emptyRow();
    if (categoryName) {
      base.hardwareName = categoryName;
      base.color = nextDistinctMapColor(categoryName, useQuoteStore.getState().associations, base.id);
    }
    setDraft(base);
    syncPriceStr(base);
    pushUndoBaseline(cloneRow(base));
    setSelectedRowId(null);
    setCatQuery(categoryName ?? "");
    const def = defsNow.find((d) => d.name === (categoryName ?? ""));
    setPickerIconKey(normIconKey(def?.iconKey ?? "device"));
    setCatMenuOpen(false);
    setOptionBarcodeErr({});
    setSlotErr(null);
  }, [
    erpEditorOnly,
    hideModuleHeader,
    erpCatalogActiveKind,
    erpCatalogSelection,
    erpCatalogSel.hardware,
  ]);

  useEffect(() => {
    pushUndoBaseline(cloneRow(draft));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载时建立撤销基线
  }, []);

  const isDirty = useMemo(() => {
    const b = undoBaselineRef.current;
    if (!b) return false;
    const cur = persistedRowShape(draft, parsePriceTripleString(priceBandStr));
    const base = persistedRowShape(b, normalizePriceBandPartial(b.priceBand, b.unitPrice));
    return !persistedRowsEqual(cur, base);
  }, [draft, priceBandStr, baselineRev]);

  useEffect(() => {
    const n = draft.hardwareName.trim();
    const def = categoryDefs.find((d) => d.name === n);
    if (def) setPickerIconKey(normIconKey(def.iconKey));
    else if (!n) setPickerIconKey("device");
  }, [draft.hardwareName, categoryDefs]);

  useEffect(() => {
    if (!catMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = catWrapRef.current;
      if (el && !el.contains(e.target as Node)) setCatMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [catMenuOpen]);

  useEffect(() => {
    if (!iconPickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIconPickerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [iconPickerOpen]);

  const matById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const allErpRows = useMemo(
    () => [
      ...buildHardwareCatRows(associations, matById, categoryDefs),
      ...buildSoftwareCatRows(softwareFeatures),
      ...buildServiceCatRows(serviceItems),
    ],
    [associations, matById, softwareFeatures, serviceItems],
  );

  const hardwareNavPrimaries = useMemo(
    () => listHardwareNavPrimaries(allErpRows, categoryDefs, materials),
    [allErpRows, categoryDefs, materials],
  );

  const orderedHardwarePrimaries = useMemo(
    () => sortHardwareNavPrimariesByMode(hardwareNavPrimaries, categoryDefs, erpHardwareNavSortMode),
    [hardwareNavPrimaries, categoryDefs, erpHardwareNavSortMode],
  );

  const erpNavMaterialsInTab = useMemo(
    () =>
      materials.filter(
        (m) => m.imageKind === "technical" || m.imageKind === "softwareDoc" || m.imageKind === "product",
      ),
    [materials],
  );

  const associationsForList = useMemo(() => {
    if (!erpListOnly) return associations;
    const { primary, filterKey } = erpCatalogSel.hardware;
    let list = filterAssociationsByCatalogNav(associations, matById, categoryDefs, primary, filterKey);
    const q = erpCatalogSearchQuery.trim();
    if (!q) return list;
    return list.filter((a) => {
      if (associationMatchesErpCatalogSearch(a, q, matById)) return true;
      const rows = buildHardwareCatRows([a], matById, categoryDefs);
      return rows.some((r) => erpCatalogRowMatchesQuery(r, q));
    });
  }, [erpListOnly, associations, matById, categoryDefs, erpCatalogSel.hardware, erpCatalogSearchQuery]);

  const associationGroups = useMemo(() => {
    const m = new Map<string, AssociationRow[]>();
    for (const a of associationsForList) {
      const k = a.hardwareName.trim() || "—";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    const idIndex = new Map<string, number>();
    associationsForList.forEach((a, i) => idIndex.set(a.id, i));
    const entries = [...m.entries()].sort(([ka, ra], [kb, rb]) => {
      const aa = ra[0]!;
      const bb = rb[0]!;
      const pa = associationMapCategory(aa, materials, categoryDefs) || "\uffff";
      const pb = associationMapCategory(bb, materials, categoryDefs) || "\uffff";
      const c = pa.localeCompare(pb, undefined, { sensitivity: "base" });
      if (c !== 0) return c;
      const c2 = ka.localeCompare(kb, undefined, { sensitivity: "base" });
      if (c2 !== 0) return c2;
      const minA = Math.min(...ra.map((x) => idIndex.get(x.id) ?? 1e9));
      const minB = Math.min(...rb.map((x) => idIndex.get(x.id) ?? 1e9));
      return minA - minB;
    });
    return entries.map(([hardwareKey, rows]) => ({ hardwareKey, rows }));
  }, [associationsForList, materials, categoryDefs]);

  const hardwareCategoryDefs = useMemo(
    () => categoryDefs.filter((d) => !isBrandOnlyMaterialCategory(d.name)),
    [categoryDefs],
  );

  const filteredCategoryDefs = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    if (!q) return hardwareCategoryDefs;
    return hardwareCategoryDefs.filter((d) => {
      if (d.name.toLowerCase().includes(q)) return true;
      const en = d.nameEn?.trim().toLowerCase() ?? "";
      if (en.includes(q)) return true;
      if (categoryOptionText(d).toLowerCase().includes(q)) return true;
      return false;
    });
  }, [hardwareCategoryDefs, catQuery]);

  const selectedCategoryDisplay = useMemo(() => {
    const n = draft.hardwareName.trim();
    if (!n) return "";
    const def = categoryDefs.find((d) => d.name === n);
    return def ? categoryOptionText(def) : n;
  }, [draft.hardwareName, categoryDefs]);

  const applyPickCategory = useCallback(
    (d: MaterialCategoryDef) => {
      const nextColor = nextDistinctMapColor(d.name, useQuoteStore.getState().associations, draft.id);
      setDraft((prev) => ({
        ...prev,
        hardwareName: d.name,
        color: nextColor,
      }));
      const others = useQuoteStore
        .getState()
        .associations.filter((a) => a.hardwareName.trim() === d.name && a.id !== draft.id);
      if (others.length === 0) {
        patchCategoryDef(d.name, { defaultMapColor: nextColor });
      }
      setPickerIconKey(normIconKey(d.iconKey));
      setCatQuery(d.name);
      setCatMenuOpen(false);
    },
    [draft.id, patchCategoryDef],
  );

  const categoryPickerGroups = useMemo(
    () =>
      categoryDefsToPickerGroups(
        filteredCategoryDefs,
        draft.hardwareName.trim() || null,
        applyPickCategory,
        materials,
        associations,
        useCatalogCompactEditor
          ? {
              sortMode: erpHardwareNavSortMode,
              erpNavMaterialsInTab,
              allCategoryDefs: categoryDefs,
              orderedHardwarePrimaries,
            }
          : null,
      ),
    [
      filteredCategoryDefs,
      draft.hardwareName,
      applyPickCategory,
      materials,
      associations,
      useCatalogCompactEditor,
      erpHardwareNavSortMode,
      erpNavMaterialsInTab,
      categoryDefs,
      orderedHardwarePrimaries,
    ],
  );

  const createCategoryFromSearch = () => {
    const raw = catQuery.trim();
    if (!raw) return;
    const existing = hardwareCategoryDefs.find((x) => x.name === raw);
    if (existing) {
      applyPickCategory(existing);
      return;
    }
    const icon = normIconKey(pickerIconKey);
    const nextColor = nextDistinctMapColor(raw, useQuoteStore.getState().associations, draft.id);
    addCategory(raw, icon);
    patchCategoryDef(raw, { defaultMapColor: nextColor });
    setDraft((prev) => ({ ...prev, hardwareName: raw, color: nextColor }));
    setCatMenuOpen(false);
  };

  const setRowColorAndMaybeCategoryDefault = (color: string) => {
    const n = draft.hardwareName.trim();
    if (n && useQuoteStore.getState().categoryDefs.some((d) => d.name === n)) {
      patchCategoryDef(n, { defaultMapColor: color });
    }
    setDraft((prev) => ({ ...prev, color }));
  };

  /** 大图标 / 地图预览始终与当前选择的 `pickerIconKey` 一致（地图仍用 `iconKeyForAssociation` 规则渲染）。 */
  const draftGlyph = useMemo(() => normIconKey(pickerIconKey), [pickerIconKey]);

  const isPersistedInTable = associations.some((a) => a.id === draft.id);

  const uploadCategory = draft.hardwareName.trim() || UNCATEGORIZED_CATEGORY_NAME;

  const swapKinds = useCallback(
    (a: MaterialImageKind, b: MaterialImageKind) => {
      if (a === b) return;
      const fa = slotField(a);
      const fb = slotField(b);
      const idA = draft[fa];
      const idB = draft[fb];
      if (!idA && !idB) return;

      setDraft((d) => ({
        ...d,
        [fa]: idB,
        [fb]: idA,
      }));

      const applyKind = (id: string | null, newKind: MaterialImageKind) => {
        if (!id) return;
        const current = useQuoteStore.getState().materials;
        const prev = current.find((m) => m.id === id);
        const ext = fileExtFromUploadName(prev?.fileName ?? ".jpg");
        const serial = current.filter((m) => m.imageKind === newKind && m.id !== id).length + 1;
        patchMaterial(id, {
          imageKind: newKind,
          fileName: `${autoMaterialDisplayName(newKind, serial, 0)}${ext}`,
        });
      };

      applyKind(idA, b);
      applyKind(idB, a);
    },
    [draft, patchMaterial],
  );

  const ensureCategoryForAssociationName = (name: string, mapColor?: string) => {
    const st = useQuoteStore.getState();
    const icon = normIconKey(pickerIconKey);
    const color = mapColor ?? draft.color;
    if (!st.categoryDefs.some((d) => d.name === name)) {
      addCategory(name, icon);
    }
    patchCategoryDef(name, { iconKey: icon, defaultMapColor: color });
  };

  const commitDraft = (): boolean => {
    if (!draft.hardwareName.trim()) return false;
    const name = draft.hardwareName.trim();
    ensureCategoryForAssociationName(name);

    const rowBand = parsePriceTripleString(priceBandStr);
    const saved = normalizeAssociationRow({
      ...draft,
      hardwareName: name,
      unitPrice: rowBand.regular,
      priceBand: rowBand,
      options: draft.options
        .filter((o) => o.label.trim())
        .map((o) => {
          const ob = normalizePriceBandPartial(o.priceBand, o.optionPrice);
          return { ...o, label: o.label.trim(), optionPrice: ob.regular, priceBand: ob };
        }),
      addons: draft.addons
        .filter((o) => o.label.trim())
        .map((o) => ({ ...o, label: o.label.trim(), price: Math.max(0, o.price) })),
    });
    upsertAssociation(saved);
    setDraft(saved);
    syncPriceStr(saved);
    pushUndoBaseline(saved);
    setSelectedRowId(saved.id);
    return true;
  };

  const undoEdit = () => {
    const b = undoBaselineRef.current;
    if (!b) return;
    setDraft(cloneRow(b));
    syncPriceStr(b);
    const st = useQuoteStore.getState();
    const def = st.categoryDefs.find((d) => d.name === b.hardwareName.trim());
    setPickerIconKey(
      def
        ? normIconKey(def.iconKey ?? "device")
        : normIconKey(iconKeyForAssociation(b, st.materials, st.categoryDefs)),
    );
    setCatQuery(b.hardwareName);
    setCatMenuOpen(false);
  };

  const duplicateCurrent = () => {
    const fromStore = useQuoteStore.getState().associations.find((a) => a.id === draft.id);
    const src = fromStore ?? draft;
    const band = fromStore
      ? normalizePriceBandPartial(fromStore.priceBand, fromStore.unitPrice)
      : parsePriceTripleString(priceBandStr);
    const dm = (src.deviceModel ?? "").trim();
    const suf = translate(useQuoteStore.getState().uiLocale, "rel.duplicateSuffix");
    const nextModel = dm
      ? `${dm}${suf}`
      : `${(src.hardwareName.trim() || translate(useQuoteStore.getState().uiLocale, "rel.itemFallback")).slice(0, 48)}${suf}`;
    const base: AssociationRow = {
      ...src,
      unitPrice: band.regular,
      priceBand: band,
      hardwareName: src.hardwareName.trim() || "Untitled",
      deviceModel: nextModel,
      id: crypto.randomUUID(),
      options: src.options.map((o) => ({ ...o, id: crypto.randomUUID() })),
      addons: src.addons.map((o) => ({ ...o, id: crypto.randomUUID() })),
    };
    upsertAssociation(base);
    loadRowIntoEditor(base);
  };

  const doStartNew = () => {
    const locale = useQuoteStore.getState().uiLocale;
    const assoc = useQuoteStore.getState().associations;
    let i = assoc.length + 1;
    let hardwareName = translate(locale, "rel.newDeviceTemplate", { n: i });
    while (assoc.some((a) => a.hardwareName === hardwareName)) {
      i += 1;
      hardwareName = translate(locale, "rel.newDeviceTemplate", { n: i });
    }
    const id = crypto.randomUUID();
    const nextColor = nextDistinctMapColor(hardwareName, assoc, id);
    const row: AssociationRow = { ...emptyRow(), id, hardwareName, color: nextColor };
    upsertAssociation(row);
    loadRowIntoEditor(row);
    setSlotErr(null);
  };

  const runAfterSaveOrDiscard = (action: () => void) => {
    if (!isDirty) {
      action();
      return;
    }
    const wantSave = window.confirm(t("rel.unsavedPrompt"));
    if (wantSave) {
      if (!commitDraft()) {
        window.alert(t("rel.alertNeedCategory"));
        return;
      }
      action();
      return;
    }
    if (!window.confirm(t("rel.discardContinue"))) return;
    undoEdit();
    action();
  };

  const onUndoClick = () => {
    if (!isDirty) {
      undoEdit();
      return;
    }
    if (!window.confirm(t("rel.revertUnsaved"))) return;
    undoEdit();
  };

  const selectTableRow = (r: AssociationRow) => {
    if (erpListOnly) {
      runAfterSaveOrDiscard(() => {
        setErpCatalogSelection({ kind: "hardware", id: r.id, catalogOptionId: null });
      });
      return;
    }
    runAfterSaveOrDiscard(() => loadRowIntoEditor(r));
  };

  const startNew = () => {
    runAfterSaveOrDiscard(doStartNew);
  };

  const toggleHwGroup = (hardwareKey: string) => {
    setHwGroupCollapsed((prev) => {
      const collapsed = prev[hardwareKey] === true;
      return { ...prev, [hardwareKey]: !collapsed };
    });
  };

  const closeSkuDeleteConfirm = () => {
    setSkuDeleteConfirmOpen(false);
    pendingSkuDeleteIdRef.current = null;
  };

  const performSkuDelete = () => {
    const id = pendingSkuDeleteIdRef.current;
    closeSkuDeleteConfirm();
    if (!id) return;
    removeAssociation(id);
    const sel = useQuoteStore.getState().erpCatalogSelection;
    if (sel?.kind === "hardware" && sel.id === id) {
      useQuoteStore.getState().setErpCatalogSelection(null);
    }
    doStartNew();
  };

  const deleteCurrent = () => {
    runAfterSaveOrDiscard(() => {
      const st = useQuoteStore.getState();
      const id = draft.id;
      if (!st.associations.some((a) => a.id === id)) {
        doStartNew();
        return;
      }
      pendingSkuDeleteIdRef.current = id;
      setSkuDeleteConfirmOpen(true);
    });
  };

  const pickIcon = (key: string) => {
    const k = normIconKey(key);
    setPickerIconKey(k);
    const n = draft.hardwareName.trim();
    if (n && categoryDefs.some((d) => d.name === n)) patchCategoryDef(n, { iconKey: k });
  };

  const renderCompactCatalogEditor = (): ReactNode => (
    <div className="flex min-h-0 flex-1 flex-col divide-y divide-app-line-subtle/80">
      <section className="space-y-2 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-app-muted">{t("rel.erpSectionCategory")}</div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-[10px] text-app-muted">{t("erp.navSortLabel")}</span>
            <button
              type="button"
              onClick={() => setErpHardwareNavSortMode("manual")}
              className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                erpHardwareNavSortMode === "manual"
                  ? "border-app-tone/60 bg-app-tone/15 text-app-text"
                  : "border-app-line-subtle text-app-muted hover:bg-app-surface-2"
              }`}
            >
              {t("erp.navSortManual")}
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
              {t("erp.navSortAz")}
            </button>
          </div>
        </div>
        <div ref={catWrapRef} className="flex flex-col gap-1 text-xs text-app-muted">
          {draft.hardwareName.trim() ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-app-line-strong bg-app-surface-2/60 px-3 py-2">
              <HardwareGlyph id={draftGlyph} className="h-5 w-5 shrink-0 text-app-muted" />
              <span className="min-w-0 flex-1 truncate text-sm text-app-text">{selectedCategoryDisplay}</span>
              <button
                type="button"
                className="shrink-0 text-xs text-app-tone hover:underline"
                onClick={() => {
                  setCatQuery("");
                  setCatMenuOpen(true);
                }}
              >
                {t("rel.changeCategory")}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={catQuery}
                onChange={(e) => {
                  setCatQuery(e.target.value);
                  setCatMenuOpen(true);
                }}
                onFocus={() => setCatMenuOpen(true)}
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm text-app-text"
                placeholder={t("rel.searchPlaceholder")}
              />
              <button
                type="button"
                onClick={createCategoryFromSearch}
                className="shrink-0 rounded-lg border border-app-success-border bg-app-success-bg px-2.5 py-2 text-xs font-medium text-app-success-text hover:brightness-110"
              >
                {t("rel.createCategory")}
              </button>
            </div>
          )}
          {catMenuOpen ? (
            <div
              className="mt-1 max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain rounded-lg border border-app-line-strong bg-app-surface p-1.5 shadow-inner"
              onWheel={(e) => e.stopPropagation()}
            >
              {filteredCategoryDefs.length === 0 ? (
                <div className="px-3 py-2 text-xs text-app-muted">{t("rel.noCatMatches")}</div>
              ) : (
                <MaterialFolderNav disableInnerScroll className="w-full" groups={categoryPickerGroups} />
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-2 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-app-muted">{t("rel.erpSectionIcon")}</div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setIconPickerOpen(true)}
            className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded border border-app-line-strong bg-app-surface-2 shadow-sm hover:border-app-line-mid"
            title={t("rel.erpIconPickerIcons")}
          >
            <HardwareGlyph id={draftGlyph} className="h-11 w-11 shrink-0" style={{ color: draft.color }} />
          </button>
          <div className="min-w-0 flex-1 self-center">
            <div className="grid grid-cols-5 grid-rows-2 gap-1.5">
              {MAP_COLOR_PRESETS.slice(0, 9).map((hex) => (
                <button
                  key={hex}
                  type="button"
                  title={hex}
                  onClick={() => setRowColorAndMaybeCategoryDefault(hex)}
                  className={`h-5 w-5 shrink-0 rounded-full border border-black/20 shadow-sm transition ${
                    draft.color.toLowerCase() === hex.toLowerCase()
                      ? "ring-2 ring-app-success-ring ring-offset-2 ring-offset-app-surface"
                      : "hover:brightness-110"
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
              <button
                type="button"
                title={t("rel.customColor")}
                aria-label={t("rel.customColor")}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-app-line-mid text-sm font-light leading-none text-app-muted hover:border-app-line-strong hover:bg-app-surface-2"
                onClick={() => customColorInputRef.current?.click()}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-1.5 py-3">
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-app-muted">
          {t("rel.erpSectionProductName")}
          <input
            value={draft.deviceModel}
            onChange={(e) => setDraft({ ...draft, deviceModel: e.target.value })}
            className="rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm text-app-text"
            placeholder={t("rel.placeholderProductModel")}
          />
        </label>
      </section>

      <SkuSpecificationsEditor value={draft} onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))} compact />

      <section className="space-y-1.5 py-3">
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-app-muted">
          {t("rel.erpSectionMapAbbrev")}
          <input
            value={draft.mapLabelAbbrev ?? ""}
            onChange={(e) => setDraft({ ...draft, mapLabelAbbrev: e.target.value })}
            className="rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm text-app-text"
            placeholder={t("rel.mapAbbrevPlaceholder")}
            maxLength={120}
          />
        </label>
        <p className="text-[10px] leading-snug text-app-subtle">{t("rel.mapAbbrevHint")}</p>
      </section>

      <section className="space-y-1.5 py-3">
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-app-muted">
          {t("rel.erpSectionNote")}
          <input
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            className="rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm text-app-text"
          />
        </label>
      </section>

      <section className="space-y-2 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-app-muted">{t("rel.erpSectionOptions")}</div>
        <div className="space-y-2">
          {draft.options.map((o) => (
            <div key={o.id} className="flex flex-col gap-1.5 rounded-lg border border-app-line-subtle/80 bg-app-surface-2/25 p-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <input
                  value={o.label}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      options: d.options.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)),
                    }))
                  }
                  className="min-w-0 flex-1 rounded border border-app-line-strong bg-app-surface-2 px-2 py-1.5 text-xs text-app-text"
                  placeholder={t("rel.optionLabelPh")}
                />
                <input
                  type="text"
                  placeholder={t("rel.optionPriceTriplePh")}
                  value={formatPriceTriple(normalizePriceBandPartial(o.priceBand, o.optionPrice))}
                  onChange={(e) => {
                    const b = parsePriceTripleString(e.target.value);
                    setDraft((d) => ({
                      ...d,
                      options: d.options.map((x) =>
                        x.id === o.id ? { ...x, optionPrice: b.regular, priceBand: b } : x,
                      ),
                    }));
                  }}
                  className="w-36 min-w-[9rem] shrink-0 rounded border border-app-line-strong bg-app-surface-2 px-1 py-1 text-xs text-app-text"
                />
                <button
                  type="button"
                  title={t("rel.remove")}
                  aria-label={t("rel.remove")}
                  className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-app-danger-border/80 text-app-danger-text hover:bg-app-danger-bg"
                  onClick={() => {
                    if (!window.confirm(t("rel.confirmDeleteOption"))) return;
                    setDraft((d) => ({ ...d, options: d.options.filter((x) => x.id !== o.id) }));
                  }}
                >
                  <IconTrashSpec />
                </button>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-24 shrink-0 text-[11px] text-app-muted sm:w-28">{t("rel.optionBarcode")}</span>
                <input
                  className="min-w-0 flex-1 rounded border border-app-line-strong bg-app-surface-2 px-2 py-1.5 font-mono text-xs text-app-text"
                  placeholder="—"
                  value={o.barcode ?? ""}
                  onChange={(e) => {
                    setOptionBarcodeErr((m) => ({ ...m, [o.id]: "" }));
                    setDraft((d) => ({
                      ...d,
                      options: d.options.map((x) => (x.id === o.id ? { ...x, barcode: e.target.value } : x)),
                    }));
                  }}
                  onBlur={() => {
                    const raw = o.barcode?.trim() ?? "";
                    if (!raw) {
                      setOptionBarcodeErr((m) => ({ ...m, [o.id]: "" }));
                      setDraft((d) => ({
                        ...d,
                        options: d.options.map((x) => (x.id === o.id ? { ...x, barcode: undefined } : x)),
                      }));
                      return;
                    }
                    const clash = findBarcodeClash(
                      erpLines,
                      raw,
                      { kind: "hardware", catalogRefId: draft.id, catalogOptionId: o.id },
                      associations,
                    );
                    if (clash) {
                      setOptionBarcodeErr((m) => ({ ...m, [o.id]: t("rel.optionBarcodeConflict") }));
                      setDraft((d) => ({
                        ...d,
                        options: d.options.map((x) => (x.id === o.id ? { ...x, barcode: undefined } : x)),
                      }));
                      return;
                    }
                    setOptionBarcodeErr((m) => ({ ...m, [o.id]: "" }));
                    setDraft((d) => ({
                      ...d,
                      options: d.options.map((x) => (x.id === o.id ? { ...x, barcode: raw } : x)),
                    }));
                  }}
                  title={t("rel.optionBarcode")}
                />
              </div>
              {optionBarcodeErr[o.id] ? (
                <span className="text-[11px] text-app-danger-text">{optionBarcodeErr[o.id]}</span>
              ) : null}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <KindUploadSlot
                  label={t("rel.slotProductImg")}
                  kind="product"
                  material={o.productMaterialId ? (matById.get(o.productMaterialId) ?? null) : null}
                  uploadCategory={uploadCategory}
                  selectedId={o.productMaterialId ?? null}
                  onBind={(id) =>
                    setDraft((d) => ({
                      ...d,
                      options: d.options.map((x) =>
                        x.id === o.id ? { ...x, productMaterialId: id ?? undefined } : x,
                      ),
                    }))
                  }
                  onSwapKinds={() => {}}
                  onUploadError={setSlotErr}
                  slotStyle="compact"
                />
                <KindUploadSlot
                  label={t("rel.slotTechImg")}
                  kind="technical"
                  material={o.technicalMaterialId ? (matById.get(o.technicalMaterialId) ?? null) : null}
                  uploadCategory={uploadCategory}
                  selectedId={o.technicalMaterialId ?? null}
                  onBind={(id) =>
                    setDraft((d) => ({
                      ...d,
                      options: d.options.map((x) =>
                        x.id === o.id ? { ...x, technicalMaterialId: id ?? undefined } : x,
                      ),
                    }))
                  }
                  onSwapKinds={() => {}}
                  onUploadError={setSlotErr}
                  slotStyle="compact"
                />
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="self-start rounded border border-app-line-mid px-2 py-1 text-xs text-app-muted hover:bg-app-surface-2"
          onClick={() =>
            setDraft((d) => {
              const seedBand = parsePriceTripleString(priceBandStr);
              const fb =
                seedBand.regular > 0
                  ? seedBand
                  : normalizePriceBandPartial(d.priceBand, d.unitPrice);
              return {
                ...d,
                options: [
                  ...d.options,
                  {
                    id: crypto.randomUUID(),
                    label: "",
                    optionPrice: fb.regular,
                    priceBand: fb,
                  },
                ],
              };
            })
          }
        >
          {t("rel.addOption")}
        </button>
      </section>

      <section className="space-y-2 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-app-muted">{t("rel.erpSectionAddons")}</div>
        <div className="space-y-1">
          {draft.addons.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-2">
              <input
                value={o.label}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    addons: d.addons.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)),
                  }))
                }
                className="min-w-[6rem] flex-1 rounded border border-app-line-strong bg-app-surface-2 px-2 py-1 text-xs text-app-text"
                placeholder={t("rel.optionLabelPh")}
              />
              <label className="flex items-center gap-1 text-xs text-app-muted">
                {t("rel.addonPrice")}
                <input
                  type="number"
                  min={0}
                  value={Number.isFinite(o.price) ? o.price : 0}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    setDraft((d) => ({
                      ...d,
                      addons: d.addons.map((x) =>
                        x.id === o.id ? { ...x, price: Number.isFinite(n) && n >= 0 ? n : 0 } : x,
                      ),
                    }));
                  }}
                  className="w-20 rounded border border-app-line-strong bg-app-surface-2 px-1 py-1 text-xs text-app-text"
                />
              </label>
              <button
                type="button"
                className="rounded border border-app-line-mid px-2 py-1 text-xs text-app-muted hover:bg-app-surface-2"
                onClick={() => setDraft((d) => ({ ...d, addons: d.addons.filter((x) => x.id !== o.id) }))}
              >
                {t("rel.remove")}
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="self-start rounded border border-app-line-mid px-2 py-1 text-xs text-app-muted hover:bg-app-surface-2"
          onClick={() =>
            setDraft((d) => ({
              ...d,
              addons: [...d.addons, { id: crypto.randomUUID(), label: "", price: 0 }],
            }))
          }
        >
          {t("rel.addAddon")}
        </button>
      </section>

      <section className="space-y-2 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-app-muted">{t("rel.erpSectionUploadImages")}</div>
        <div className="grid grid-cols-3 gap-2">
          <KindUploadSlot
            label={t("rel.slotProductImg")}
            kind="product"
            material={draft.productMaterialId ? (matById.get(draft.productMaterialId) ?? null) : null}
            uploadCategory={uploadCategory}
            selectedId={draft.productMaterialId}
            onBind={(id) => setDraft({ ...draft, productMaterialId: id })}
            onSwapKinds={swapKinds}
            onUploadError={setSlotErr}
            slotStyle="compact"
          />
          <KindUploadSlot
            label={t("rel.slotMarketingImg")}
            kind="quoteAd"
            material={draft.quoteAdMaterialId ? (matById.get(draft.quoteAdMaterialId) ?? null) : null}
            uploadCategory={uploadCategory}
            selectedId={draft.quoteAdMaterialId}
            onBind={(id) => setDraft({ ...draft, quoteAdMaterialId: id })}
            onSwapKinds={swapKinds}
            onUploadError={setSlotErr}
            slotStyle="compact"
          />
          <KindUploadSlot
            label={t("rel.slotTechImg")}
            kind="technical"
            material={draft.technicalMaterialId ? (matById.get(draft.technicalMaterialId) ?? null) : null}
            uploadCategory={uploadCategory}
            selectedId={draft.technicalMaterialId}
            onBind={(id) => setDraft({ ...draft, technicalMaterialId: id })}
            onSwapKinds={swapKinds}
            onUploadError={setSlotErr}
            slotStyle="compact"
          />
        </div>
        {slotErr ? (
          <div className="rounded border border-app-danger-border bg-app-danger-bg px-2 py-1.5 text-xs text-app-danger-text">
            {slotErr}
          </div>
        ) : null}
      </section>

      <section className="space-y-1.5 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-app-muted">{t("rel.listPriceBands")}</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              ["rel.priceTierRegular", 0],
              ["rel.priceTierVip", 1],
              ["rel.priceTierVvip", 2],
            ] as const
          ).map(([key, idx]) => (
            <label
              key={key}
              className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-app-muted"
            >
              {t(key)}
              <input
                type="text"
                inputMode="decimal"
                disabled={listPriceLocked}
                title={listPriceLocked ? t("lib.basePriceLocked") : undefined}
                value={tripleParts[idx]}
                onChange={(e) => setListPriceIdx(idx as 0 | 1 | 2, e.target.value)}
                className="rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-app-muted">
          {t("rel.warrantyMonths")}
          <input
            type="number"
            min={0}
            step={1}
            value={draft.warrantyMonthsAfterShip ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") {
                setDraft({ ...draft, warrantyMonthsAfterShip: null });
                return;
              }
              const n = parseInt(v, 10);
              setDraft({
                ...draft,
                warrantyMonthsAfterShip: !Number.isNaN(n) && n >= 0 ? n : null,
              });
            }}
            className="rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm"
          />
        </label>
      </section>
    </div>
  );

  const editorForm = (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      {erpEditorOnly && erpCompactEditor ? null : (
        <div className="shrink-0 rounded-lg border border-app-line-subtle bg-app-surface-2/50 p-2">
          <div className="text-xs font-medium uppercase tracking-wide text-app-muted">{t("rel.hardwareEditorTitle")}</div>
          <div className="mt-0.5 truncate text-xs text-app-muted">
            {isPersistedInTable ? draft.hardwareName || draft.id.slice(0, 8) : t("rel.hardwareEditorNewRow")}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pr-0.5">
        {useCatalogCompactEditor ? (
          renderCompactCatalogEditor()
        ) : (
        <div className="flex flex-col gap-3">
        <div ref={catWrapRef} className="flex flex-col gap-1 text-xs text-app-muted">
          <span>{t("rel.editorCategoryLabel")}</span>
          {draft.hardwareName.trim() ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-app-line-strong bg-app-surface-2/60 px-3 py-2">
              <HardwareGlyph id={draftGlyph} className="h-5 w-5 shrink-0 text-app-muted" />
              <span className="min-w-0 flex-1 truncate text-sm text-app-text">{selectedCategoryDisplay}</span>
              <button
                type="button"
                className="shrink-0 text-xs text-app-tone hover:underline"
                onClick={() => {
                  setCatQuery("");
                  setCatMenuOpen(true);
                }}
              >
                {t("rel.changeCategory")}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={catQuery}
                onChange={(e) => {
                  setCatQuery(e.target.value);
                  setCatMenuOpen(true);
                }}
                onFocus={() => setCatMenuOpen(true)}
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm text-app-text"
                placeholder={t("rel.searchPlaceholder")}
              />
              <button
                type="button"
                onClick={createCategoryFromSearch}
                className="shrink-0 rounded-lg border border-app-success-border bg-app-success-bg px-2.5 py-2 text-xs font-medium text-app-success-text hover:brightness-110"
              >
                {t("rel.createCategory")}
              </button>
            </div>
          )}
          {catMenuOpen ? (
            <div
              className="mt-1 max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain rounded-lg border border-app-line-strong bg-app-surface p-1.5 shadow-inner"
              onWheel={(e) => e.stopPropagation()}
            >
              {filteredCategoryDefs.length === 0 ? (
                <div className="px-3 py-2 text-xs text-app-muted">{t("rel.noCatMatches")}</div>
              ) : (
                <MaterialFolderNav disableInnerScroll className="w-full" groups={categoryPickerGroups} />
              )}
            </div>
          ) : null}
        </div>

      <label className="flex flex-col gap-1 text-xs text-app-muted">
        {t("rel.labelProductAndModel")}
        <input
          value={draft.deviceModel}
          onChange={(e) => setDraft({ ...draft, deviceModel: e.target.value })}
          className="rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm text-app-text"
          placeholder={t("rel.placeholderProductModel")}
        />
      </label>

      <SkuSpecificationsEditor value={draft} onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))} />

      <label className="flex flex-col gap-1 text-xs text-app-muted">
        {t("rel.erpSectionMapAbbrev")}
        <input
          value={draft.mapLabelAbbrev ?? ""}
          onChange={(e) => setDraft({ ...draft, mapLabelAbbrev: e.target.value })}
          className="rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm text-app-text"
          placeholder={t("rel.mapAbbrevPlaceholder")}
          maxLength={120}
        />
      </label>

      <div className="flex flex-col gap-1.5 rounded-lg border border-app-line-subtle bg-app-surface-2/40 p-2">
        <div className="text-xs font-medium text-app-muted">Spec options</div>
        <div className="space-y-2">
          {draft.options.map((o) => (
            <div
              key={o.id}
              className="flex flex-col gap-1.5 rounded-lg border border-app-line-subtle/80 bg-app-surface-2/25 p-2"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <input
                  value={o.label}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      options: d.options.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)),
                    }))
                  }
                  className="min-w-0 flex-1 rounded border border-app-line-strong bg-app-surface-2 px-2 py-1.5 text-xs text-app-text"
                  placeholder={t("rel.optionLabelPh")}
                />
                <input
                  type="text"
                  placeholder={t("rel.optionPriceTriplePh")}
                  value={formatPriceTriple(normalizePriceBandPartial(o.priceBand, o.optionPrice))}
                  onChange={(e) => {
                    const b = parsePriceTripleString(e.target.value);
                    setDraft((d) => ({
                      ...d,
                      options: d.options.map((x) =>
                        x.id === o.id ? { ...x, optionPrice: b.regular, priceBand: b } : x,
                      ),
                    }));
                  }}
                  className="w-36 min-w-[9rem] shrink-0 rounded border border-app-line-strong bg-app-surface-2 px-1 py-1 text-xs text-app-text"
                />
                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <ErpCatalogQtyInput kind="hardware" catalogRefId={draft.id} catalogOptionId={o.id} />
                </div>
                <button
                  type="button"
                  title={t("rel.removeSpec")}
                  aria-label={t("rel.removeSpec")}
                  className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-app-danger-border/80 text-app-danger-text hover:bg-app-danger-bg"
                  onClick={() => {
                    if (!window.confirm(t("rel.confirmDeleteOption"))) return;
                    setDraft((d) => ({ ...d, options: d.options.filter((x) => x.id !== o.id) }));
                  }}
                >
                  <IconTrashSpec />
                </button>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-24 shrink-0 text-[11px] text-app-muted sm:w-28">{t("rel.optionBarcode")}</span>
                <input
                  className="min-w-0 flex-1 rounded border border-app-line-strong bg-app-surface-2 px-2 py-1.5 font-mono text-xs text-app-text"
                  placeholder="—"
                  value={o.barcode ?? ""}
                  onChange={(e) => {
                    setOptionBarcodeErr((m) => ({ ...m, [o.id]: "" }));
                    setDraft((d) => ({
                      ...d,
                      options: d.options.map((x) => (x.id === o.id ? { ...x, barcode: e.target.value } : x)),
                    }));
                  }}
                  onBlur={() => {
                    const raw = o.barcode?.trim() ?? "";
                    if (!raw) {
                      setOptionBarcodeErr((m) => ({ ...m, [o.id]: "" }));
                      setDraft((d) => ({
                        ...d,
                        options: d.options.map((x) => (x.id === o.id ? { ...x, barcode: undefined } : x)),
                      }));
                      return;
                    }
                    const clash = findBarcodeClash(
                      erpLines,
                      raw,
                      { kind: "hardware", catalogRefId: draft.id, catalogOptionId: o.id },
                      associations,
                    );
                    if (clash) {
                      setOptionBarcodeErr((m) => ({ ...m, [o.id]: t("rel.optionBarcodeConflict") }));
                      setDraft((d) => ({
                        ...d,
                        options: d.options.map((x) => (x.id === o.id ? { ...x, barcode: undefined } : x)),
                      }));
                      return;
                    }
                    setOptionBarcodeErr((m) => ({ ...m, [o.id]: "" }));
                    setDraft((d) => ({
                      ...d,
                      options: d.options.map((x) => (x.id === o.id ? { ...x, barcode: raw } : x)),
                    }));
                  }}
                  title={t("rel.optionBarcode")}
                />
              </div>
              {optionBarcodeErr[o.id] ? (
                <span className="text-[11px] text-app-danger-text">{optionBarcodeErr[o.id]}</span>
              ) : null}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <KindUploadSlot
                  label={t("rel.slotProductImg")}
                  kind="product"
                  material={o.productMaterialId ? (matById.get(o.productMaterialId) ?? null) : null}
                  uploadCategory={uploadCategory}
                  selectedId={o.productMaterialId ?? null}
                  onBind={(id) =>
                    setDraft((d) => ({
                      ...d,
                      options: d.options.map((x) =>
                        x.id === o.id ? { ...x, productMaterialId: id ?? undefined } : x,
                      ),
                    }))
                  }
                  onSwapKinds={() => {}}
                  onUploadError={setSlotErr}
                />
                <KindUploadSlot
                  label={t("rel.slotTechImg")}
                  kind="technical"
                  material={o.technicalMaterialId ? (matById.get(o.technicalMaterialId) ?? null) : null}
                  uploadCategory={uploadCategory}
                  selectedId={o.technicalMaterialId ?? null}
                  onBind={(id) =>
                    setDraft((d) => ({
                      ...d,
                      options: d.options.map((x) =>
                        x.id === o.id ? { ...x, technicalMaterialId: id ?? undefined } : x,
                      ),
                    }))
                  }
                  onSwapKinds={() => {}}
                  onUploadError={setSlotErr}
                />
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="self-start rounded border border-app-line-mid px-2 py-1 text-xs text-app-muted hover:bg-app-surface-2"
          onClick={() =>
            setDraft((d) => {
              const seedBand = parsePriceTripleString(priceBandStr);
              const fb =
                seedBand.regular > 0
                  ? seedBand
                  : normalizePriceBandPartial(d.priceBand, d.unitPrice);
              return {
                ...d,
                options: [
                  ...d.options,
                  {
                    id: crypto.randomUUID(),
                    label: "",
                    optionPrice: fb.regular,
                    priceBand: fb,
                  },
                ],
              };
            })
          }
        >
          {t("rel.addSpec")}
        </button>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg border border-app-line-subtle bg-app-surface-2/40 p-2">
        <div className="text-xs font-medium text-app-muted">{t("rel.addonSectionTitle")}</div>
        <div className="space-y-1">
          {draft.addons.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-2">
              <input
                value={o.label}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    addons: d.addons.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)),
                  }))
                }
                className="min-w-[6rem] flex-1 rounded border border-app-line-strong bg-app-surface-2 px-2 py-1 text-xs text-app-text"
                placeholder={t("rel.optionLabelPh")}
              />
              <label className="flex items-center gap-1 text-xs text-app-muted">
                {t("rel.addonPrice")}
                <input
                  type="number"
                  min={0}
                  value={Number.isFinite(o.price) ? o.price : 0}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    setDraft((d) => ({
                      ...d,
                      addons: d.addons.map((x) =>
                        x.id === o.id ? { ...x, price: Number.isFinite(n) && n >= 0 ? n : 0 } : x,
                      ),
                    }));
                  }}
                  className="w-20 rounded border border-app-line-strong bg-app-surface-2 px-1 py-1 text-xs text-app-text"
                />
              </label>
              <button
                type="button"
                className="rounded border border-app-line-mid px-2 py-1 text-xs text-app-muted hover:bg-app-surface-2"
                onClick={() =>
                  setDraft((d) => ({ ...d, addons: d.addons.filter((x) => x.id !== o.id) }))
                }
              >
                {t("rel.remove")}
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="self-start rounded border border-app-line-mid px-2 py-1 text-xs text-app-muted hover:bg-app-surface-2"
          onClick={() =>
            setDraft((d) => ({
              ...d,
              addons: [...d.addons, { id: crypto.randomUUID(), label: "", price: 0 }],
            }))
          }
        >
          {t("rel.addAddon")}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2">
          <KindUploadSlot
            label={t("rel.slotProductImg")}
            kind="product"
            material={draft.productMaterialId ? (matById.get(draft.productMaterialId) ?? null) : null}
            uploadCategory={uploadCategory}
            selectedId={draft.productMaterialId}
            onBind={(id) => setDraft({ ...draft, productMaterialId: id })}
            onSwapKinds={swapKinds}
            onUploadError={setSlotErr}
          />
          <KindUploadSlot
            label={t("rel.slotMarketingImg")}
            kind="quoteAd"
            material={draft.quoteAdMaterialId ? (matById.get(draft.quoteAdMaterialId) ?? null) : null}
            uploadCategory={uploadCategory}
            selectedId={draft.quoteAdMaterialId}
            onBind={(id) => setDraft({ ...draft, quoteAdMaterialId: id })}
            onSwapKinds={swapKinds}
            onUploadError={setSlotErr}
          />
          <KindUploadSlot
            label={t("rel.slotTechImg")}
            kind="technical"
            material={draft.technicalMaterialId ? (matById.get(draft.technicalMaterialId) ?? null) : null}
            uploadCategory={uploadCategory}
            selectedId={draft.technicalMaterialId}
            onBind={(id) => setDraft({ ...draft, technicalMaterialId: id })}
            onSwapKinds={swapKinds}
            onUploadError={setSlotErr}
          />
        </div>
        {slotErr ? (
          <div className="rounded border border-app-danger-border bg-app-danger-bg px-2 py-1.5 text-xs text-app-danger-text">
            {slotErr}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {hideModuleHeader ? null : (
        <span className="text-xs text-app-muted">
          {t("rel.mapColorRowHint")}
        </span>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {MAP_COLOR_PRESETS.map((hex) => (
            <button
              key={hex}
              type="button"
              title={hex}
              onClick={() => setRowColorAndMaybeCategoryDefault(hex)}
              className={`h-5 w-5 shrink-0 rounded border border-app-line-strong transition ${
                draft.color.toLowerCase() === hex.toLowerCase()
                  ? "border-app-success-border ring-2 ring-app-success-ring"
                  : "hover:border-app-line-strong"
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
          <input
            type="color"
            value={draft.color}
            onChange={(e) => setRowColorAndMaybeCategoryDefault(e.target.value)}
            className="h-6 w-7 shrink-0 cursor-pointer overflow-hidden rounded border border-app-line-mid bg-app-surface-2 p-0"
            title={t("rel.customColor")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {hideModuleHeader ? null : (
        <span className="text-xs text-app-muted">
          {t("rel.glyphFromLibraryHint")}
        </span>
        )}
        <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto rounded-lg border border-app-line-subtle bg-app-surface-2/50 p-1.5">
          {HARDWARE_ICON_IDS.map((id) => (
            <button
              key={id}
              type="button"
              title={HARDWARE_ICON_LABELS[id]}
              onClick={() => pickIcon(id)}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border border-app-line-strong p-1 ${
                normIconKey(pickerIconKey) === id ? "border-app-success-border bg-app-success-bg" : "bg-app-surface"
              }`}
            >
              <HardwareGlyph id={id} className="h-5 w-5 text-app-muted" />
            </button>
          ))}
        </div>
      </div>

      <div
        className={`flex gap-2 rounded-lg border border-app-line-subtle bg-app-surface-2/50 p-2 ${
          hideModuleHeader ? "items-center justify-center" : "items-start"
        }`}
      >
        <HardwareGlyph id={draftGlyph} className="h-8 w-8 shrink-0" style={{ color: draft.color }} />
        {hideModuleHeader ? null : (
        <div className="min-w-0 text-xs text-app-muted">
          <div className="font-medium text-app-muted">{t("rel.mapPreviewTitle")}</div>
          <p className="mt-0.5 leading-snug">{t("rel.mapPreviewHint")}</p>
        </div>
        )}
      </div>

      <div className="flex flex-col gap-1 text-xs text-app-muted">
        <span className="font-semibold uppercase tracking-wide">{t("rel.listPriceBands")}</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              ["rel.priceTierRegular", 0],
              ["rel.priceTierVip", 1],
              ["rel.priceTierVvip", 2],
            ] as const
          ).map(([key, idx]) => (
            <label key={key} className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-app-muted">
              {t(key)}
              <input
                type="text"
                inputMode="decimal"
                disabled={listPriceLocked}
                title={listPriceLocked ? t("lib.basePriceLocked") : undefined}
                value={tripleParts[idx]}
                onChange={(e) => setListPriceIdx(idx as 0 | 1 | 2, e.target.value)}
                className="rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1 text-xs text-app-muted">
        {t("rel.warrantyMonths")}
        <input
          type="number"
          min={0}
          step={1}
          value={draft.warrantyMonthsAfterShip ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") {
              setDraft({ ...draft, warrantyMonthsAfterShip: null });
              return;
            }
            const n = parseInt(v, 10);
            setDraft({
              ...draft,
              warrantyMonthsAfterShip: !Number.isNaN(n) && n >= 0 ? n : null,
            });
          }}
          className="rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-app-muted">
        {t("rel.notesLabel")}
        <input
          value={draft.note}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          className="rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm"
        />
      </label>
        </div>
        )}

      {useCatalogCompactEditor ? (
        <>
          <input
            ref={customColorInputRef}
            type="color"
            value={draft.color}
            onChange={(e) => setRowColorAndMaybeCategoryDefault(e.target.value)}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
          {iconPickerOpen ? (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
              role="presentation"
              onClick={() => setIconPickerOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="hw-icon-picker-title"
                className="max-h-[min(90vh,40rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-app-line-subtle bg-app-panel-bg p-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span id="hw-icon-picker-title" className="text-sm font-semibold text-app-text">
                    {t("rel.erpSectionIcon")}
                  </span>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-app-muted hover:bg-app-surface-2 hover:text-app-text"
                    onClick={() => setIconPickerOpen(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <p className="mb-1.5 text-xs text-app-muted">{t("rel.erpIconPickerColors")}</p>
                <div className="mb-4 grid grid-cols-5 grid-rows-2 gap-1.5">
                  {MAP_COLOR_PRESETS.slice(0, 9).map((hex) => (
                    <button
                      key={`dlg-${hex}`}
                      type="button"
                      title={hex}
                      onClick={() => setRowColorAndMaybeCategoryDefault(hex)}
                      className={`h-5 w-5 shrink-0 rounded-full border border-black/20 shadow-sm transition ${
                        draft.color.toLowerCase() === hex.toLowerCase()
                          ? "ring-2 ring-app-success-ring ring-offset-2 ring-offset-app-panel-bg"
                          : "hover:brightness-110"
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  <button
                    type="button"
                    title={t("rel.customColor")}
                    aria-label={t("rel.customColor")}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-app-line-mid text-sm font-light leading-none text-app-muted hover:border-app-line-strong hover:bg-app-surface-2"
                    onClick={() => customColorInputRef.current?.click()}
                  >
                    +
                  </button>
                </div>
                <p className="mb-2 text-xs text-app-muted">{t("rel.erpIconPickerIcons")}</p>
                <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                  {HARDWARE_ICON_IDS.map((id) => (
                    <button
                      key={`dlg-ic-${id}`}
                      type="button"
                      title={HARDWARE_ICON_LABELS[id]}
                      onClick={() => {
                        pickIcon(id);
                        setIconPickerOpen(false);
                      }}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border border-app-line-strong p-1 ${
                        normIconKey(pickerIconKey) === id ? "ring-2 ring-app-success-ring ring-offset-1 ring-offset-app-panel-bg" : "hover:bg-app-surface-2"
                      }`}
                    >
                      <HardwareGlyph id={id} className="h-6 w-6 shrink-0" style={{ color: draft.color }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      </div>


      <div className="shrink-0 rounded-b-xl bg-app-surface-2/75 px-2 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!isDirty}
            onClick={() => {
              if (!commitDraft()) window.alert(t("rel.alertNeedCategory"));
            }}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
              isDirty
                ? "bg-app-primary text-app-on-primary ring-1 ring-app-primary/40 hover:bg-app-primary-hover"
                : "cursor-not-allowed border border-app-line-mid bg-app-surface text-app-muted opacity-55"
            }`}
          >
            {t("rel.btnSave")}
          </button>
          <button
            type="button"
            onClick={onUndoClick}
            className="rounded-lg border-2 border-app-line-strong bg-app-surface px-4 py-2.5 text-sm font-semibold text-app-text shadow-sm hover:bg-app-surface-2"
          >
            {t("rel.btnRevert")}
          </button>
          <button
            type="button"
            title={t("rel.newRowUnsavedHint")}
            onClick={startNew}
            className="rounded-lg border-2 border-app-line-strong bg-app-surface px-4 py-2.5 text-sm font-semibold text-app-text shadow-sm hover:bg-app-surface-2"
          >
            {t("rel.btnNew")}
          </button>
          <button
            type="button"
            onClick={() => runAfterSaveOrDiscard(duplicateCurrent)}
            disabled={!draft.hardwareName.trim()}
            className="rounded-lg border-2 border-app-line-strong bg-app-surface px-4 py-2.5 text-sm font-semibold text-app-text shadow-sm hover:bg-app-surface-2 disabled:opacity-40"
          >
            {t("rel.btnDuplicate")}
          </button>
          <button
            type="button"
            onClick={deleteCurrent}
            className="rounded-lg border-2 border-app-danger-border bg-app-danger-bg/35 px-4 py-2.5 text-sm font-semibold text-app-danger-text shadow-sm hover:bg-app-danger-bg"
          >
            {t("rel.btnDelete")}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
    <div className="flex h-full min-h-0 flex-col">
      {!hideModuleHeader ? (
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-app-line-subtle px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-app-text">Hardware library</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              useQuoteStore.getState().setCustomPlanTab("select");
              useQuoteStore.getState().setCustomPlanSelectStep("map");
              setActiveTab("customPlan");
            }}
            className="shrink-0 rounded-lg border border-app-line-strong px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface-2"
          >
            Custom plan · Map
          </button>
        </div>
      ) : null}

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
          showList && showEditor
            ? erpStackedCatalog
              ? "gap-4 lg:flex-row lg:items-stretch"
              : "lg:flex-row"
            : ""
        } ${erpStackedCatalog && showList && showEditor ? "gap-3" : ""}`}
      >
        {showList ? (
        <div
          className={`flex min-h-0 min-w-0 flex-col overflow-hidden border-app-line-subtle ${
            erpListOnly
              ? "min-h-0 flex-1 rounded-xl border bg-app-surface-2/15 p-2 shadow-sm sm:p-3"
            : erpStackedCatalog
              ? "shrink-0 rounded-xl border bg-app-surface-2/15 p-3 shadow-sm"
              : "flex-[7] lg:border-r"
          }`}
        >
          <div
            className={
              erpListOnly
                ? "min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain p-0"
                : erpStackedCatalog
                ? "min-h-0 max-h-[min(50vh,520px)] flex-1 overflow-y-auto overflow-x-auto overscroll-contain p-0 sm:px-0"
                : "min-h-0 flex-1 overflow-auto p-3 lg:p-4"
            }
          >
            <div className="overflow-x-auto rounded-xl border border-app-line-subtle">
              <table className="min-w-full divide-y divide-app-line-subtle text-sm">
                <thead
                  className={`sticky top-0 z-[2] text-left text-xs uppercase text-app-muted shadow-sm backdrop-blur ${
                    erpStackedCatalog ? "bg-app-surface/98" : "z-[1] bg-app-surface/95"
                  }`}
                >
                  <tr>
                    <th className="min-w-[160px] px-2 py-2">{t("rel.tableCategory")}</th>
                    <th className="min-w-[100px] px-2 py-2">{t("rel.tableModel")}</th>
                    <th className="min-w-[96px] px-2 py-2">{t("rel.tableMapAbbrev")}</th>
                    <th className="min-w-[88px] px-2 py-2">{t("rel.tableSpecAddon")}</th>
                    <th className="min-w-[72px] px-2 py-2">{t("erp.colTag")}</th>
                    <th className="min-w-[120px] px-2 py-2">{t("erp.colNote")}</th>
                    <th className="min-w-[120px] px-2 py-2">{t("rel.tableUnitPriceRange")}</th>
                    {erpListOnly ? (
                      <th className="min-w-[72px] px-2 py-2 text-right">{t("erp.colStock")}</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-line-subtle">
                  {associationsForList.length === 0 ? (
                    <tr>
                      <td colSpan={erpHwTableCols} className="px-3 py-8 text-center text-xs text-app-muted">
                        {erpListOnly && associations.length > 0
                          ? t("rel.erpListEmptyFilter", { n: associations.length })
                          : t("rel.tableNoEntries")}
                      </td>
                    </tr>
                  ) : (
                    associationGroups.flatMap(({ hardwareKey, rows }) => {
                      const multi = rows.length > 1;
                      const collapsed = hwGroupCollapsed[hardwareKey] === true;
                      const g0 = rows[0]!;
                      const gGlyph = iconKeyForAssociation(g0, materials, categoryDefs);

                      const rowTr = (r: AssociationRow, categoryTd: ReactNode | false) => {
                        const unitLo = associationLineMinUnit(r, quoteGlobalPriceTier);
                        const unitHi = associationLineMaxUnit(r, quoteGlobalPriceTier);
                        const listPickId =
                          erpListOnly && erpCatalogSelection?.kind === "hardware"
                            ? erpCatalogSelection.id
                            : selectedRowId;
                        const active = listPickId === r.id;
                        return (
                          <tr
                            key={r.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => selectTableRow(r)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                selectTableRow(r);
                              }
                            }}
                            className={`cursor-pointer transition ${
                              active ? "bg-app-primary-soft ring-1 ring-inset ring-app-primary/40" : "bg-app-surface-2/40 hover:bg-app-surface/80"
                            }`}
                          >
                            {categoryTd === false ? null : categoryTd}
                            <td className="max-w-[min(240px,32vw)] px-3 py-2 text-sm font-medium text-app-text" title={r.deviceModel || r.hardwareName}>
                              <div className="truncate">{r.deviceModel || "—"}</div>
                              <div className="mt-0.5 truncate text-[10px] font-normal text-app-muted">
                                {SKU_CLASS_LABEL[r.skuClass ?? inferSkuClass(r)]} · {skuFootprintLabel(r)}
                              </div>
                            </td>
                            <td
                              className="max-w-[10rem] truncate px-2 py-2 text-xs text-app-muted"
                              title={(r.mapLabelAbbrev ?? "").trim() || undefined}
                            >
                              {(r.mapLabelAbbrev ?? "").trim() || "—"}
                            </td>
                            <td className="max-w-[160px] px-2 py-2 text-xs leading-snug text-app-muted">{rowSpecAddonSummary(r, uiLocale)}</td>
                            <td className="whitespace-nowrap px-2 py-2 align-middle">
                              <AssociationTagIcons r={r} />
                            </td>
                            <td
                              className="max-w-[10rem] truncate px-2 py-2 text-xs text-app-muted"
                              title={r.note.trim() || undefined}
                            >
                              {notePreview(r.note)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-sm text-app-text">
                              {fmtCatalogRange(unitLo, unitHi)}
                            </td>
                            {erpListOnly ? (
                              <td
                                className="w-[92px] whitespace-nowrap px-2 py-1.5 text-right align-middle"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ErpCatalogQtyInput kind="hardware" catalogRefId={r.id} catalogOptionId={null} />
                              </td>
                            ) : null}
                          </tr>
                        );
                      };

                      if (!multi) {
                        const r = rows[0]!;
                        const rg = iconKeyForAssociation(r, materials, categoryDefs);
                        const cat = (
                          <td className="min-w-[200px] max-w-[min(320px,40vw)] px-2 py-2 align-top">
                            <span className="mr-1 inline-flex align-middle">
                              <HardwareGlyph id={rg} className="h-4 w-4 shrink-0" style={{ color: r.color }} />
                            </span>
                            <span className="text-xs leading-snug text-app-muted">{hardwareCategoryLabel(r)}</span>
                          </td>
                        );
                        return [rowTr(r, cat)];
                      }

                      if (collapsed) {
                        const gUnitLo = Math.min(...rows.map((row) => associationLineMinUnit(row, quoteGlobalPriceTier)));
                        const gUnitHi = Math.max(...rows.map((row) => associationLineMaxUnit(row, quoteGlobalPriceTier)));
                        return [
                          <tr
                            key={`grp-${hardwareKey}`}
                            className="cursor-pointer bg-app-surface-2/30 hover:bg-app-surface/70"
                            onClick={() => toggleHwGroup(hardwareKey)}
                          >
                            <td className="min-w-[200px] max-w-[min(320px,40vw)] px-2 py-2 align-top">
                              <HardwareGlyph id={gGlyph} className="h-4 w-4 shrink-0" style={{ color: g0.color }} />
                              <div className="text-xs leading-snug text-app-muted">{hardwareCategoryLabel(g0)}</div>
                            </td>
                            <td className="px-3 py-2 text-xs font-medium text-app-text">
                              {t("rel.groupModelsCount", { n: rows.length })}
                            </td>
                            <td className="px-2 py-2 text-xs text-app-subtle">—</td>
                            <td className="px-2 py-2 text-xs text-app-muted">{summarizeSpecsAddonsForRows(rows, uiLocale)}</td>
                            <td className="px-2 py-2 text-xs text-app-subtle">—</td>
                            <td className="px-2 py-2 text-xs text-app-subtle">—</td>
                            <td className="whitespace-nowrap px-3 py-2 text-sm text-app-muted">
                              {fmtCatalogRange(gUnitLo, gUnitHi)}
                            </td>
                            {erpListOnly ? (
                              <td
                                className="px-2 py-1.5 text-right align-middle"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex flex-col items-end gap-0.5">
                                  {rows.map((row) => (
                                    <div key={row.id} className="flex items-center justify-end">
                                      <ErpCatalogQtyInput kind="hardware" catalogRefId={row.id} catalogOptionId={null} />
                                    </div>
                                  ))}
                                </div>
                              </td>
                            ) : null}
                          </tr>,
                        ];
                      }

                      const subHeaderTr =
                        multi && !collapsed ? (
                          <tr key={`sub-${hardwareKey}`} className="bg-app-surface-2/45">
                            <td colSpan={erpHwTableCols} className="px-2 py-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <HardwareGlyph id={gGlyph} className="h-4 w-4 shrink-0" style={{ color: g0.color }} />
                                <span className="min-w-0 flex-1 text-xs font-semibold text-app-text">
                                  {hardwareCategoryLabel(g0)}
                                </span>
                                <button
                                  type="button"
                                  className="shrink-0 text-xs text-app-tone hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleHwGroup(hardwareKey);
                                  }}
                                >
                                  {t("rel.collapseGroup")}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : null;

                      const bodyRows = rows.map((r, idx) =>
                        rowTr(
                          r,
                          idx === 0 ? (
                            <td
                              rowSpan={rows.length}
                              className="min-w-[200px] max-w-[min(320px,40vw)] align-top border-r border-app-line-subtle/80 px-2 py-2"
                            >
                              <span className="text-lg leading-none text-app-subtle" aria-hidden>
                                ↳
                              </span>
                            </td>
                          ) : false,
                        ),
                      );
                      return subHeaderTr ? [subHeaderTr, ...bodyRows] : bodyRows;
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        ) : null}

        {showEditor ? (
        <div
          className={
            erpStackedCatalog
              ? `flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border-2 border-app-primary/35 bg-app-panel-bg p-4 shadow-[0_12px_48px_rgba(0,0,0,0.28)] ring-1 ring-app-primary/20 ${
                  erpEditorOnly ? "min-h-0" : "min-h-[min(52vh,640px)]"
                }`
              : `flex min-h-0 min-w-0 flex-col overflow-hidden border-t border-app-line-subtle bg-app-panel-bg p-3 lg:border-t-0 lg:p-4 ${
                  erpEditorOnly ? "flex-1" : "flex-[3]"
                } ${
                  erpEditorOnly && hideModuleHeader
                    ? erpCompactEditor
                      ? "rounded-xl border border-app-line-subtle bg-app-panel-bg p-3"
                      : "rounded-2xl border-2 border-app-primary/40 bg-app-surface-2/25 p-4 shadow-lg ring-1 ring-app-primary/25"
                    : ""
                }`
          }
        >
          {editorForm}
        </div>
        ) : null}
      </div>
    </div>

    {skuDeleteConfirmOpen ? (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
        role="presentation"
        onClick={closeSkuDeleteConfirm}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="sku-del-title"
          className="w-full max-w-md rounded-xl border border-app-line-strong bg-app-surface p-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="sku-del-title" className="text-sm font-semibold text-app-text">
            {t("rel.confirmDeleteSkuTitle")}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-app-muted">{t("rel.confirmDeleteSku")}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeSkuDeleteConfirm}
              className="rounded-lg border border-app-line-strong px-3 py-2 text-xs font-medium text-app-muted hover:bg-app-surface-2"
            >
              {t("rel.modalCancel")}
            </button>
            <button
              type="button"
              onClick={performSkuDelete}
              className="rounded-lg border border-app-danger-border bg-app-danger-bg/40 px-3 py-2 text-xs font-semibold text-app-danger-text hover:bg-app-danger-bg"
            >
              {t("rel.btnDelete")}
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
