import { useMemo, useState } from "react";
import { SERVICE_CATEGORY_PRESETS, normalizeServiceCategoryStored } from "../constants/serviceCategoryPresets";
import { CustomPlanBasketLine } from "./CustomPlanBasketLine";
import { CustomPlanLineSpecsModal } from "./CustomPlanLineSpecsModal";
import { useT } from "../i18n/useT";
import { useQuoteStore } from "../store/quoteStore";
import type { CustomPlanServiceLine, ServiceRow } from "../types";
import { mergeAddonQtyMap } from "../utils/customPlanAddonQty";
import {
  catalogLineNeedsSpecConfigDialog,
  serviceLineSpecOptionPart,
  serviceLineSpecSummaryText,
} from "../utils/customPlanLineSpecSummary";
import { servicePickLineTotal, servicePickLineUnitPrice } from "../utils/customPlanPickTotals";

const ALL = "all";
const EMPTY = "__empty__";

function serviceCategoryForFilter(s: ServiceRow): string {
  const raw = (s.serviceCategory ?? "").trim();
  if (!raw) return EMPTY;
  return normalizeServiceCategoryStored(raw);
}

function servicePresetTabLabel(t: (k: string) => string, preset: string): string {
  const slug = preset.toLowerCase();
  const key = `sv.preset.${slug}` as const;
  const x = t(key);
  return x !== key ? x : preset;
}

export function CustomPlanServicesStep() {
  const t = useT();
  const serviceItems = useQuoteStore((s) => s.serviceItems);
  const lines = useQuoteStore((s) => s.customPlanServiceLines);
  const addLine = useQuoteStore((s) => s.addCustomPlanServiceLine);
  const patchLine = useQuoteStore((s) => s.patchCustomPlanServiceLine);
  const removeLine = useQuoteStore((s) => s.removeCustomPlanServiceLine);
  const reorderLines = useQuoteStore((s) => s.reorderCustomPlanServiceLines);
  const [cat, setCat] = useState<string>(ALL);
  const [q, setQ] = useState("");
  const [specDialogLineId, setSpecDialogLineId] = useState<string | null>(null);

  const svcById = useMemo(() => new Map(serviceItems.map((x) => [x.id, x])), [serviceItems]);

  const catTabs = useMemo(() => {
    const presetSet = new Set<string>(SERVICE_CATEGORY_PRESETS);
    const extras = new Set<string>();
    for (const s of serviceItems) {
      const k = serviceCategoryForFilter(s);
      if (k !== EMPTY && !presetSet.has(k)) extras.add(k);
    }
    const tabs: { id: string; label: string }[] = [{ id: ALL, label: t("cps.all") }];
    if (serviceItems.some((s) => serviceCategoryForFilter(s) === EMPTY)) {
      tabs.push({ id: EMPTY, label: t("cps.uncat") });
    }
    for (const p of SERVICE_CATEGORY_PRESETS) {
      tabs.push({ id: p, label: servicePresetTabLabel(t, p) });
    }
    for (const k of [...extras].sort((a, b) => a.localeCompare(b))) {
      tabs.push({ id: k, label: k });
    }
    return tabs;
  }, [serviceItems, t]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return serviceItems.filter((s) => {
      if (cat !== ALL) {
        const sk = serviceCategoryForFilter(s);
        if (sk !== cat) return false;
      }
      if (!needle) return true;
      const blob = `${s.serviceName} ${s.serviceCategory}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [serviceItems, cat, q]);

  const pick = (s: ServiceRow) => {
    const prevLen = useQuoteStore.getState().customPlanServiceLines.length;
    addLine({ catalogServiceId: s.id, quantity: 1, optionId: null, addonIds: [] });
    const nextLines = useQuoteStore.getState().customPlanServiceLines;
    const newLine =
      nextLines.length > prevLen ? nextLines[nextLines.length - 1] : undefined;
    if (
      newLine &&
      newLine.catalogServiceId === s.id &&
      catalogLineNeedsSpecConfigDialog(s.options, s.addons.length)
    ) {
      setSpecDialogLineId(newLine.id);
    }
  };

  const renderCartLine = (line: CustomPlanServiceLine) => {
    const s = svcById.get(line.catalogServiceId);
    if (!s) return null;
    const sub = servicePickLineTotal(s, line);
    const unit = servicePickLineUnitPrice(s, line);
    const needSpecDialog = catalogLineNeedsSpecConfigDialog(s.options, s.addons.length);
    const qtyMap = mergeAddonQtyMap(line);
    const summaryForSpecs =
      s.addons.length > 0 ? serviceLineSpecOptionPart(s, line) : serviceLineSpecSummaryText(s, line);
    const addonRows =
      s.addons.length > 0
        ? s.addons.map((ad) => ({
            id: ad.id,
            label: ad.label,
            unitPrice: ad.price,
            quantity: qtyMap[ad.id] ?? 0,
            onQuantityChange: (n: number) => {
              const q = Math.max(0, Math.floor(n));
              const base = mergeAddonQtyMap(line);
              const next: Record<string, number> = { ...base };
              if (q <= 0) delete next[ad.id];
              else next[ad.id] = q;
              patchLine(line.id, { addonQtyById: next });
            },
          }))
        : undefined;

    return (
      <CustomPlanBasketLine
        key={line.id}
        lineId={line.id}
        title={s.serviceName}
        note={s.note}
        unitPrice={unit}
        quantity={line.quantity}
        lineTotal={sub}
        onQuantityChange={(n) => patchLine(line.id, { quantity: n })}
        onRemove={() => removeLine(line.id)}
        onReorder={reorderLines}
        specsSummary={summaryForSpecs}
        specsConfigurable={needSpecDialog}
        onConfigureSpecs={needSpecDialog ? () => setSpecDialogLineId(line.id) : undefined}
        addonRows={addonRows}
      />
    );
  };

  const specDlgLine = specDialogLineId ? lines.find((l) => l.id === specDialogLineId) ?? null : null;
  const specDlgSvc = specDlgLine ? svcById.get(specDlgLine.catalogServiceId) ?? null : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-app-line-subtle px-4 py-2">
        <h2 className="text-sm font-semibold text-app-text">{t("sv.title")}</h2>
        <button
          type="button"
          onClick={() => {
            useQuoteStore.getState().openErpInventoryCatalog("service");
          }}
          className="rounded-lg border border-app-line-strong px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface-2"
        >
          {t("cp.toEnterprise")}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-app-line-subtle lg:max-w-[min(560px,55%)] lg:flex-row lg:border-r">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-app-line-subtle p-2 lg:w-36 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:border-app-line-subtle">
            {catTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCat(tab.id)}
                className={`whitespace-nowrap rounded px-2 py-1.5 text-left text-xs font-medium lg:w-full ${
                  cat === tab.id ? "bg-app-primary text-app-on-primary" : "text-app-muted hover:bg-app-surface-2/80"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("cps.searchPh")}
              className="shrink-0 rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm"
            />
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-xl border border-app-line-subtle p-1">
              {filtered.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-app-muted">{t("sv.empty")}</p>
              ) : (
                filtered.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pick(s)}
                    className="flex w-full flex-col gap-0.5 rounded-lg border border-transparent px-2 py-2 text-left text-xs transition hover:border-app-line-mid hover:bg-app-surface-2/60"
                  >
                    <span className="truncate font-medium text-app-text">{s.serviceName || "—"}</span>
                    <span className="truncate text-app-muted">
                      {(s.serviceCategory ?? "").trim() || t("cps.uncat")} ·{" "}
                      {typeof s.unitPrice === "number" && Number.isFinite(s.unitPrice) ? `¥${s.unitPrice}` : "—"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto border-t border-app-line-subtle bg-app-panel-bg p-2 lg:border-t-0 lg:p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-app-muted">{t("cps.basket")}</div>
          <div className="mt-1.5 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
            {lines.length === 0 ? (
              <p className="text-xs text-app-subtle">{t("cps.basketEmpty")}</p>
            ) : (
              lines.map((line) => renderCartLine(line))
            )}
          </div>
        </div>
      </div>

      {specDlgSvc && specDlgLine ? (
        <CustomPlanLineSpecsModal
          open
          title={specDlgSvc.serviceName}
          options={specDlgSvc.options}
          selectedOptionId={specDlgLine.optionId}
          onPickOption={(id) => patchLine(specDlgLine.id, { optionId: id })}
          addons={specDlgSvc.addons}
          addonQtyById={mergeAddonQtyMap(specDlgLine)}
          onAddonQtyChange={(addonId, qty) => {
            const q = Math.max(0, Math.floor(qty));
            const base = mergeAddonQtyMap(specDlgLine);
            const next: Record<string, number> = { ...base };
            if (q <= 0) delete next[addonId];
            else next[addonId] = q;
            patchLine(specDlgLine.id, { addonQtyById: next });
          }}
          onClose={() => setSpecDialogLineId(null)}
        />
      ) : null}
    </div>
  );
}
