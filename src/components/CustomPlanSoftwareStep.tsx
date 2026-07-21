import { useMemo, useState } from "react";
import {
  SOFTWARE_FEATURE_CATEGORY_PRESETS,
  normalizeSoftwareFeatureCategoryStored,
} from "../constants/softwareFeatureCategories";
import { CustomPlanBasketLine } from "./CustomPlanBasketLine";
import { CustomPlanLineSpecsModal } from "./CustomPlanLineSpecsModal";
import { useT } from "../i18n/useT";
import { useQuoteStore } from "../store/quoteStore";
import type { CustomPlanSoftwareLine, SoftwareFeatureRow } from "../types";
import { mergeAddonQtyMap } from "../utils/customPlanAddonQty";
import { softwareBillingMode } from "../utils/softwareBilling";
import {
  catalogLineNeedsSpecConfigDialog,
  softwareLineSpecOptionPart,
  softwareLineSpecSummaryText,
} from "../utils/customPlanLineSpecSummary";
import { softwarePickLineTotal, softwarePickLineUnitPrice } from "../utils/customPlanPickTotals";

const ALL = "all";
const EMPTY = "__empty__";

function softwareCategoryForFilter(f: SoftwareFeatureRow): string {
  const raw = (f.featureCategory ?? "").trim();
  if (!raw) return EMPTY;
  return normalizeSoftwareFeatureCategoryStored(raw);
}

function softwarePresetTabLabel(t: (k: string) => string, preset: string): string {
  const slug = preset.toLowerCase();
  const key = `sw.preset.${slug}` as const;
  const x = t(key);
  return x !== key ? x : preset;
}

export function CustomPlanSoftwareStep() {
  const t = useT();
  const softwareFeatures = useQuoteStore((s) => s.softwareFeatures);
  const lines = useQuoteStore((s) => s.customPlanSoftwareLines);
  const addLine = useQuoteStore((s) => s.addCustomPlanSoftwareLine);
  const patchLine = useQuoteStore((s) => s.patchCustomPlanSoftwareLine);
  const removeLine = useQuoteStore((s) => s.removeCustomPlanSoftwareLine);
  const reorderLines = useQuoteStore((s) => s.reorderCustomPlanSoftwareLines);
  const [cat, setCat] = useState<string>(ALL);
  const [q, setQ] = useState("");
  const [specDialogLineId, setSpecDialogLineId] = useState<string | null>(null);

  const featById = useMemo(() => new Map(softwareFeatures.map((f) => [f.id, f])), [softwareFeatures]);

  const specDlgLine = useMemo(
    () => (specDialogLineId ? lines.find((l) => l.id === specDialogLineId) : undefined),
    [lines, specDialogLineId],
  );
  const specDlgFeat = useMemo(
    () => (specDlgLine ? featById.get(specDlgLine.catalogFeatureId) : undefined),
    [featById, specDlgLine],
  );

  const catTabs = useMemo(() => {
    const presetSet = new Set<string>(SOFTWARE_FEATURE_CATEGORY_PRESETS);
    const extras = new Set<string>();
    for (const f of softwareFeatures) {
      const k = softwareCategoryForFilter(f);
      if (k !== EMPTY && !presetSet.has(k)) extras.add(k);
    }
    const tabs: { id: string; label: string }[] = [{ id: ALL, label: t("cps.all") }];
    if (softwareFeatures.some((f) => softwareCategoryForFilter(f) === EMPTY)) {
      tabs.push({ id: EMPTY, label: t("cps.uncat") });
    }
    for (const p of SOFTWARE_FEATURE_CATEGORY_PRESETS) {
      tabs.push({ id: p, label: softwarePresetTabLabel(t, p) });
    }
    for (const k of [...extras].sort((a, b) => a.localeCompare(b))) {
      tabs.push({ id: k, label: k });
    }
    return tabs;
  }, [softwareFeatures, t]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return softwareFeatures.filter((f) => {
      if (cat !== ALL) {
        const fk = softwareCategoryForFilter(f);
        if (fk !== cat) return false;
      }
      if (!needle) return true;
      const blob = `${f.featureName} ${f.featureCategory}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [softwareFeatures, cat, q]);

  const pick = (f: SoftwareFeatureRow) => {
    const prevLen = useQuoteStore.getState().customPlanSoftwareLines.length;
    addLine({ catalogFeatureId: f.id, quantity: 1, optionId: null, addonIds: [] });
    const nextLines = useQuoteStore.getState().customPlanSoftwareLines;
    const newLine =
      nextLines.length > prevLen ? nextLines[nextLines.length - 1] : undefined;
    if (newLine && newLine.catalogFeatureId === f.id && (f.options.length > 0 || f.addons.length > 0)) {
      setSpecDialogLineId(newLine.id);
    }
  };

  const renderCartLine = (line: CustomPlanSoftwareLine) => {
    const f = featById.get(line.catalogFeatureId);
    if (!f) return null;
    const sub = softwarePickLineTotal(f, line);
    const unit = softwarePickLineUnitPrice(f, line);
    const needSpecDialog = catalogLineNeedsSpecConfigDialog(f.options, f.addons.length);
    const qtyMap = mergeAddonQtyMap(line);
    const summaryForSpecs =
      f.addons.length > 0 ? softwareLineSpecOptionPart(f, line) : softwareLineSpecSummaryText(f, line);
    const addonRows =
      f.addons.length > 0
        ? f.addons.map((ad) => ({
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
        title={f.featureName}
        note={f.note}
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-app-line-subtle px-4 py-2">
        <h2 className="text-sm font-semibold text-app-text">{t("sw.title")}</h2>
        <button
          type="button"
          onClick={() => {
            useQuoteStore.getState().openErpInventoryCatalog("software");
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
                <p className="px-2 py-6 text-center text-xs text-app-muted">{t("sw.empty")}</p>
              ) : (
                filtered.map((f) => {
                  const n = f.docMaterialIds.filter(Boolean).length;
                  const bill = softwareBillingMode(f);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => pick(f)}
                      className="flex w-full flex-col gap-0.5 rounded-lg border border-transparent px-2 py-2 text-left text-xs transition hover:border-app-line-mid hover:bg-app-surface-2/60"
                    >
                      <span className="truncate font-medium text-app-text">{f.featureName || "—"}</span>
                      <span className="truncate text-app-muted">
                        {(f.featureCategory ?? "").trim() || t("cps.uncat")} ·{" "}
                        {typeof f.unitPrice === "number" && Number.isFinite(f.unitPrice) ? `¥${f.unitPrice}` : "—"}
                        {bill !== "one_time"
                          ? ` · ${bill === "monthly" ? t("sw.billingTagMo") : t("sw.billingTagYr")}`
                          : ""}{" "}
                        · {n}/3
                      </span>
                    </button>
                  );
                })
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

      {specDlgFeat && specDlgLine ? (
        <CustomPlanLineSpecsModal
          open
          title={specDlgFeat.featureName}
          options={specDlgFeat.options}
          selectedOptionId={specDlgLine.optionId}
          onPickOption={(id) => patchLine(specDlgLine.id, { optionId: id })}
          addons={specDlgFeat.addons}
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
