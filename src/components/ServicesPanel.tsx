import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildServiceCatRows,
  erpCatalogRowMatchesQuery,
  filterServiceItemsByCatalogNav,
  resolveServiceCategoryForNav,
  serviceItemMatchesErpCatalogSearch,
} from "../utils/erpCatalogCategories";
import { SERVICE_CATEGORY_PRESETS, normalizeServiceCategoryStored } from "../constants/serviceCategoryPresets";
import { ErpCatalogQtyInput } from "./erp/ErpCatalogQtyInput";
import { useT } from "../i18n/useT";
import { StringCatalogCategoryField } from "./StringCatalogCategoryField";
import { useQuoteStore } from "../store/quoteStore";
import type { HardwareAddon, ServiceRow } from "../types";

function emptyService(): ServiceRow {
  return {
    id: crypto.randomUUID(),
    serviceCategory: SERVICE_CATEGORY_PRESETS[0] ?? "Consulting",
    serviceName: "",
    unitPrice: null,
    note: "",
    options: [],
    addons: [],
  };
}

function cloneService(r: ServiceRow): ServiceRow {
  return structuredClone(r);
}

export function ServicesPanel({
  erpEditorOnly = false,
  erpListOnly = false,
  hideModuleHeader = false,
  erpStackedCatalog = false,
  erpCompactEditor = false,
}: {
  erpEditorOnly?: boolean;
  erpListOnly?: boolean;
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
  const serviceItems = useQuoteStore((s) => s.serviceItems);
  const upsertServiceItem = useQuoteStore((s) => s.upsertServiceItem);
  const removeServiceItem = useQuoteStore((s) => s.removeServiceItem);
  const setActiveTab = useQuoteStore((s) => s.setActiveTab);

  const [draft, setDraft] = useState<ServiceRow>(() => emptyService());
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const undoBaselineRef = useRef<ServiceRow | null>(null);

  const pushUndoBaseline = (row: ServiceRow) => {
    undoBaselineRef.current = cloneService(row);
  };

  const showList = !erpEditorOnly;
  const showEditor = !erpListOnly;

  const loadIntoEditor = (r: ServiceRow) => {
    const c = cloneService(r);
    setDraft(c);
    pushUndoBaseline(c);
    setSelectedRowId(r.id);
    if (hideModuleHeader) {
      const cur = useQuoteStore.getState().erpCatalogSelection;
      const sameServiceSel = cur?.kind === "service" && cur.id === r.id;
      if (!sameServiceSel) {
        setErpCatalogSelection({ kind: "service", id: r.id });
      }
    }
  };

  const onSelectRow = (r: ServiceRow) => {
    if (erpListOnly) {
      setErpCatalogSelection({ kind: "service", id: r.id });
      return;
    }
    loadIntoEditor(r);
  };

  useEffect(() => {
    if (!erpEditorOnly) return;
    if (erpCatalogSelection?.kind === "service") {
      const r = useQuoteStore.getState().serviceItems.find((s) => s.id === erpCatalogSelection.id);
      if (r) loadIntoEditor(r);
    }
  }, [erpEditorOnly, erpCatalogSelection, serviceItems]);

  useEffect(() => {
    if (!erpEditorOnly || !hideModuleHeader) return;
    if (erpCatalogActiveKind !== "service") return;
    if (erpCatalogSelection?.kind === "service") return;
    const { primary, filterKey } = erpCatalogSel.service;
    if (primary == null && filterKey == null) return;

    const category = resolveServiceCategoryForNav(primary, filterKey);
    const base = emptyService();
    base.serviceCategory = category;
    setDraft(base);
    pushUndoBaseline(cloneService(base));
    setSelectedRowId(null);
  }, [
    erpEditorOnly,
    hideModuleHeader,
    erpCatalogActiveKind,
    erpCatalogSelection,
    erpCatalogSel.service,
  ]);

  const startNew = () => {
    let i = serviceItems.length + 1;
    let serviceName = `${t("sv.newService")} ${i}`;
    while (serviceItems.some((s) => s.serviceName === serviceName)) {
      i += 1;
      serviceName = `${t("sv.newService")} ${i}`;
    }
    const row: ServiceRow = { ...emptyService(), serviceName };
    upsertServiceItem(row);
    const persisted = useQuoteStore.getState().serviceItems.find((s) => s.id === row.id);
    loadIntoEditor(persisted ?? row);
  };

  useEffect(() => {
    pushUndoBaseline(cloneService(draft));
  }, []);

  const isDirty = useMemo(() => {
    const b = undoBaselineRef.current;
    if (!b) return false;
    const pick = (s: ServiceRow) =>
      JSON.stringify({
        serviceCategory: normalizeServiceCategoryStored(s.serviceCategory).trim(),
        serviceName: s.serviceName.trim(),
        unitPrice: s.unitPrice,
        note: s.note,
        options: s.options
          .filter((o) => o.label.trim())
          .map((o) => ({ label: o.label.trim(), optionPrice: o.optionPrice })),
        addons: s.addons
          .filter((a) => a.label.trim())
          .map((a) => ({ label: a.label.trim(), price: a.price })),
      });
    return pick(draft) !== pick(b);
  }, [draft]);

  const isPersisted = serviceItems.some((s) => s.id === draft.id);

  const serviceItemsForList = useMemo(() => {
    if (!erpListOnly) return serviceItems;
    const { primary, filterKey } = erpCatalogSel.service;
    let list = filterServiceItemsByCatalogNav(serviceItems, primary, filterKey);
    const q = erpCatalogSearchQuery.trim();
    if (!q) return list;
    return list.filter((s) => {
      if (serviceItemMatchesErpCatalogSearch(s, q)) return true;
      const rows = buildServiceCatRows([s]);
      return rows.some((r) => erpCatalogRowMatchesQuery(r, q));
    });
  }, [erpListOnly, serviceItems, erpCatalogSel.service, erpCatalogSearchQuery]);

  const specsLockBase = draft.options.length > 0;

  const commitDraft = () => {
    if (!draft.serviceName.trim()) return;
    const saved: ServiceRow = {
      ...draft,
      serviceCategory: normalizeServiceCategoryStored(draft.serviceCategory).trim(),
      serviceName: draft.serviceName.trim(),
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
    };
    upsertServiceItem(saved);
    const persisted = useQuoteStore.getState().serviceItems.find((s) => s.id === saved.id);
    const canon = persisted ?? saved;
    const next = cloneService(canon);
    setDraft(next);
    pushUndoBaseline(next);
    setSelectedRowId(next.id);
  };

  const undoEdit = () => {
    const b = undoBaselineRef.current;
    if (!b) return;
    setDraft(cloneService(b));
  };

  const duplicateCurrent = () => {
    const base: ServiceRow = {
      ...draft,
      serviceName: (draft.serviceName.trim() || t("sv.unnamed")) + t("sv.copySuffix"),
      id: crypto.randomUUID(),
      options: draft.options.map((o) => ({ ...o, id: crypto.randomUUID() })),
      addons: draft.addons.map((a) => ({ ...a, id: crypto.randomUUID() })),
    };
    upsertServiceItem(base);
    const persisted = useQuoteStore.getState().serviceItems.find((s) => s.id === base.id);
    loadIntoEditor(persisted ?? base);
  };

  const deleteCurrent = () => {
    if (!isPersisted) {
      startNew();
      return;
    }
    removeServiceItem(draft.id);
    startNew();
  };

  const tryStartNew = () => {
    if (!isDirty) {
      startNew();
      return;
    }
    if (window.confirm(t("sv.unsavedConfirm"))) {
      undoEdit();
      startNew();
    }
  };

  const serviceCategoryCatalogStrings = useMemo(
    () => [...serviceItems.map((s) => s.serviceCategory), draft.serviceCategory],
    [serviceItems, draft.serviceCategory],
  );

  const formatServiceCategory = useCallback(
    (canonical: string) => {
      const slug = canonical.toLowerCase();
      const key = `sv.preset.${slug}`;
      const localized = t(key);
      if (localized !== key) return localized;
      return canonical;
    },
    [t],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!hideModuleHeader ? (
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-app-line-subtle px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-app-text">{t("sv.title")}</h2>
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
                    <th className="px-3 py-2">{t("sv.colCategory")}</th>
                    <th className="px-3 py-2">{t("sv.colName")}</th>
                    <th className="px-3 py-2">{t("sv.colPrice")}</th>
                    {erpListOnly ? <th className="px-2 py-2 text-right">{t("erp.colStock")}</th> : null}
                    <th className="px-3 py-2">{t("sv.colDescription")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-line-subtle">
                  {serviceItemsForList.length === 0 ? (
                    <tr>
                      <td colSpan={erpListOnly ? 5 : 4} className="px-3 py-8 text-center text-xs text-app-muted">
                        {t("sv.empty")}
                      </td>
                    </tr>
                  ) : (
                    serviceItemsForList.map((r) => {
                      const listPick = erpListOnly && erpCatalogSelection?.kind === "service" ? erpCatalogSelection.id : selectedRowId;
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
                          <td className="px-3 py-2 text-app-muted">{(r.serviceCategory ?? "").trim() || "—"}</td>
                          <td className="px-3 py-2 font-medium text-app-text">{r.serviceName || "—"}</td>
                          <td className="px-3 py-2 text-app-muted">
                            {typeof r.unitPrice === "number" && Number.isFinite(r.unitPrice) ? `¥${r.unitPrice}` : "—"}
                          </td>
                          {erpListOnly ? (
                            <td className="px-2 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                              <ErpCatalogQtyInput kind="service" catalogRefId={r.id} />
                            </td>
                          ) : null}
                          <td className="max-w-[220px] truncate px-3 py-2 text-xs text-app-muted" title={r.note}>
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
              ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border-2 border-app-primary/35 bg-app-panel-bg shadow-[0_12px_48px_rgba(0,0,0,0.28)] ring-1 ring-app-primary/20 min-h-[min(52vh,640px)]"
              : `flex min-h-0 min-w-0 flex-[3] flex-col overflow-hidden border-t border-app-line-subtle bg-app-panel-bg lg:border-t-0 ${
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
                <div className="text-xs font-medium uppercase tracking-wide text-app-muted">{t("sv.editor")}</div>
                <div className="mt-0.5 truncate text-xs text-app-muted">{draft.serviceName || t("sv.newRow")}</div>
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
              {t("sv.labelService")}
              <input
                value={draft.serviceName}
                onChange={(e) => setDraft({ ...draft, serviceName: e.target.value })}
                className="rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm text-app-text"
              />
            </label>

            <StringCatalogCategoryField
              label={t("sv.category")}
              value={draft.serviceCategory}
              onChange={(next) => setDraft({ ...draft, serviceCategory: next })}
              presets={SERVICE_CATEGORY_PRESETS}
              catalogStrings={serviceCategoryCatalogStrings}
              normalize={normalizeServiceCategoryStored}
              formatOption={formatServiceCategory}
              hint={erpEditorOnly && erpCompactEditor ? undefined : t("sv.categoryHint")}
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
                {t("sv.unitPrice")}
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

            <div className="flex flex-col gap-1.5 rounded-lg border border-app-line-subtle bg-app-surface-2/40 p-1.5">
              <div className="text-xs font-medium text-app-muted">{t("sv.specs")}</div>
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
                      placeholder={t("sv.placeholderLabel")}
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
                      {t("sv.remove")}
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
                {t("sv.addSpec")}
              </button>
            </div>

            <div className="flex flex-col gap-1.5 rounded-lg border border-app-line-subtle bg-app-surface-2/40 p-1.5">
              <div className="text-xs font-medium text-app-muted">Add-on</div>
              <div className="space-y-1">
                {draft.addons.map((o: HardwareAddon) => (
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
                      {t("sv.remove")}
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
                {t("sv.addAddon")}
              </button>
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
                {t("sv.save")}
              </button>
              <button
                type="button"
                onClick={undoEdit}
                className="rounded-lg border-2 border-app-line-strong bg-app-surface px-3 py-2 text-xs font-semibold text-app-text shadow-sm hover:bg-app-surface-2"
              >
                {t("sv.revert")}
              </button>
              <button
                type="button"
                onClick={tryStartNew}
                className="rounded-lg border-2 border-app-line-strong bg-app-surface px-3 py-2 text-xs font-semibold text-app-text shadow-sm hover:bg-app-surface-2"
              >
                {t("sv.new")}
              </button>
              <button
                type="button"
                onClick={duplicateCurrent}
                disabled={!draft.serviceName.trim()}
                className="rounded-lg border-2 border-app-line-strong bg-app-surface px-3 py-2 text-xs font-semibold text-app-text shadow-sm hover:bg-app-surface-2 disabled:opacity-40"
              >
                {t("sv.duplicate")}
              </button>
              <button
                type="button"
                onClick={deleteCurrent}
                className="rounded-lg border-2 border-app-danger-border bg-app-danger-bg/35 px-3 py-2 text-xs font-semibold text-app-danger-text shadow-sm hover:bg-app-danger-bg"
              >
                {t("sv.delete")}
              </button>
            </div>
          </div>
        </div>
        ) : null}
      </div>
    </div>
  );
}
