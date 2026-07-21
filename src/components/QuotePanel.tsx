import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { translate } from "../i18n/bundle";
import { useT } from "../i18n/useT";
import { useQuoteStore } from "../store/quoteStore";
import { buildQuotePdfBlob, exportQuotePdf } from "../utils/exportQuotePdf";
import { exportQuoteExcelFile } from "../utils/exportQuoteExcel";
import type { QuotePdfBuildInput } from "../utils/exportQuotePdf";
import {
  associationQuoteEffectiveQty,
  associationQuoteLineScaledNoDiscount,
  associationQuoteLineTotal,
  formatMoneyAmount,
} from "../utils/hardwareOptionsAddons";
import { isManualMixedQuotePricing } from "../utils/priceTriple";
import {
  customPlanServiceEffectiveTotal,
  customPlanSoftwareEffectiveTotal,
  servicePickLineTotal,
  softwarePickLineTotal,
} from "../utils/customPlanPickTotals";
import { isSoftwareBillingOneTime, softwareBillingMode } from "../utils/softwareBilling";
import { serviceLineSpecSummaryText, softwareLineSpecSummaryText } from "../utils/customPlanLineSpecSummary";
import { mergeQuoteTableOrder } from "../utils/quoteTableOrder";
import { formatNetAfterDiscountDisplay } from "../utils/quoteNetDisplay";
import {
  pdfServiceCategoryLabel,
  pdfSoftwareCategoryLabel,
} from "../utils/quotePdfLocaleStrings";
import type { AssociationRow, QuoteTableRowKey } from "../types";

const DND_QUOTE_ROW = "application/x-marketing-quote-row-key-v1";

type ManualMode = "none" | "discount" | "overrideTotal" | "overrideUnit";

export function QuotePanel() {
  const t = useT();
  const materials = useQuoteStore((s) => s.materials);
  const categoryDefs = useQuoteStore((s) => s.categoryDefs);
  const associations = useQuoteStore((s) => s.associations);
  const placements = useQuoteStore((s) => s.placements);
  const softwareFeatures = useQuoteStore((s) => s.softwareFeatures);
  const serviceItems = useQuoteStore((s) => s.serviceItems);
  const customPlanSoftwareLines = useQuoteStore((s) => s.customPlanSoftwareLines);
  const customPlanServiceLines = useQuoteStore((s) => s.customPlanServiceLines);
  const quoteFooterCustom = useQuoteStore((s) => s.quoteFooterCustom);
  const setQuoteFooterCustom = useQuoteStore((s) => s.setQuoteFooterCustom);
  const patchAssociation = useQuoteStore((s) => s.patchAssociation);
  const patchCustomPlanSoftwareLine = useQuoteStore((s) => s.patchCustomPlanSoftwareLine);
  const patchCustomPlanServiceLine = useQuoteStore((s) => s.patchCustomPlanServiceLine);
  const setActiveTab = useQuoteStore((s) => s.setActiveTab);
  const quoteGlobalPriceTier = useQuoteStore((s) => s.quoteGlobalPriceTier);
  const uiLocale = useQuoteStore((s) => s.uiLocale);
  const setQuoteGlobalPriceTier = useQuoteStore((s) => s.setQuoteGlobalPriceTier);
  const resetHardwareQuoteTierModesToFollow = useQuoteStore((s) => s.resetHardwareQuoteTierModesToFollow);
  const companyCatalogCurrency = useQuoteStore((s) => s.companyCatalogCurrency);
  const companyCatalogFxMultiplier = useQuoteStore((s) => s.companyCatalogFxMultiplier);
  const quotePdfExportStyle = useQuoteStore((s) => s.quotePdfExportStyle);
  const companyLogoDataUrl = useQuoteStore((s) => s.companyLogoDataUrl);
  const companyName = useQuoteStore((s) => s.companyName);
  const companyTagline = useQuoteStore((s) => s.companyTagline);
  const companyAddress = useQuoteStore((s) => s.companyAddress);
  const companyPhone = useQuoteStore((s) => s.companyPhone);
  const companyEmail = useQuoteStore((s) => s.companyEmail);
  const companyWebsite = useQuoteStore((s) => s.companyWebsite);
  const quoteTableOrder = useQuoteStore((s) => s.quoteTableOrder);
  const setQuoteTableOrder = useQuoteStore((s) => s.setQuoteTableOrder);
  const quoteTemplates = useQuoteStore((s) => s.quoteTemplates);
  const quotePdfTemplateId = useQuoteStore((s) => s.quotePdfTemplateId);
  const setQuotePdfTemplateId = useQuoteStore((s) => s.setQuotePdfTemplateId);
  const setEnterpriseResourceMainTab = useQuoteStore((s) => s.setEnterpriseResourceMainTab);
  const quotationRef = useQuoteStore((s) => s.quotationRef);
  const ensureQuotationRef = useQuoteStore((s) => s.ensureQuotationRef);
  const quoteExportIncludeImages = useQuoteStore((s) => s.quoteExportIncludeImages);
  const setQuoteExportIncludeImages = useQuoteStore((s) => s.setQuoteExportIncludeImages);

  const [title, setTitle] = useState(() =>
    translate(useQuoteStore.getState().uiLocale, "qt.defaultTitle"),
  );
  const [exporting, setExporting] = useState(false);
  const [exportExcelBusy, setExportExcelBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  const [manualHwId, setManualHwId] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState<ManualMode>("none");
  const [manualOverrideStr, setManualOverrideStr] = useState("");
  const [manualUnitStr, setManualUnitStr] = useState("");
  const [manualDiscountStr, setManualDiscountStr] = useState("");

  const orderUndoStack = useRef<QuoteTableRowKey[][]>([]);
  const dragFromIndex = useRef<number | null>(null);
  const [undoStackLen, setUndoStackLen] = useState(0);

  const fmtCatalog = useCallback(
    (n: number) =>
      formatMoneyAmount(
        n * (Number.isFinite(companyCatalogFxMultiplier) ? companyCatalogFxMultiplier : 1),
        companyCatalogCurrency,
      ),
    [companyCatalogCurrency, companyCatalogFxMultiplier],
  );

  const defaultQuoteOrder = useMemo((): QuoteTableRowKey[] => {
    const keys: QuoteTableRowKey[] = [];
    for (const r of associations) {
      if (associationQuoteEffectiveQty(r, placements) > 0) keys.push({ kind: "hw", id: r.id });
    }
    for (const line of customPlanSoftwareLines) {
      const f = softwareFeatures.find((x) => x.id === line.catalogFeatureId);
      const q = Math.floor(Number(line.quantity));
      if (!f?.featureName.trim() || !Number.isFinite(q) || q <= 0) continue;
      if (!isSoftwareBillingOneTime(f)) continue;
      keys.push({ kind: "sw", id: line.id });
    }
    for (const line of customPlanServiceLines) {
      const sv = serviceItems.find((x) => x.id === line.catalogServiceId);
      const q = Math.floor(Number(line.quantity));
      if (sv?.serviceName.trim() && Number.isFinite(q) && q > 0) keys.push({ kind: "sv", id: line.id });
    }
    return keys;
  }, [
    associations,
    placements,
    customPlanSoftwareLines,
    customPlanServiceLines,
    softwareFeatures,
    serviceItems,
  ]);

  const mergedQuoteOrder = useMemo(
    () => mergeQuoteTableOrder(quoteTableOrder, defaultQuoteOrder),
    [quoteTableOrder, defaultQuoteOrder],
  );

  const assocById = useMemo(() => new Map(associations.map((a) => [a.id, a])), [associations]);
  const swLineById = useMemo(() => new Map(customPlanSoftwareLines.map((l) => [l.id, l])), [customPlanSoftwareLines]);
  const svLineById = useMemo(() => new Map(customPlanServiceLines.map((l) => [l.id, l])), [customPlanServiceLines]);

  const hardwareQuoteTotal = useMemo(() => {
    let s = 0;
    for (const r of associations) {
      if (associationQuoteEffectiveQty(r, placements) <= 0) continue;
      s += associationQuoteLineTotal(r, placements, quoteGlobalPriceTier);
    }
    return s;
  }, [associations, placements, quoteGlobalPriceTier]);

  const manualMixed = useMemo(() => isManualMixedQuotePricing(associations), [associations]);

  const recurringMonthlySoftwareLines = useMemo(
    () =>
      customPlanSoftwareLines.filter((line) => {
        const f = softwareFeatures.find((x) => x.id === line.catalogFeatureId);
        const q = Math.floor(Number(line.quantity));
        return (
          !!f?.featureName.trim() &&
          Number.isFinite(q) &&
          q > 0 &&
          !!f &&
          softwareBillingMode(f) === "monthly"
        );
      }),
    [customPlanSoftwareLines, softwareFeatures],
  );

  const recurringYearlySoftwareLines = useMemo(
    () =>
      customPlanSoftwareLines.filter((line) => {
        const f = softwareFeatures.find((x) => x.id === line.catalogFeatureId);
        const q = Math.floor(Number(line.quantity));
        return (
          !!f?.featureName.trim() &&
          Number.isFinite(q) &&
          q > 0 &&
          !!f &&
          softwareBillingMode(f) === "yearly"
        );
      }),
    [customPlanSoftwareLines, softwareFeatures],
  );

  const softwareOneTimeQuoteTotal = useMemo(() => {
    let s = 0;
    for (const line of customPlanSoftwareLines) {
      const f = softwareFeatures.find((x) => x.id === line.catalogFeatureId);
      if (f && isSoftwareBillingOneTime(f)) s += customPlanSoftwareEffectiveTotal(f, line);
    }
    return s;
  }, [customPlanSoftwareLines, softwareFeatures]);

  const serviceQuoteTotalOnly = useMemo(() => {
    let s = 0;
    for (const line of customPlanServiceLines) {
      const sv = serviceItems.find((x) => x.id === line.catalogServiceId);
      if (sv) s += customPlanServiceEffectiveTotal(sv, line);
    }
    return s;
  }, [customPlanServiceLines, serviceItems]);

  const recurringMonthlyTotal = useMemo(() => {
    let s = 0;
    for (const line of recurringMonthlySoftwareLines) {
      const f = softwareFeatures.find((x) => x.id === line.catalogFeatureId);
      if (f) s += customPlanSoftwareEffectiveTotal(f, line);
    }
    return s;
  }, [recurringMonthlySoftwareLines, softwareFeatures]);

  const recurringYearlyTotal = useMemo(() => {
    let s = 0;
    for (const line of recurringYearlySoftwareLines) {
      const f = softwareFeatures.find((x) => x.id === line.catalogFeatureId);
      if (f) s += customPlanSoftwareEffectiveTotal(f, line);
    }
    return s;
  }, [recurringYearlySoftwareLines, softwareFeatures]);

  const total = hardwareQuoteTotal + softwareOneTimeQuoteTotal + serviceQuoteTotalOnly;
  const tierButtons: { id: "regular" | "vip" | "vvip"; label: string }[] = [
    { id: "regular", label: "Regular" },
    { id: "vip", label: "VIP" },
    { id: "vvip", label: "VVIP" },
  ];
  const GST_RATE = 0.1;
  const gstAmount = total * GST_RATE;
  const totalIncGst = total + gstAmount;
  const hasScheduleLines = defaultQuoteOrder.length > 0;
  const hasExportableContent =
    hasScheduleLines ||
    recurringMonthlySoftwareLines.length > 0 ||
    recurringYearlySoftwareLines.length > 0 ||
    quoteFooterCustom.trim().length > 0;

  const visibleHardwareCount = useMemo(
    () => associations.filter((r) => associationQuoteEffectiveQty(r, placements) > 0).length,
    [associations, placements],
  );

  const estPages = useMemo(() => {
    const n =
      defaultQuoteOrder.length +
      recurringMonthlySoftwareLines.length +
      recurringYearlySoftwareLines.length;
    return Math.max(2, 2 + Math.max(0, Math.ceil((n - 14) / 16)));
  }, [
    defaultQuoteOrder.length,
    recurringMonthlySoftwareLines.length,
    recurringYearlySoftwareLines.length,
  ]);

  const materialsById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  useEffect(() => {
    ensureQuotationRef();
  }, [ensureQuotationRef]);

  const quotePdfLayoutTemplate = useMemo(() => {
    if (!quotePdfTemplateId) return null;
    return quoteTemplates.find((x) => x.id === quotePdfTemplateId) ?? null;
  }, [quotePdfTemplateId, quoteTemplates]);

  const buildInput = useCallback((): QuotePdfBuildInput => {
    ensureQuotationRef();
    return {
      projectTitle: title,
      associations,
      placements,
      materialsById,
      categoryDefs,
      quoteFooterCustom,
      pdfStyle: quotePdfExportStyle,
      companyLogoDataUrl,
      companyName,
      companyTagline,
      companyAddress,
      companyPhone,
      companyEmail,
      companyWebsite,
      softwareFeatures,
      serviceItems,
      customPlanSoftwareLines,
      customPlanServiceLines,
      uiLocale,
      quoteGlobalPriceTier,
      companyCatalogCurrency,
      companyCatalogFxMultiplier,
      quotePdfLayoutTemplate,
      quotationRef,
      includeProductImages: quoteExportIncludeImages,
    };
  }, [
    title,
    associations,
    placements,
    materialsById,
    categoryDefs,
    quoteFooterCustom,
    quotePdfExportStyle,
    ensureQuotationRef,
    quotationRef,
    companyLogoDataUrl,
    companyName,
    companyTagline,
    companyAddress,
    companyPhone,
    companyEmail,
    companyWebsite,
    softwareFeatures,
    serviceItems,
    customPlanSoftwareLines,
    customPlanServiceLines,
    uiLocale,
    quoteGlobalPriceTier,
    companyCatalogCurrency,
    companyCatalogFxMultiplier,
    quotePdfLayoutTemplate,
    quoteExportIncludeImages,
  ]);

  useEffect(() => {
    let cancelled = false;
    const timerId = window.setTimeout(async () => {
      setPreviewErr(null);
      try {
        const blob = await buildQuotePdfBlob(buildInput());
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (previewObjectUrlRef.current) {
          URL.revokeObjectURL(previewObjectUrlRef.current);
        }
        previewObjectUrlRef.current = url;
        setPreviewUrl(url);
      } catch (e) {
        if (!cancelled) {
          setPreviewErr(e instanceof Error ? e.message : t("qt.previewErr"));
          setPreviewUrl(null);
        }
      }
    }, 480);
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [buildInput, t]);

  useEffect(
    () => () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
    },
    [],
  );

  const pushOrderUndo = useCallback(() => {
    orderUndoStack.current.push([...mergedQuoteOrder]);
    if (orderUndoStack.current.length > 50) orderUndoStack.current.shift();
    setUndoStackLen(orderUndoStack.current.length);
  }, [mergedQuoteOrder]);

  const undoOrder = useCallback(() => {
    const prev = orderUndoStack.current.pop();
    setUndoStackLen(orderUndoStack.current.length);
    if (prev) setQuoteTableOrder(prev);
  }, [setQuoteTableOrder]);

  const rowLabel = useCallback(
    (k: QuoteTableRowKey): string => {
      if (k.kind === "hw") {
        const r = assocById.get(k.id);
        if (!r) return "";
        const m = (r.deviceModel ?? "").trim();
        return m || r.hardwareName;
      }
      if (k.kind === "sw") {
        const line = swLineById.get(k.id);
        const f = line ? softwareFeatures.find((x) => x.id === line.catalogFeatureId) : undefined;
        return f?.featureName ?? "";
      }
      const line = svLineById.get(k.id);
      const sv = line ? serviceItems.find((x) => x.id === line.catalogServiceId) : undefined;
      return sv?.serviceName ?? "";
    },
    [assocById, swLineById, svLineById, softwareFeatures, serviceItems],
  );

  const rowAmount = useCallback(
    (k: QuoteTableRowKey): number => {
      if (k.kind === "hw") {
        const r = assocById.get(k.id);
        if (!r) return 0;
        return associationQuoteLineTotal(r, placements, quoteGlobalPriceTier);
      }
      if (k.kind === "sw") {
        const line = swLineById.get(k.id);
        const f = line ? softwareFeatures.find((x) => x.id === line.catalogFeatureId) : undefined;
        return f && line ? softwarePickLineTotal(f, line) : 0;
      }
      const line = svLineById.get(k.id);
      const sv = line ? serviceItems.find((x) => x.id === line.catalogServiceId) : undefined;
      return sv && line ? servicePickLineTotal(sv, line) : 0;
    },
    [assocById, swLineById, svLineById, placements, quoteGlobalPriceTier, softwareFeatures, serviceItems],
  );

  const sortByAmount = () => {
    pushOrderUndo();
    const next = [...mergedQuoteOrder].sort((a, b) => rowAmount(b) - rowAmount(a));
    setQuoteTableOrder(next);
  };

  const sortByName = () => {
    pushOrderUndo();
    const next = [...mergedQuoteOrder].sort((a, b) =>
      rowLabel(a).localeCompare(rowLabel(b), undefined, { sensitivity: "base" }),
    );
    setQuoteTableOrder(next);
  };

  const onExport = async () => {
    setExporting(true);
    try {
      await exportQuotePdf(buildInput());
    } finally {
      setExporting(false);
    }
  };

  const onExportExcel = async () => {
    setExportExcelBusy(true);
    try {
      await exportQuoteExcelFile(buildInput());
    } finally {
      setExportExcelBusy(false);
    }
  };

  const openManualModal = (r: AssociationRow) => {
    setManualHwId(r.id);
    const hasTotalOv =
      typeof r.quoteLineTotalOverride === "number" &&
      Number.isFinite(r.quoteLineTotalOverride) &&
      r.quoteLineTotalOverride >= 0;
    const hasUnitOv =
      typeof r.quoteLineUnitPriceOverride === "number" &&
      Number.isFinite(r.quoteLineUnitPriceOverride) &&
      r.quoteLineUnitPriceOverride >= 0;
    const d = r.quoteLineDiscountPct;
    const hasDisc = d !== null && d !== undefined && typeof d === "number" && Number.isFinite(d) && d > 0 && d < 100;
    if (hasTotalOv) {
      setManualMode("overrideTotal");
      setManualOverrideStr(String(r.quoteLineTotalOverride));
      setManualUnitStr("");
      setManualDiscountStr("");
    } else if (hasUnitOv) {
      setManualMode("overrideUnit");
      setManualUnitStr(String(r.quoteLineUnitPriceOverride));
      setManualOverrideStr("");
      setManualDiscountStr("");
    } else if (hasDisc) {
      setManualMode("discount");
      setManualOverrideStr("");
      setManualUnitStr("");
      setManualDiscountStr(String(d));
    } else {
      setManualMode("none");
      setManualOverrideStr("");
      setManualUnitStr("");
      setManualDiscountStr("");
    }
  };

  const applyManualModal = () => {
    if (!manualHwId) return;
    if (manualMode === "none") {
      patchAssociation(manualHwId, {
        quoteLineTotalOverride: null,
        quoteLineUnitPriceOverride: null,
        quoteLineDiscountPct: null,
      });
    } else if (manualMode === "overrideTotal") {
      const n = parseFloat(manualOverrideStr.trim());
      if (!Number.isNaN(n) && n >= 0) {
        patchAssociation(manualHwId, {
          quoteLineTotalOverride: n,
          quoteLineUnitPriceOverride: null,
          quoteLineDiscountPct: null,
        });
      }
    } else if (manualMode === "overrideUnit") {
      const n = parseFloat(manualUnitStr.trim());
      if (!Number.isNaN(n) && n >= 0) {
        patchAssociation(manualHwId, {
          quoteLineUnitPriceOverride: n,
          quoteLineTotalOverride: null,
          quoteLineDiscountPct: null,
        });
      }
    } else {
      const n = parseFloat(manualDiscountStr.trim());
      if (!Number.isNaN(n) && n > 0 && n < 100) {
        patchAssociation(manualHwId, {
          quoteLineDiscountPct: n,
          quoteLineTotalOverride: null,
          quoteLineUnitPriceOverride: null,
        });
      }
    }
    setManualHwId(null);
  };

  const manualHw = manualHwId ? assocById.get(manualHwId) : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="shrink-0">
        <h2 className="text-sm font-semibold text-app-text">{t("qt.title")}</h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-1 lg:max-w-[min(100%,960px)]">
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-app-panel-border bg-app-panel-bg p-4">
            <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs text-app-muted">
              {t("qt.projectTitle")}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex min-w-[220px] flex-col gap-1 text-xs text-app-muted">
              {t("qt.quotationRefLabel")}
              <input
                readOnly
                value={quotationRef ?? ""}
                placeholder="Pisell20260429001"
                className="rounded-lg border border-app-line-subtle bg-app-surface-2/80 px-3 py-2 font-mono text-sm text-app-muted"
                title={t("qt.quotationRefLabel")}
              />
            </label>
            <label className="flex min-w-[200px] flex-col gap-1 text-xs text-app-muted">
              {t("qt.coverTemplate")}
              <select
                className="rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm"
                value={quotePdfTemplateId ?? ""}
                onChange={(e) => setQuotePdfTemplateId(e.target.value === "" ? null : e.target.value)}
              >
                <option value="">{t("qt.coverTemplateDefault")}</option>
                {quoteTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setEnterpriseResourceMainTab("templateBuilder");
                setActiveTab("enterpriseResources");
              }}
              className="rounded-lg border border-app-line-strong px-3 py-2 text-sm hover:bg-app-surface-2"
            >
              {t("qt.editTemplates")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className="rounded-lg border border-app-line-strong px-3 py-2 text-sm hover:bg-app-surface-2"
            >
              {t("qt.companySettings")}
            </button>
            <button
              type="button"
              onClick={() => {
                useQuoteStore.getState().setCustomPlanTab("select");
                useQuoteStore.getState().setCustomPlanSelectStep("map");
                setActiveTab("customPlan");
              }}
              className="rounded-lg border border-app-line-strong px-3 py-2 text-sm hover:bg-app-surface-2"
            >
              {t("cp.select")}
            </button>
            <label className="flex max-w-[220px] cursor-pointer items-center gap-2 text-xs text-app-muted">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 shrink-0 rounded border border-app-line-mid bg-app-surface-2"
                checked={quoteExportIncludeImages}
                onChange={(e) => setQuoteExportIncludeImages(e.target.checked)}
              />
              <span className="leading-snug">{t("qt.includeProductImages")}</span>
            </label>
            <button
              type="button"
              disabled={exporting || exportExcelBusy || !hasExportableContent}
              onClick={() => void onExportExcel()}
              className="rounded-lg border border-app-line-strong px-4 py-2 text-sm font-medium text-app-text hover:bg-app-surface-2 disabled:opacity-50"
            >
              {exportExcelBusy ? t("qt.exportingExcel") : t("qt.exportExcel")}
            </button>
            <button
              type="button"
              disabled={exporting || exportExcelBusy || !hasExportableContent}
              onClick={() => void onExport()}
              className="rounded-lg bg-app-primary px-4 py-2 text-sm font-medium text-app-on-primary hover:bg-app-primary-hover disabled:opacity-50"
            >
              {exporting ? t("qt.exporting") : t("qt.export")}
            </button>
          </div>

          <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-app-panel-border bg-app-panel-bg p-3">
              <div className="text-xs text-app-muted">{t("qt.totalsHint")}</div>
              <div className="mt-0.5 text-xl font-semibold text-app-text">{fmtCatalog(total)}</div>
              <div className="mt-1.5 space-y-0.5 text-[11px] text-app-muted">
                <div>{t("qt.hwLine", { n: fmtCatalog(hardwareQuoteTotal) })}</div>
                <div>{t("qt.swOneTimeLine", { n: fmtCatalog(softwareOneTimeQuoteTotal) })}</div>
                <div>{t("qt.svLine", { n: fmtCatalog(serviceQuoteTotalOnly) })}</div>
                {recurringMonthlyTotal > 0 ? (
                  <div>{t("qt.swMonthlyLine", { n: fmtCatalog(recurringMonthlyTotal) })}</div>
                ) : null}
                {recurringYearlyTotal > 0 ? (
                  <div>{t("qt.swYearlyLine", { n: fmtCatalog(recurringYearlyTotal) })}</div>
                ) : null}
              </div>
            </div>
            <div className="rounded-xl border border-app-panel-border bg-app-panel-bg p-3">
              <div className="text-xs text-app-muted">{t("qt.subExGst")}</div>
              <div className="mt-0.5 text-xl font-semibold text-app-text">{fmtCatalog(total)}</div>
              <div className="mt-1.5 space-y-0.5 text-[11px] text-app-muted">
                <div>
                  {t("qt.gstLine")}: {fmtCatalog(gstAmount)}
                </div>
                <div className="font-medium text-app-text">
                  {t("qt.totalIncGst")}: {fmtCatalog(totalIncGst)}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-app-panel-border bg-app-panel-bg p-3">
              <div className="text-xs text-app-muted">{t("qt.hwCount")}</div>
              <div className="mt-0.5 text-xl font-semibold text-app-text">{visibleHardwareCount}</div>
            </div>
            <div className="rounded-xl border border-app-panel-border bg-app-panel-bg p-3">
              <div className="text-xs text-app-muted">{t("qt.estPages")}</div>
              <div className="mt-0.5 text-xl font-semibold text-app-text">{estPages}</div>
            </div>
          </section>

          <section className="rounded-xl border border-app-panel-border bg-app-panel-bg p-3">
            <h3 className="text-sm font-semibold text-app-text">{t("qt.summaryTitle")}</h3>
            <p className="mt-0.5 text-xs text-app-muted">{t("qt.summaryHint")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-app-muted">Global tier</span>
              {tierButtons.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  disabled={manualMixed}
                  onClick={() => setQuoteGlobalPriceTier(b.id)}
                  className={`rounded border px-2 py-1 text-xs font-medium ${
                    quoteGlobalPriceTier === b.id
                      ? "border-app-primary bg-app-primary-soft text-app-tone"
                      : "border-app-line-mid text-app-muted hover:bg-app-surface-2"
                  } disabled:opacity-40`}
                >
                  {b.label}
                </button>
              ))}
              {manualMixed ? (
                <span className="text-[11px] text-app-tone">Manual line pricing</span>
              ) : null}
              {manualMixed ? (
                <button
                  type="button"
                  className="text-[11px] text-app-muted underline hover:text-app-text"
                  onClick={() => resetHardwareQuoteTierModesToFollow()}
                >
                  Reset lines to follow global
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={sortByAmount}
                disabled={mergedQuoteOrder.length < 2}
                className="rounded border border-app-line-mid px-2 py-1 text-[11px] text-app-muted hover:bg-app-surface-2 disabled:opacity-40"
              >
                {t("qt.sortAmount")}
              </button>
              <button
                type="button"
                onClick={sortByName}
                disabled={mergedQuoteOrder.length < 2}
                className="rounded border border-app-line-mid px-2 py-1 text-[11px] text-app-muted hover:bg-app-surface-2 disabled:opacity-40"
              >
                {t("qt.sortName")}
              </button>
              <button
                type="button"
                onClick={undoOrder}
                disabled={undoStackLen === 0}
                className="rounded border border-app-line-mid px-2 py-1 text-[11px] text-app-muted hover:bg-app-surface-2 disabled:opacity-40"
              >
                {t("qt.undoOrder")}
              </button>
            </div>
            <div className="mt-2 overflow-x-auto rounded-lg border border-app-line-subtle">
              <table className="min-w-[900px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-app-line-subtle bg-app-surface-2/80 text-[10px] uppercase leading-tight text-app-muted">
                    <th className="w-7 px-0.5 py-1" aria-label="Reorder" />
                    <th className="w-9 px-1 py-1">{t("qt.thNo")}</th>
                    <th className="min-w-[140px] px-1 py-1">{t("qt.thProduct")}</th>
                    <th className="w-[4.25rem] px-1 py-1">{t("qt.thTier")}</th>
                    <th className="w-[4.5rem] px-1 py-1">{t("qt.thUnitPrice")}</th>
                    <th className="w-[4.25rem] px-1 py-1">{t("qt.thQty")}</th>
                    <th className="w-[4.75rem] px-1 py-1">{t("qt.thLineTotal")}</th>
                    <th className="min-w-[11rem] max-w-[18rem] px-1 py-1">{t("qt.thNetAfterDisc")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-line-subtle">
                  {mergedQuoteOrder.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-2 py-5 text-center text-xs text-app-muted">
                        {recurringMonthlySoftwareLines.length > 0 || recurringYearlySoftwareLines.length > 0
                          ? t("qt.emptyMainSchedule")
                          : t("qt.emptyHw")}
                      </td>
                    </tr>
                  ) : (
                    mergedQuoteOrder.map((key, i) => {
                      if (key.kind === "hw") {
                        const r = assocById.get(key.id);
                        if (!r) return null;
                        const qEff = associationQuoteEffectiveQty(r, placements);
                        const listCatalog = associationQuoteLineScaledNoDiscount(r, placements, quoteGlobalPriceTier);
                        const eff = associationQuoteLineTotal(r, placements, quoteGlobalPriceTier);
                        const unitList = qEff > 0 ? listCatalog / qEff : 0;
                        const hasTotalOv =
                          typeof r.quoteLineTotalOverride === "number" &&
                          Number.isFinite(r.quoteLineTotalOverride) &&
                          r.quoteLineTotalOverride >= 0;
                        const hasUnitOv =
                          typeof r.quoteLineUnitPriceOverride === "number" &&
                          Number.isFinite(r.quoteLineUnitPriceOverride) &&
                          r.quoteLineUnitPriceOverride >= 0;
                        const d = r.quoteLineDiscountPct;
                        const hasDisc =
                          d !== null &&
                          d !== undefined &&
                          typeof d === "number" &&
                          Number.isFinite(d) &&
                          d > 0 &&
                          d < 100;
                        const changedPrice = hasDisc || hasTotalOv || hasUnitOv;
                        const manualCell = changedPrice ? fmtCatalog(eff) : "—";
                        const netParen = formatNetAfterDiscountDisplay(
                          eff,
                          listCatalog,
                          hasTotalOv || hasUnitOv ? null : d,
                          fmtCatalog,
                          uiLocale,
                        );
                        return (
                          <tr
                            key={`hw-${r.id}`}
                            draggable
                            onDragStart={(e) => {
                              dragFromIndex.current = i;
                              e.dataTransfer.setData(DND_QUOTE_ROW, String(i));
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const from = dragFromIndex.current;
                              dragFromIndex.current = null;
                              if (from === null || from === i) return;
                              pushOrderUndo();
                              const next = [...mergedQuoteOrder];
                              const [moved] = next.splice(from, 1);
                              next.splice(i, 0, moved);
                              setQuoteTableOrder(next);
                            }}
                            className="bg-app-surface-2/30"
                          >
                            <td className="cursor-grab px-1 py-2 text-center text-app-subtle active:cursor-grabbing">
                              ⋮
                            </td>
                            <td className="px-2 py-2 align-top text-app-muted">{i + 1}</td>
                            <td className="px-2 py-2 align-top">
                              <input
                                value={r.deviceModel}
                                onChange={(e) => patchAssociation(r.id, { deviceModel: e.target.value })}
                                placeholder={r.hardwareName || t("qt.sameAsHw")}
                                className="w-full min-w-0 rounded border border-app-line-strong bg-app-surface-2 px-2 py-1 text-xs text-app-text"
                              />
                              {(r.hardwareName ?? "").trim() !== "" &&
                              (r.deviceModel ?? "").trim() !== (r.hardwareName ?? "").trim() ? (
                                <div className="mt-0.5 text-[11px] text-app-muted">{r.hardwareName}</div>
                              ) : null}
                              <textarea
                                value={r.quoteTableNote}
                                onChange={(e) => patchAssociation(r.id, { quoteTableNote: e.target.value })}
                                placeholder={
                                  r.note
                                    ? t("qt.noteFromHw", {
                                        hint: `${r.note.slice(0, 40)}${r.note.length > 40 ? "…" : ""}`,
                                      })
                                    : t("qt.noteTable")
                                }
                                rows={2}
                                className="mt-1 w-full min-w-0 resize-y rounded border border-app-line-strong bg-app-surface-2 px-1 py-0.5 text-[11px] leading-snug text-app-text"
                              />
                            </td>
                            <td className="px-2 py-2 align-top">
                              <select
                                className="w-full max-w-[7rem] rounded border border-app-line-strong bg-app-surface-2 px-1 py-1 text-[11px] text-app-text"
                                value={r.quoteTierMode ?? "follow"}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  patchAssociation(r.id, {
                                    quoteTierMode:
                                      v === "regular" || v === "vip" || v === "vvip" || v === "follow" ? v : "follow",
                                  });
                                }}
                              >
                                <option value="follow">Follow global</option>
                                <option value="regular">Regular</option>
                                <option value="vip">VIP</option>
                                <option value="vvip">VVIP</option>
                              </select>
                            </td>
                            <td className="px-1 py-1 align-top tabular-nums text-[11px] text-app-text">{fmtCatalog(unitList)}</td>
                            <td className="px-2 py-2 align-top">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={r.quoteLineQtyOverride != null ? String(r.quoteLineQtyOverride) : ""}
                                placeholder={String(qEff)}
                                onChange={(e) => {
                                  const v = e.target.value.trim();
                                  if (v === "") {
                                    patchAssociation(r.id, { quoteLineQtyOverride: null });
                                    return;
                                  }
                                  const n = parseInt(v, 10);
                                  if (Number.isNaN(n)) return;
                                  patchAssociation(r.id, { quoteLineQtyOverride: Math.max(0, n) });
                                }}
                                className="w-16 rounded border border-app-line-strong bg-app-surface-2 px-1 py-1 text-xs tabular-nums text-app-text"
                              />
                            </td>
                            <td className="px-1 py-1 align-top tabular-nums text-[11px] text-app-text">{fmtCatalog(listCatalog)}</td>
                            <td className="px-1 py-1 align-top">
                              <button
                                type="button"
                                onClick={() => openManualModal(r)}
                                className="block w-full rounded border border-transparent px-0.5 py-0.5 text-left text-[11px] leading-snug hover:border-app-line-mid hover:bg-app-surface-2/60"
                              >
                                <span className="font-medium tabular-nums text-app-text">{netParen}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openManualModal(r)}
                                className="mt-0.5 max-w-full rounded border border-app-line-mid bg-app-surface-2 px-1 py-0.5 text-left text-[10px] text-app-muted hover:border-app-primary/50"
                              >
                                {manualCell}
                              </button>
                            </td>
                          </tr>
                        );
                      }
                      if (key.kind === "sw") {
                        const line = swLineById.get(key.id);
                        const f = line ? softwareFeatures.find((x) => x.id === line.catalogFeatureId) : undefined;
                        if (!line || !f?.featureName.trim()) return null;
                        const ltAuto = softwarePickLineTotal(f, line);
                        const ltEff = customPlanSoftwareEffectiveTotal(f, line);
                        const netParenSw = formatNetAfterDiscountDisplay(ltEff, ltAuto, null, fmtCatalog, uiLocale);
                        const spec = softwareLineSpecSummaryText(f, line);
                        const note = (f.note ?? "").trim();
                        const catalogRem =
                          [spec !== "—" ? spec : "", note].filter(Boolean).join(" · ") || "";
                        const q = Math.floor(Number(line.quantity)) || 0;
                        return (
                          <tr
                            key={`sw-${line.id}`}
                            draggable
                            onDragStart={(e) => {
                              dragFromIndex.current = i;
                              e.dataTransfer.setData(DND_QUOTE_ROW, String(i));
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const from = dragFromIndex.current;
                              dragFromIndex.current = null;
                              if (from === null || from === i) return;
                              pushOrderUndo();
                              const next = [...mergedQuoteOrder];
                              const [moved] = next.splice(from, 1);
                              next.splice(i, 0, moved);
                              setQuoteTableOrder(next);
                            }}
                            className="bg-app-surface-2/15"
                          >
                            <td className="cursor-grab px-1 py-2 text-center text-app-subtle active:cursor-grabbing">
                              ⋮
                            </td>
                            <td className="px-2 py-2 align-top text-app-muted">{i + 1}</td>
                            <td className="px-2 py-2 align-top">
                              <div className="font-medium text-app-text">{f.featureName}</div>
                              <div className="mt-0.5 text-[11px] leading-snug text-app-muted">
                                {pdfSoftwareCategoryLabel((f.featureCategory ?? "").trim(), uiLocale, categoryDefs)}
                              </div>
                              <textarea
                                value={line.quoteLineNote ?? ""}
                                onChange={(e) =>
                                  patchCustomPlanSoftwareLine(line.id, { quoteLineNote: e.target.value })
                                }
                                placeholder={catalogRem || t("qt.noteTable")}
                                rows={2}
                                className="mt-1 w-full min-w-0 resize-y rounded border border-app-line-strong bg-app-surface-2 px-1 py-0.5 text-[11px] leading-snug text-app-text"
                              />
                            </td>
                            <td className="px-2 py-2 align-top text-app-muted">—</td>
                            <td className="px-1 py-1 align-top tabular-nums text-[11px] text-app-text">
                              {q > 0 ? fmtCatalog(ltAuto / q) : fmtCatalog(0)}
                            </td>
                            <td className="px-2 py-2 align-top">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={String(q)}
                                onChange={(e) => {
                                  const n = parseInt(e.target.value, 10);
                                  patchCustomPlanSoftwareLine(line.id, {
                                    quantity: Number.isNaN(n) ? 0 : Math.max(0, n),
                                  });
                                }}
                                className="w-16 rounded border border-app-line-strong bg-app-surface-2 px-1 py-1 text-xs tabular-nums text-app-text"
                              />
                            </td>
                            <td className="px-1 py-1 align-top tabular-nums text-[11px] text-app-text">{fmtCatalog(ltAuto)}</td>
                            <td className="px-1 py-1 align-top">
                              <div className="break-words text-[11px] leading-snug text-app-text">{netParenSw}</div>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={
                                  line.lineTotalOverride != null && line.lineTotalOverride !== undefined
                                    ? String(line.lineTotalOverride)
                                    : ""
                                }
                                onChange={(e) => {
                                  const raw = e.target.value.trim();
                                  if (!raw) {
                                    patchCustomPlanSoftwareLine(line.id, { lineTotalOverride: null });
                                    return;
                                  }
                                  const n = Number(raw);
                                  patchCustomPlanSoftwareLine(line.id, {
                                    lineTotalOverride: Number.isFinite(n) && n >= 0 ? n : null,
                                  });
                                }}
                                placeholder={fmtCatalog(ltAuto)}
                                title={t("qt.manualTitle")}
                                className="mt-0.5 w-full min-w-0 rounded border border-app-line-strong bg-app-surface-2 px-1 py-0.5 text-[10px] tabular-nums text-app-text"
                              />
                            </td>
                        </tr>
                      );
                      }
                      const line = svLineById.get(key.id);
                      const sv = line ? serviceItems.find((x) => x.id === line.catalogServiceId) : undefined;
                      if (!line || !sv?.serviceName.trim()) return null;
                      const ltAuto = servicePickLineTotal(sv, line);
                      const ltEff = customPlanServiceEffectiveTotal(sv, line);
                      const netParenSv = formatNetAfterDiscountDisplay(ltEff, ltAuto, null, fmtCatalog, uiLocale);
                      const spec = serviceLineSpecSummaryText(sv, line);
                      const note = (sv.note ?? "").trim();
                      const catalogRem =
                        [spec !== "—" ? spec : "", note].filter(Boolean).join(" · ") || "";
                      const q = Math.floor(Number(line.quantity)) || 0;
                      return (
                        <tr
                          key={`sv-${line.id}`}
                          draggable
                          onDragStart={(e) => {
                            dragFromIndex.current = i;
                            e.dataTransfer.setData(DND_QUOTE_ROW, String(i));
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const from = dragFromIndex.current;
                            dragFromIndex.current = null;
                            if (from === null || from === i) return;
                            pushOrderUndo();
                            const next = [...mergedQuoteOrder];
                            const [moved] = next.splice(from, 1);
                            next.splice(i, 0, moved);
                            setQuoteTableOrder(next);
                          }}
                          className="bg-app-surface-2/15"
                        >
                          <td className="cursor-grab px-1 py-2 text-center text-app-subtle active:cursor-grabbing">⋮</td>
                          <td className="px-2 py-2 align-top text-app-muted">{i + 1}</td>
                          <td className="px-2 py-2 align-top">
                            <div className="font-medium text-app-text">{sv.serviceName}</div>
                            <div className="mt-0.5 text-[11px] leading-snug text-app-muted">
                              {pdfServiceCategoryLabel((sv.serviceCategory ?? "").trim(), uiLocale, categoryDefs)}
                            </div>
                            <textarea
                              value={line.quoteLineNote ?? ""}
                              onChange={(e) =>
                                patchCustomPlanServiceLine(line.id, { quoteLineNote: e.target.value })
                              }
                              placeholder={catalogRem || t("qt.noteTable")}
                              rows={2}
                              className="mt-1 w-full min-w-0 resize-y rounded border border-app-line-strong bg-app-surface-2 px-1 py-0.5 text-[11px] leading-snug text-app-text"
                            />
                          </td>
                          <td className="px-2 py-2 align-top text-app-muted">—</td>
                          <td className="px-1 py-1 align-top tabular-nums text-[11px] text-app-text">
                            {q > 0 ? fmtCatalog(ltAuto / q) : fmtCatalog(0)}
                          </td>
                          <td className="px-2 py-2 align-top">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={String(q)}
                              onChange={(e) => {
                                const n = parseInt(e.target.value, 10);
                                patchCustomPlanServiceLine(line.id, {
                                  quantity: Number.isNaN(n) ? 0 : Math.max(0, n),
                                });
                              }}
                              className="w-16 rounded border border-app-line-strong bg-app-surface-2 px-1 py-1 text-xs tabular-nums text-app-text"
                            />
                          </td>
                          <td className="px-1 py-1 align-top tabular-nums text-[11px] text-app-text">{fmtCatalog(ltAuto)}</td>
                          <td className="px-1 py-1 align-top">
                            <div className="break-words text-[11px] leading-snug text-app-text">{netParenSv}</div>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={
                                line.lineTotalOverride != null && line.lineTotalOverride !== undefined
                                  ? String(line.lineTotalOverride)
                                  : ""
                              }
                              onChange={(e) => {
                                const raw = e.target.value.trim();
                                if (!raw) {
                                  patchCustomPlanServiceLine(line.id, { lineTotalOverride: null });
                                  return;
                                }
                                const n = Number(raw);
                                patchCustomPlanServiceLine(line.id, {
                                  lineTotalOverride: Number.isFinite(n) && n >= 0 ? n : null,
                                });
                              }}
                              placeholder={fmtCatalog(ltAuto)}
                              title={t("qt.manualTitle")}
                              className="mt-0.5 w-full min-w-0 rounded border border-app-line-strong bg-app-surface-2 px-1 py-0.5 text-[10px] tabular-nums text-app-text"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {recurringMonthlySoftwareLines.length > 0 ? (
              <div className="mt-4 overflow-x-auto rounded-lg border border-app-line-subtle">
                <div className="border-b border-app-line-subtle bg-app-surface-2/60 px-3 py-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-app-muted">
                    {t("qt.sectionSwMonthly")}
                  </div>
                  <div className="mt-0.5 text-[10px] text-app-muted">{t("qt.recurringExclHint")}</div>
                </div>
                <table className="min-w-[900px] w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-app-line-subtle bg-app-surface-2/80 text-[10px] uppercase leading-tight text-app-muted">
                      <th className="w-7 px-0.5 py-1" aria-hidden />
                      <th className="w-9 px-1 py-1">{t("qt.thNo")}</th>
                      <th className="min-w-[140px] px-1 py-1">{t("qt.thProduct")}</th>
                      <th className="w-[4.25rem] px-1 py-1">{t("qt.thTier")}</th>
                      <th className="w-[4.5rem] px-1 py-1">{t("qt.thUnitPrice")}</th>
                      <th className="w-[4.25rem] px-1 py-1">{t("qt.thQty")}</th>
                      <th className="w-[4.75rem] px-1 py-1">{t("qt.thLineTotal")}</th>
                      <th className="min-w-[11rem] max-w-[18rem] px-1 py-1">{t("qt.thNetAfterDisc")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-line-subtle">
                    {recurringMonthlySoftwareLines.map((line, i) => {
                      const f = softwareFeatures.find((x) => x.id === line.catalogFeatureId);
                      if (!f) return null;
                      const ltAuto = softwarePickLineTotal(f, line);
                      const ltEff = customPlanSoftwareEffectiveTotal(f, line);
                      const netParenMo = formatNetAfterDiscountDisplay(ltEff, ltAuto, null, fmtCatalog, uiLocale);
                      const spec = softwareLineSpecSummaryText(f, line);
                      const note = (f.note ?? "").trim();
                      const catalogRem =
                        [spec !== "—" ? spec : "", note].filter(Boolean).join(" · ") || "";
                      const q = Math.floor(Number(line.quantity)) || 0;
                      return (
                        <tr key={`sw-mo-${line.id}`} className="bg-app-surface-2/15">
                          <td className="px-1 py-1 text-center text-app-subtle">—</td>
                          <td className="px-1 py-1 align-top text-app-muted">{i + 1}</td>
                          <td className="px-1 py-1 align-top">
                            <div className="font-medium text-app-text">{f.featureName}</div>
                            <div className="mt-0.5 text-[11px] leading-snug text-app-muted">
                              {`${t("sw.billingTagMo")} · ${pdfSoftwareCategoryLabel((f.featureCategory ?? "").trim(), uiLocale, categoryDefs)}`}
                            </div>
                            <textarea
                              value={line.quoteLineNote ?? ""}
                              onChange={(e) =>
                                patchCustomPlanSoftwareLine(line.id, { quoteLineNote: e.target.value })
                              }
                              placeholder={catalogRem || t("qt.noteTable")}
                              rows={2}
                              className="mt-1 w-full min-w-0 resize-y rounded border border-app-line-strong bg-app-surface-2 px-1 py-0.5 text-[11px] leading-snug text-app-text"
                            />
                          </td>
                          <td className="px-1 py-1 align-top text-app-muted">—</td>
                          <td className="px-1 py-1 align-top tabular-nums text-[11px] text-app-text">
                            {q > 0 ? fmtCatalog(ltAuto / q) : fmtCatalog(0)}
                          </td>
                          <td className="px-1 py-1 align-top">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={String(q)}
                              onChange={(e) => {
                                const n = parseInt(e.target.value, 10);
                                patchCustomPlanSoftwareLine(line.id, {
                                  quantity: Number.isNaN(n) ? 0 : Math.max(0, n),
                                });
                              }}
                              className="w-14 rounded border border-app-line-strong bg-app-surface-2 px-1 py-0.5 text-[11px] tabular-nums text-app-text"
                            />
                          </td>
                          <td className="px-1 py-1 align-top tabular-nums text-[11px] text-app-text">{fmtCatalog(ltAuto)}</td>
                          <td className="px-1 py-1 align-top">
                            <div className="break-words text-[11px] leading-snug text-app-text">{netParenMo}</div>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={
                                line.lineTotalOverride != null && line.lineTotalOverride !== undefined
                                  ? String(line.lineTotalOverride)
                                  : ""
                              }
                              onChange={(e) => {
                                const raw = e.target.value.trim();
                                if (!raw) {
                                  patchCustomPlanSoftwareLine(line.id, { lineTotalOverride: null });
                                  return;
                                }
                                const n = Number(raw);
                                patchCustomPlanSoftwareLine(line.id, {
                                  lineTotalOverride: Number.isFinite(n) && n >= 0 ? n : null,
                                });
                              }}
                              placeholder={fmtCatalog(ltAuto)}
                              title={t("qt.manualTitle")}
                              className="mt-0.5 w-full min-w-0 rounded border border-app-line-strong bg-app-surface-2 px-1 py-0.5 text-[10px] tabular-nums text-app-text"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {recurringYearlySoftwareLines.length > 0 ? (
              <div className="mt-4 overflow-x-auto rounded-lg border border-app-line-subtle">
                <div className="border-b border-app-line-subtle bg-app-surface-2/60 px-3 py-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-app-muted">
                    {t("qt.sectionSwYearly")}
                  </div>
                  <div className="mt-0.5 text-[10px] text-app-muted">{t("qt.recurringExclHint")}</div>
                </div>
                <table className="min-w-[900px] w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-app-line-subtle bg-app-surface-2/80 text-[10px] uppercase leading-tight text-app-muted">
                      <th className="w-7 px-0.5 py-1" aria-hidden />
                      <th className="w-9 px-1 py-1">{t("qt.thNo")}</th>
                      <th className="min-w-[140px] px-1 py-1">{t("qt.thProduct")}</th>
                      <th className="w-[4.25rem] px-1 py-1">{t("qt.thTier")}</th>
                      <th className="w-[4.5rem] px-1 py-1">{t("qt.thUnitPrice")}</th>
                      <th className="w-[4.25rem] px-1 py-1">{t("qt.thQty")}</th>
                      <th className="w-[4.75rem] px-1 py-1">{t("qt.thLineTotal")}</th>
                      <th className="min-w-[11rem] max-w-[18rem] px-1 py-1">{t("qt.thNetAfterDisc")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-line-subtle">
                    {recurringYearlySoftwareLines.map((line, i) => {
                      const f = softwareFeatures.find((x) => x.id === line.catalogFeatureId);
                      if (!f) return null;
                      const ltAuto = softwarePickLineTotal(f, line);
                      const ltEff = customPlanSoftwareEffectiveTotal(f, line);
                      const netParenYr = formatNetAfterDiscountDisplay(ltEff, ltAuto, null, fmtCatalog, uiLocale);
                      const spec = softwareLineSpecSummaryText(f, line);
                      const note = (f.note ?? "").trim();
                      const catalogRem =
                        [spec !== "—" ? spec : "", note].filter(Boolean).join(" · ") || "";
                      const q = Math.floor(Number(line.quantity)) || 0;
                      return (
                        <tr key={`sw-yr-${line.id}`} className="bg-app-surface-2/15">
                          <td className="px-1 py-1 text-center text-app-subtle">—</td>
                          <td className="px-1 py-1 align-top text-app-muted">{i + 1}</td>
                          <td className="px-1 py-1 align-top">
                            <div className="font-medium text-app-text">{f.featureName}</div>
                            <div className="mt-0.5 text-[11px] leading-snug text-app-muted">
                              {`${t("sw.billingTagYr")} · ${pdfSoftwareCategoryLabel((f.featureCategory ?? "").trim(), uiLocale, categoryDefs)}`}
                            </div>
                            <textarea
                              value={line.quoteLineNote ?? ""}
                              onChange={(e) =>
                                patchCustomPlanSoftwareLine(line.id, { quoteLineNote: e.target.value })
                              }
                              placeholder={catalogRem || t("qt.noteTable")}
                              rows={2}
                              className="mt-1 w-full min-w-0 resize-y rounded border border-app-line-strong bg-app-surface-2 px-1 py-0.5 text-[11px] leading-snug text-app-text"
                            />
                          </td>
                          <td className="px-1 py-1 align-top text-app-muted">—</td>
                          <td className="px-1 py-1 align-top tabular-nums text-[11px] text-app-text">
                            {q > 0 ? fmtCatalog(ltAuto / q) : fmtCatalog(0)}
                          </td>
                          <td className="px-1 py-1 align-top">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={String(q)}
                              onChange={(e) => {
                                const n = parseInt(e.target.value, 10);
                                patchCustomPlanSoftwareLine(line.id, {
                                  quantity: Number.isNaN(n) ? 0 : Math.max(0, n),
                                });
                              }}
                              className="w-14 rounded border border-app-line-strong bg-app-surface-2 px-1 py-0.5 text-[11px] tabular-nums text-app-text"
                            />
                          </td>
                          <td className="px-1 py-1 align-top tabular-nums text-[11px] text-app-text">{fmtCatalog(ltAuto)}</td>
                          <td className="px-1 py-1 align-top">
                            <div className="break-words text-[11px] leading-snug text-app-text">{netParenYr}</div>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={
                                line.lineTotalOverride != null && line.lineTotalOverride !== undefined
                                  ? String(line.lineTotalOverride)
                                  : ""
                              }
                              onChange={(e) => {
                                const raw = e.target.value.trim();
                                if (!raw) {
                                  patchCustomPlanSoftwareLine(line.id, { lineTotalOverride: null });
                                  return;
                                }
                                const n = Number(raw);
                                patchCustomPlanSoftwareLine(line.id, {
                                  lineTotalOverride: Number.isFinite(n) && n >= 0 ? n : null,
                                });
                              }}
                              placeholder={fmtCatalog(ltAuto)}
                              title={t("qt.manualTitle")}
                              className="mt-0.5 w-full min-w-0 rounded border border-app-line-strong bg-app-surface-2 px-1 py-0.5 text-[10px] tabular-nums text-app-text"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-app-panel-border bg-app-panel-bg p-4">
            <h3 className="text-sm font-semibold text-app-text">{t("qt.otherTitle")}</h3>
            <p className="mt-1 text-xs text-app-muted">{t("qt.otherHint")}</p>
            <textarea
              value={quoteFooterCustom}
              onChange={(e) => setQuoteFooterCustom(e.target.value)}
              placeholder={t("qt.otherPh")}
              rows={5}
              className="mt-2 w-full rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm text-app-text"
            />
          </section>
        </div>

        <aside className="flex min-h-[min(52vh,560px)] shrink-0 flex-col gap-2 border-t border-app-line-subtle pt-4 lg:min-h-0 lg:w-[min(46%,560px)] lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-app-text">{t("qt.previewTitle")}</h3>
            <span className="text-xs text-app-muted">{t("qt.previewPages", { n: estPages })}</span>
          </div>
          {previewErr ? (
            <div className="rounded border border-app-danger-border bg-app-danger-bg px-2 py-2 text-xs text-app-danger-text">
              {previewErr}
            </div>
          ) : null}
          <div className="relative min-h-[min(52vh,560px)] flex-1 overflow-hidden rounded-xl border border-app-line-strong bg-app-surface shadow-inner lg:min-h-0">
            {previewUrl ? (
              <iframe title={t("qt.previewIframeTitle")} src={previewUrl} className="absolute inset-0 h-full w-full bg-app-surface-2" />
            ) : (
              <div className="flex h-full min-h-[min(52vh,560px)] items-center justify-center text-sm text-app-muted lg:min-h-0">
                {t("qt.previewLoading")}
              </div>
            )}
          </div>
        </aside>
      </div>

      {manualHw ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-app-line-strong bg-app-panel-bg p-4 shadow-xl">
            <div className="text-sm font-semibold text-app-text">{t("qt.manualTitle")}</div>
            <div className="mt-1 text-xs text-app-muted">{manualHw.hardwareName}</div>
            <div className="mt-4 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="qm" checked={manualMode === "none"} onChange={() => setManualMode("none")} />
                {t("qt.manualNone")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="qm"
                  checked={manualMode === "overrideTotal"}
                  onChange={() => setManualMode("overrideTotal")}
                />
                {t("qt.manualOverrideTotal")}
              </label>
              {manualMode === "overrideTotal" ? (
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={manualOverrideStr}
                  onChange={(e) => setManualOverrideStr(e.target.value)}
                  className="ml-6 w-full rounded border border-app-line-strong bg-app-surface-2 px-2 py-1 text-sm"
                />
              ) : null}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="qm"
                  checked={manualMode === "overrideUnit"}
                  onChange={() => setManualMode("overrideUnit")}
                />
                {t("qt.manualOverrideUnit")}
              </label>
              {manualMode === "overrideUnit" ? (
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={manualUnitStr}
                  onChange={(e) => setManualUnitStr(e.target.value)}
                  className="ml-6 w-full rounded border border-app-line-strong bg-app-surface-2 px-2 py-1 text-sm"
                />
              ) : null}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="qm"
                  checked={manualMode === "discount"}
                  onChange={() => setManualMode("discount")}
                />
                {t("qt.manualDiscount")}
              </label>
              {manualMode === "discount" ? (
                <input
                  type="number"
                  min={0.1}
                  max={99.9}
                  step={0.1}
                  value={manualDiscountStr}
                  onChange={(e) => setManualDiscountStr(e.target.value)}
                  className="ml-6 w-full rounded border border-app-line-strong bg-app-surface-2 px-2 py-1 text-sm"
                />
              ) : null}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setManualHwId(null)}
                className="rounded-lg border border-app-line-mid px-3 py-1.5 text-sm text-app-muted hover:bg-app-surface-2"
              >
                {t("qt.manualCancel")}
              </button>
              <button
                type="button"
                onClick={applyManualModal}
                className="rounded-lg bg-app-primary px-3 py-1.5 text-sm font-medium text-app-on-primary hover:bg-app-primary-hover"
              >
                {t("qt.manualApply")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
