import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildSoftwareCatRows,
  erpCatalogRowMatchesQuery,
  filterSoftwareFeaturesByCatalogNav,
  resolveSoftwareCategoryForNav,
  softwareFeatureMatchesErpCatalogSearch,
} from "../utils/erpCatalogCategories";
import {
  SOFTWARE_FEATURE_CATEGORY_PRESETS,
  normalizeSoftwareFeatureCategoryStored,
} from "../constants/softwareFeatureCategories";
import { ErpCatalogQtyInput } from "./erp/ErpCatalogQtyInput";
import { useT } from "../i18n/useT";
import { useQuoteStore } from "../store/quoteStore";
import type { MaterialPage, SoftwareFeatureRow } from "../types";
import { softwareBillingMode } from "../utils/softwareBilling";
import { splitFileToMaterialPages } from "../utils/pdfPages";
import { softwareFeatureMaterialCategory } from "../utils/softwareFeatureCategory";
import { StringCatalogCategoryField } from "./StringCatalogCategoryField";
import { PhotoUploadModal } from "./PhotoUploadModal";

function emptyFeature(): SoftwareFeatureRow {
  return {
    id: crypto.randomUUID(),
    featureCategory: "Sales",
    featureName: "",
    unitPrice: null,
    softwarePriceBilling: "one_time",
    docMaterialIds: [null, null, null],
    note: "",
    options: [],
    addons: [],
  };
}

function cloneFeature(r: SoftwareFeatureRow): SoftwareFeatureRow {
  return structuredClone(r);
}

type DocSlotProps = {
  label: string;
  slotIndex: 0 | 1 | 2;
  material: MaterialPage | null;
  categoryForUpload: string;
  onBind: (slot: 0 | 1 | 2, id: string | null) => void;
  onErr: (msg: string | null) => void;
  errImageOnly: string;
  errUpload: string;
};

function SoftwareDocSlot({
  label,
  slotIndex,
  material,
  categoryForUpload,
  onBind,
  onErr,
  errImageOnly,
  errUpload,
}: DocSlotProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addMaterials = useQuoteStore((s) => s.addMaterials);
  const t = useT();

  const tryIngest = async (f: File | undefined | null, opts: { throwOnError: boolean }) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      onErr(errImageOnly);
      if (opts.throwOnError) throw new Error(errImageOnly);
      return;
    }
    onErr(null);
    try {
      const cat = categoryForUpload.trim() || "Untitled";
      const mats = useQuoteStore.getState().materials;
      const startSerial = mats.filter((m) => m.imageKind === "softwareDoc").length + 1;
      const pages = await splitFileToMaterialPages(f, cat, "softwareDoc", startSerial);
      addMaterials(pages);
      const first = pages[0];
      if (first) onBind(slotIndex, first.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : errUpload;
      onErr(msg);
      if (opts.throwOnError) throw e instanceof Error ? e : new Error(msg);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-xs font-medium text-app-muted">{label}</span>
        {material ? (
          <button type="button" className="shrink-0 text-xs text-app-danger-text/90 hover:underline" onClick={() => onBind(slotIndex, null)}>
            {t("sw.clear")}
          </button>
        ) : null}
      </div>
      <PhotoUploadModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t("photo.modalTitle", { label })}
        accept="image/jpeg,image/png,image/webp"
        onConfirmFiles={(files) => tryIngest(files[0], { throwOnError: true })}
      />
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className={`relative flex aspect-[4/3] w-full cursor-pointer flex-col overflow-hidden rounded-lg border-2 bg-app-surface-2 transition ${
          material ? "border-app-success-border ring-1 ring-app-success-ring" : "border-dashed border-app-line-mid hover:border-app-line-strong"
        }`}
      >
        {material ? (
          <img src={material.dataUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="m-auto text-xs text-app-subtle">{t("sw.clickUpload")}</span>
        )}
      </button>
    </div>
  );
}

export function SoftwareLibraryPanel({
  erpEditorOnly = false,
  erpListOnly = false,
  erpFeatureId = null,
  hideModuleHeader = false,
  erpStackedCatalog = false,
  erpCompactEditor = false,
}: {
  erpEditorOnly?: boolean;
  erpListOnly?: boolean;
  erpFeatureId?: string | null;
  /** ERP 产品目录外层已有分区标题与导航时隐藏本面板顶栏，避免重复 */
  hideModuleHeader?: boolean;
  erpStackedCatalog?: boolean;
  erpCompactEditor?: boolean;
} = {}) {
  const t = useT();
  const erpCatalogSelection = useQuoteStore((s) => s.erpCatalogSelection);
  const erpCatalogActiveKind = useQuoteStore((s) => s.erpCatalogActiveKind);
  const erpCatalogSel = useQuoteStore((s) => s.erpCatalogSel);
  const erpCatalogSearchQuery = useQuoteStore((s) => s.erpCatalogSearchQuery);
  const setErpCatalogSelection = useQuoteStore((s) => s.setErpCatalogSelection);
  const materials = useQuoteStore((s) => s.materials);
  const softwareFeatures = useQuoteStore((s) => s.softwareFeatures);
  const upsertSoftwareFeature = useQuoteStore((s) => s.upsertSoftwareFeature);
  const removeSoftwareFeature = useQuoteStore((s) => s.removeSoftwareFeature);
  const setActiveTab = useQuoteStore((s) => s.setActiveTab);

  const [draft, setDraft] = useState<SoftwareFeatureRow>(() => emptyFeature());
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [slotErr, setSlotErr] = useState<string | null>(null);
  const undoBaselineRef = useRef<SoftwareFeatureRow | null>(null);

  const pushUndoBaseline = (row: SoftwareFeatureRow) => {
    undoBaselineRef.current = cloneFeature(row);
  };

  const showList = !erpEditorOnly;
  const showEditor = !erpListOnly;

  const loadIntoEditor = (r: SoftwareFeatureRow) => {
    const c = cloneFeature(r);
    setDraft(c);
    pushUndoBaseline(c);
    setSelectedRowId(r.id);
    setSlotErr(null);
    if (hideModuleHeader) {
      const cur = useQuoteStore.getState().erpCatalogSelection;
      const sameSoftwareSel = cur?.kind === "software" && cur.id === r.id;
      if (!sameSoftwareSel) {
        setErpCatalogSelection({ kind: "software", id: r.id });
      }
    }
  };

  const onSelectRow = (r: SoftwareFeatureRow) => {
    if (erpListOnly) {
      setErpCatalogSelection({ kind: "software", id: r.id });
      return;
    }
    loadIntoEditor(r);
  };

  useEffect(() => {
    if (!erpEditorOnly) return;
    if (erpCatalogSelection?.kind === "software") {
      const r = useQuoteStore.getState().softwareFeatures.find((f) => f.id === erpCatalogSelection.id);
      if (r) loadIntoEditor(r);
      return;
    }
    if (!erpFeatureId) return;
    const r = useQuoteStore.getState().softwareFeatures.find((f) => f.id === erpFeatureId);
    if (r) loadIntoEditor(r);
  }, [erpEditorOnly, erpCatalogSelection, erpFeatureId, softwareFeatures]);

  useEffect(() => {
    if (!erpEditorOnly || !hideModuleHeader) return;
    if (erpCatalogActiveKind !== "software") return;
    if (erpCatalogSelection?.kind === "software") return;
    const { primary, filterKey } = erpCatalogSel.software;
    if (primary == null && filterKey == null) return;

    const category = resolveSoftwareCategoryForNav(primary, filterKey);
    const base = emptyFeature();
    base.featureCategory = category;
    setDraft(base);
    pushUndoBaseline(cloneFeature(base));
    setSelectedRowId(null);
    setSlotErr(null);
  }, [
    erpEditorOnly,
    hideModuleHeader,
    erpCatalogActiveKind,
    erpCatalogSelection,
    erpCatalogSel.software,
  ]);

  const startNew = () => {
    let i = softwareFeatures.length + 1;
    let featureName = `${t("sw.newFeature")} ${i}`;
    while (softwareFeatures.some((f) => f.featureName === featureName)) {
      i += 1;
      featureName = `${t("sw.newFeature")} ${i}`;
    }
    const row: SoftwareFeatureRow = { ...emptyFeature(), featureName };
    upsertSoftwareFeature(row);
    const persisted = useQuoteStore.getState().softwareFeatures.find((f) => f.id === row.id);
    loadIntoEditor(persisted ?? row);
  };

  useEffect(() => {
    pushUndoBaseline(cloneFeature(draft));
  }, []);

  const isDirty = useMemo(() => {
    const b = undoBaselineRef.current;
    if (!b) return false;
    const pick = (f: SoftwareFeatureRow) =>
      JSON.stringify({
        featureCategory: normalizeSoftwareFeatureCategoryStored(f.featureCategory),
        featureName: f.featureName.trim(),
        unitPrice: f.unitPrice,
        note: f.note,
        docMaterialIds: f.docMaterialIds,
        options: f.options
          .filter((o) => o.label.trim())
          .map((o) => ({ label: o.label.trim(), optionPrice: o.optionPrice })),
        addons: f.addons
          .filter((a) => a.label.trim())
          .map((a) => ({ label: a.label.trim(), price: a.price })),
      });
    return pick(draft) !== pick(b);
  }, [draft]);

  const matById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const softwareFeaturesForList = useMemo(() => {
    if (!erpListOnly) return softwareFeatures;
    const { primary, filterKey } = erpCatalogSel.software;
    let list = filterSoftwareFeaturesByCatalogNav(softwareFeatures, primary, filterKey);
    const q = erpCatalogSearchQuery.trim();
    if (!q) return list;
    return list.filter((f) => {
      if (softwareFeatureMatchesErpCatalogSearch(f, q, matById)) return true;
      const rows = buildSoftwareCatRows([f]);
      return rows.some((r) => erpCatalogRowMatchesQuery(r, q));
    });
  }, [erpListOnly, softwareFeatures, erpCatalogSel.software, erpCatalogSearchQuery, matById]);

  const isPersisted = softwareFeatures.some((f) => f.id === draft.id);

  const uploadCategory = softwareFeatureMaterialCategory(draft);
  const specsLockBase = draft.options.length > 0;

  const setDocSlot = useCallback((slot: 0 | 1 | 2, id: string | null) => {
    setDraft((d) => {
      const next: [string | null, string | null, string | null] = [...d.docMaterialIds] as typeof d.docMaterialIds;
      next[slot] = id;
      return { ...d, docMaterialIds: next };
    });
  }, []);

  const commitDraft = () => {
    if (!draft.featureName.trim()) return;
    const saved: SoftwareFeatureRow = {
      ...draft,
      featureCategory: normalizeSoftwareFeatureCategoryStored(draft.featureCategory),
      featureName: draft.featureName.trim(),
      unitPrice:
        draft.unitPrice !== null &&
        draft.unitPrice !== undefined &&
        Number.isFinite(draft.unitPrice) &&
        draft.unitPrice >= 0
          ? draft.unitPrice
          : null,
      note: draft.note,
      options: draft.options
        .filter((o) => o.label.trim())
        .map((o) => ({ ...o, id: o.id, label: o.label.trim(), optionPrice: o.optionPrice })),
      addons: draft.addons
        .filter((a) => a.label.trim())
        .map((a) => ({ ...a, id: a.id, label: a.label.trim(), price: Math.max(0, a.price) })),
      softwarePriceBilling: draft.softwarePriceBilling ?? "one_time",
    };
    upsertSoftwareFeature(saved);
    const persisted = useQuoteStore.getState().softwareFeatures.find((f) => f.id === saved.id);
    const canon = persisted ?? saved;
    const next = cloneFeature(canon);
    setDraft(next);
    pushUndoBaseline(next);
    setSelectedRowId(next.id);
  };

  const undoEdit = () => {
    const b = undoBaselineRef.current;
    if (!b) return;
    setDraft(cloneFeature(b));
  };

  const duplicateCurrent = () => {
    const base: SoftwareFeatureRow = {
      ...draft,
      featureName: (draft.featureName.trim() || t("sw.untitled")) + t("sw.copySuffix"),
      id: crypto.randomUUID(),
      options: draft.options.map((o) => ({ ...o, id: crypto.randomUUID() })),
      addons: draft.addons.map((a) => ({ ...a, id: crypto.randomUUID() })),
    };
    upsertSoftwareFeature(base);
    const persisted = useQuoteStore.getState().softwareFeatures.find((f) => f.id === base.id);
    loadIntoEditor(persisted ?? base);
  };

  const deleteCurrent = () => {
    if (!isPersisted) {
      startNew();
      return;
    }
    removeSoftwareFeature(draft.id);
    startNew();
  };

  const docCount = draft.docMaterialIds.filter(Boolean).length;

  const tryStartNew = () => {
    if (!isDirty) {
      startNew();
      return;
    }
    if (window.confirm(t("sw.unsavedConfirm"))) {
      undoEdit();
      startNew();
    }
  };

  const slotLabels = [t("sw.slot1"), t("sw.slot2"), t("sw.slot3")] as const;

  const softwareCategoryCatalogStrings = useMemo(
    () => [...softwareFeatures.map((f) => f.featureCategory), draft.featureCategory],
    [softwareFeatures, draft.featureCategory],
  );

  const formatSoftwareCategory = useCallback(
    (canonical: string) => {
      const slug = canonical.toLowerCase();
      const key = `sw.preset.${slug}`;
      const localized = t(key);
      if (localized !== key) return localized;
      return canonical;
    },
    [t],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!erpEditorOnly && !hideModuleHeader ? (
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-app-line-subtle px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-app-text">{t("sw.title")}</h2>
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
            {t("cp.select")}
          </button>
        </div>
      ) : null}

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
          showList && showEditor
            ? erpStackedCatalog
              ? "gap-4 lg:flex-row"
              : "lg:flex-row"
            : ""
        } ${erpStackedCatalog && showList && showEditor ? "gap-3" : ""}`}
      >
        {showList ? (
          <div
            className={`flex min-h-0 min-w-0 flex-col overflow-hidden border-app-line-subtle ${
              erpListOnly
                ? "min-h-0 flex-1 rounded-xl border bg-app-surface-2/15 p-2 sm:p-3"
                : erpStackedCatalog
                ? "shrink-0 rounded-xl border bg-app-surface-2/15 p-3 shadow-sm"
                : "flex-[7] lg:border-r"
            }`}
          >
          <div
              className={
                erpListOnly
                  ? "min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-0"
                  : erpStackedCatalog
                  ? "min-h-0 max-h-[min(50vh,520px)] flex-1 overflow-y-auto overflow-x-hidden p-0"
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
                    <th className="px-3 py-2">{t("sw.colCategory")}</th>
                    <th className="px-3 py-2">{t("sw.colName")}</th>
                    <th className="px-3 py-2">{t("sw.colPrice")}</th>
                    {erpListOnly ? <th className="px-2 py-2 text-right">{t("erp.colStock")}</th> : null}
                    <th className="px-3 py-2">{t("sw.colDocs")}</th>
                    <th className="px-3 py-2">{t("lib.labelDescription")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-line-subtle">
                  {softwareFeaturesForList.length === 0 ? (
                    <tr>
                      <td colSpan={erpListOnly ? 6 : 5} className="px-3 py-8 text-center text-xs text-app-muted">
                        {t("sw.empty")}
                      </td>
                    </tr>
                  ) : (
                    softwareFeaturesForList.map((r) => {
                      const n = r.docMaterialIds.filter(Boolean).length;
                      const bill = softwareBillingMode(r);
                      const listPick = erpListOnly && erpCatalogSelection?.kind === "software" ? erpCatalogSelection.id : selectedRowId;
                      const active = listPick === r.id;
                      return (
                        <tr
                          key={r.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectRow(r)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onSelectRow(r);
                            }
                          }}
                          className={`cursor-pointer transition ${
                            active ? "bg-app-primary-soft ring-1 ring-inset ring-app-primary/40" : "bg-app-surface-2/40 hover:bg-app-surface/80"
                          }`}
                        >
                          <td className="px-3 py-2 text-app-muted">{(r.featureCategory ?? "").trim() || "—"}</td>
                          <td className="px-3 py-2 font-medium text-app-text">{r.featureName || "—"}</td>
                          <td className="px-3 py-2 text-app-muted">
                            <span>
                              {typeof r.unitPrice === "number" && Number.isFinite(r.unitPrice) ? `¥${r.unitPrice}` : "—"}
                            </span>
                            {bill !== "one_time" ? (
                              <span className="ml-1 text-[10px] text-app-tone">
                                {bill === "monthly" ? t("sw.billingTagMo") : t("sw.billingTagYr")}
                              </span>
                            ) : null}
                          </td>
                          {erpListOnly ? (
                            <td className="px-2 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                              <ErpCatalogQtyInput kind="software" catalogRefId={r.id} />
                            </td>
                          ) : null}
                          <td className="px-3 py-2 text-app-muted">{n} / 3</td>
                          <td className="max-w-[200px] truncate px-3 py-2 text-xs text-app-muted" title={r.note}>
                            {r.note || "—"}
                          </td>
                        </tr>
                      );
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
              ? `flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border-2 border-app-primary/35 bg-app-panel-bg shadow-[0_12px_48px_rgba(0,0,0,0.28)] ring-1 ring-app-primary/20 ${
                  erpEditorOnly ? "min-h-0" : "min-h-[min(52vh,640px)]"
                }`
              : `flex min-h-0 min-w-0 flex-col overflow-hidden border-t border-app-line-subtle bg-app-panel-bg lg:border-t-0 ${
                  erpEditorOnly ? "flex-1" : "flex-[3]"
                } ${
                  erpEditorOnly && hideModuleHeader
                    ? erpCompactEditor
                      ? "rounded-xl border border-app-line-subtle p-0"
                      : "rounded-2xl border-2 border-app-primary/40 bg-app-surface-2/25 p-0 shadow-lg ring-1 ring-app-primary/25"
                    : ""
                }`
          }
        >
          {erpEditorOnly && erpCompactEditor ? null : (
            <div className="shrink-0 border-b border-app-line-subtle/80 p-3 lg:p-4 lg:pb-3">
              <div className="rounded-lg border border-app-line-subtle bg-app-surface-2/50 p-2">
                <div className="text-xs font-medium uppercase tracking-wide text-app-muted">{t("sw.editor")}</div>
                <div className="mt-0.5 truncate text-xs text-app-muted">{draft.featureName || t("sw.newRow")}</div>
              </div>
            </div>
          )}

          <div
            className={
              erpEditorOnly && erpCompactEditor
                ? "min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"
                : "min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 lg:px-4"
            }
          >
            <div className="flex flex-col gap-3 pb-2">
            <label className="flex flex-col gap-1 text-xs text-app-muted">
              {t("sw.labelAppFeature")}
              <input
                value={draft.featureName}
                onChange={(e) => setDraft({ ...draft, featureName: e.target.value })}
                className="rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm text-app-text"
              />
            </label>

            <StringCatalogCategoryField
              label={t("sw.labelCategory")}
              value={draft.featureCategory}
              onChange={(next) => setDraft({ ...draft, featureCategory: next })}
              presets={SOFTWARE_FEATURE_CATEGORY_PRESETS}
              catalogStrings={softwareCategoryCatalogStrings}
              normalize={normalizeSoftwareFeatureCategoryStored}
              formatOption={formatSoftwareCategory}
              hint={erpEditorOnly && erpCompactEditor ? undefined : t("sw.categoryHint")}
            />

            <label className="flex flex-col gap-1 text-xs text-app-muted">
              {t("lib.labelDescription")}
              <textarea
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                rows={3}
                className="resize-y rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm text-app-text"
              />
            </label>

            <div className="grid gap-1.5 rounded-lg border border-app-line-subtle bg-app-surface-2/40 p-1.5 sm:grid-cols-2">
              <label className="flex flex-col gap-0.5 text-xs text-app-muted">
                {t("sw.labelUnitPrice")}
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  disabled={specsLockBase}
                  title={specsLockBase ? t("lib.basePriceLocked") : undefined}
                  value={draft.unitPrice === null || draft.unitPrice === undefined ? "" : String(draft.unitPrice)}
                  onChange={(e) => {
                    if (specsLockBase) return;
                    const v = e.target.value.trim();
                    if (v === "") setDraft({ ...draft, unitPrice: null });
                    else {
                      const n = parseFloat(v);
                      if (!Number.isNaN(n) && n >= 0) setDraft({ ...draft, unitPrice: n });
                    }
                  }}
                  className="rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm text-app-text disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
              <div className="flex flex-col gap-1 text-xs text-app-muted">
                <span>{t("lib.labelLineTotal")}</span>
                <div className="rounded-lg border border-app-line-mid bg-app-surface-2/80 px-3 py-2 text-sm text-app-text">
                  {typeof draft.unitPrice === "number" && Number.isFinite(draft.unitPrice) ? `¥${draft.unitPrice.toFixed(2)}` : "—"}
                </div>
              </div>
            </div>

            <label className="flex flex-col gap-1 text-xs text-app-muted">
              {t("sw.labelPriceBilling")}
              <select
                className="rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm text-app-text"
                value={draft.softwarePriceBilling ?? "one_time"}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft({
                    ...draft,
                    softwarePriceBilling: v === "monthly" || v === "yearly" ? v : "one_time",
                  });
                }}
              >
                <option value="one_time">{t("sw.billingOneTime")}</option>
                <option value="monthly">{t("sw.billingMonthly")}</option>
                <option value="yearly">{t("sw.billingYearly")}</option>
              </select>
            </label>

            <div className="flex flex-col gap-1.5 rounded-lg border border-app-line-subtle bg-app-surface-2/40 p-1.5">
              <div className="text-xs font-medium text-app-muted">{t("sw.specs")}</div>
              <div className="space-y-1">
                {draft.options.map((o) => (
                  <div key={o.id} className="flex flex-wrap gap-1">
                    <input
                      value={o.label}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          options: d.options.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)),
                        }))
                      }
                      className="min-w-0 flex-1 rounded border border-app-line-strong bg-app-surface-2 px-2 py-1 text-xs"
                      placeholder={t("sw.placeholderLabel")}
                    />
                    <span className="self-center text-[10px] text-app-muted">{t("sw.specCasePrice")}</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={o.optionPrice}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value);
                        setDraft((d) => ({
                          ...d,
                          options: d.options.map((x) =>
                            x.id === o.id ? { ...x, optionPrice: Number.isFinite(n) && n >= 0 ? n : 0 } : x,
                          ),
                        }));
                      }}
                      className="w-[4.5rem] rounded border border-app-line-strong bg-app-surface-2 px-1 py-1 text-xs"
                    />
                    <button
                      type="button"
                      className="text-xs text-app-danger-text/90"
                      onClick={() =>
                        setDraft((d) => ({ ...d, options: d.options.filter((x) => x.id !== o.id) }))
                      }
                    >
                      {t("sw.remove")}
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="text-xs text-app-tone"
                onClick={() =>
                  setDraft((d) => {
                    const seed =
                      typeof d.unitPrice === "number" && Number.isFinite(d.unitPrice) && d.unitPrice >= 0
                        ? d.unitPrice
                        : 0;
                    return {
                      ...d,
                      options: [...d.options, { id: crypto.randomUUID(), label: "", optionPrice: seed }],
                    };
                  })
                }
              >
                {t("sw.addSpec")}
              </button>
            </div>

            <div className="flex flex-col gap-1.5 rounded-lg border border-app-line-subtle bg-app-surface-2/40 p-1.5">
              <div className="text-xs font-medium text-app-muted">Add-on</div>
              <div className="space-y-1">
                {draft.addons.map((o) => (
                  <div key={o.id} className="flex flex-wrap gap-1">
                    <input
                      value={o.label}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          addons: d.addons.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)),
                        }))
                      }
                      className="min-w-0 flex-1 rounded border border-app-line-strong bg-app-surface-2 px-2 py-1 text-xs"
                    />
                    <input
                      type="number"
                      min={0}
                      value={o.price}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value);
                        setDraft((d) => ({
                          ...d,
                          addons: d.addons.map((x) =>
                            x.id === o.id ? { ...x, price: Number.isFinite(n) && n >= 0 ? n : 0 } : x,
                          ),
                        }));
                      }}
                      className="w-20 rounded border border-app-line-strong bg-app-surface-2 px-1 py-1 text-xs"
                    />
                    <button
                      type="button"
                      className="text-xs text-app-danger-text/90"
                      onClick={() =>
                        setDraft((d) => ({ ...d, addons: d.addons.filter((x) => x.id !== o.id) }))
                      }
                    >
                      {t("sw.remove")}
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="text-xs text-app-tone"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    addons: [...d.addons, { id: crypto.randomUUID(), label: "", price: 0 }],
                  }))
                }
              >
                {t("sw.addAddon")}
              </button>
            </div>

            <div className="flex flex-col gap-1">
              {erpEditorOnly && erpCompactEditor ? null : (
                <span className="text-xs text-app-muted">{t("sw.docsHint")}</span>
              )}
              <div className="flex gap-2">
                {([0, 1, 2] as const).map((slotIndex) => {
                  const mid = draft.docMaterialIds[slotIndex];
                  const mat = mid ? (matById.get(mid) ?? null) : null;
                  return (
                    <SoftwareDocSlot
                      key={slotIndex}
                      label={slotLabels[slotIndex]}
                      slotIndex={slotIndex}
                      material={mat}
                      categoryForUpload={uploadCategory}
                      onBind={setDocSlot}
                      onErr={setSlotErr}
                      errImageOnly={t("sw.errImageOnly")}
                      errUpload={t("sw.errUpload")}
                    />
                  );
                })}
              </div>
              <p className="text-xs text-app-subtle">{docCount}/3</p>
              {slotErr ? <div className="text-xs text-app-danger-text">{slotErr}</div> : null}
            </div>
            </div>
          </div>

          <div className="shrink-0 rounded-b-xl bg-app-surface-2/75 px-2 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-3 lg:px-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!isDirty}
                onClick={commitDraft}
                className={`rounded-lg px-3 py-2 text-xs font-semibold shadow-sm ${
                  isDirty
                    ? "bg-app-primary text-app-on-primary ring-1 ring-app-primary/40 hover:bg-app-primary-hover"
                    : "cursor-not-allowed border border-app-line-mid bg-app-surface text-app-muted opacity-55"
                }`}
              >
                {t("sw.save")}
              </button>
              <button
                type="button"
                onClick={undoEdit}
                className="rounded-lg border-2 border-app-line-strong bg-app-surface px-3 py-2 text-xs font-semibold text-app-text shadow-sm hover:bg-app-surface-2"
              >
                {t("sw.revert")}
              </button>
              <button
                type="button"
                onClick={tryStartNew}
                className="rounded-lg border-2 border-app-line-strong bg-app-surface px-3 py-2 text-xs font-semibold text-app-text shadow-sm hover:bg-app-surface-2"
              >
                {t("sw.new")}
              </button>
              <button
                type="button"
                onClick={duplicateCurrent}
                disabled={!draft.featureName.trim()}
                className="rounded-lg border-2 border-app-line-strong bg-app-surface px-3 py-2 text-xs font-semibold text-app-text shadow-sm hover:bg-app-surface-2 disabled:opacity-40"
              >
                {t("sw.duplicate")}
              </button>
              <button
                type="button"
                onClick={deleteCurrent}
                className="rounded-lg border-2 border-app-danger-border bg-app-danger-bg/35 px-3 py-2 text-xs font-semibold text-app-danger-text shadow-sm hover:bg-app-danger-bg"
              >
                {t("sw.delete")}
              </button>
            </div>
          </div>
        </div>
        ) : null}
      </div>
    </div>
  );
}
