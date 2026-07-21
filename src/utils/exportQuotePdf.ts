import { jsPDF } from "jspdf";
import type {
  AssociationRow,
  CustomPlanServiceLine,
  CustomPlanSoftwareLine,
  HardwarePlacement,
  MaterialCategoryDef,
  MaterialPage,
  QuotePdfExportStyle,
  QuotePriceTier,
  QuoteTemplateBlock,
  QuoteTemplateTableColumn,
  SavedQuoteTemplate,
  ServiceRow,
  SoftwareFeatureRow,
  UiLocale,
} from "../types";
import {
  customPlanServiceEffectiveTotal,
  customPlanSoftwareEffectiveTotal,
  servicePickAddonUnitSlices,
  servicePickCoreUnitPrice,
  servicePickLineTotal,
  softwarePickAddonUnitSlices,
  softwarePickCoreUnitPrice,
  softwarePickLineTotal,
} from "./customPlanPickTotals";
import { softwareBillingMode } from "./softwareBilling";
import { hexToRgbTuple } from "../theme/quotePdfStyle";
import {
  associationQuoteEffectiveQty,
  associationQuoteLineScaledNoDiscount,
  associationQuoteLineTotal,
  formatMoneyAmount,
  normalizeAssociationRow,
} from "./hardwareOptionsAddons";
import { formatNetAfterDiscountDisplay } from "./quoteNetDisplay";
import { ensurePdfUnicodeFont, setQuotePdfFont } from "./quotePdfFonts";
import {
  pdfHardwareProductBody,
  pdfServiceScheduleProductBody,
  pdfSoftwareScheduleProductBody,
  pdfSoftwareScheduleProductBodyRecurring,
} from "./quotePdfLocaleStrings";
import {
  serviceLineSpecOptionPart,
  softwareLineSpecOptionPart,
} from "./customPlanLineSpecSummary";
import { firstLinkedMaterial } from "./associationMaterials";

const A4_W = 210;
const A4_H = 297;
const M = 12;

export type QuotePdfBuildInput = {
  projectTitle: string;
  associations: AssociationRow[];
  placements: HardwarePlacement[];
  materialsById: Map<string, MaterialPage>;
  categoryDefs: MaterialCategoryDef[];
  /** 企业库软件定义（与 customPlanSoftwareLines 联用） */
  softwareFeatures?: SoftwareFeatureRow[];
  serviceItems?: ServiceRow[];
  customPlanSoftwareLines?: CustomPlanSoftwareLine[];
  customPlanServiceLines?: CustomPlanServiceLine[];
  quoteFooterCustom: string;
  pdfStyle: QuotePdfExportStyle;
  companyLogoDataUrl: string | null;
  companyName: string;
  companyTagline: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  /** 控制封面与汇总表用语（澳洲报价式英文 / 中文） */
  uiLocale?: UiLocale;
  quoteGlobalPriceTier?: QuotePriceTier;
  companyCatalogCurrency?: string;
  /** 列表价展示乘数（与报价页 fmtCatalog 一致） */
  companyCatalogFxMultiplier?: number;
  /** 若提供且含 blocks，则 PDF 首页按无代码模板渲染（其后仍追加标准汇总表页） */
  quotePdfLayoutTemplate?: SavedQuoteTemplate | null;
  /** 报价参考号，格式 `PisellYYYYMMDD###` */
  quotationRef?: string | null;
  /** 汇总表硬件行是否附带产品缩略图（列宽自适应） */
  includeProductImages?: boolean;
};

function tableRemark(row: AssociationRow) {
  const q = (row.quoteTableNote ?? "").trim();
  if (q) return q;
  return (row.note ?? "").trim();
}

function imgFmt(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}

function pdfPalette(st: QuotePdfExportStyle) {
  const accentRgb = hexToRgbTuple(st.accentColor);
  const mutedRgb = hexToRgbTuple(st.mutedColor);
  const summaryHeaderFill = hexToRgbTuple(st.tableHeaderFill);
  const summaryGrid = hexToRgbTuple(st.tableGridColor);
  const hardwareBanner = hexToRgbTuple(st.hardwareBannerFill);
  return { accentRgb, mutedRgb, summaryHeaderFill, summaryGrid, hardwareBanner };
}

const GST_RATE = 0.1;

/** 报价单 / 汇总表用语（PDF 与 Excel 导出共用） */
export function quotePdfLocale(locale: UiLocale | undefined) {
  const zh = locale === "zh";
  return {
    docTitle: zh ? "报价单" : "QUOTATION",
    coverBlurb: zh ? "本文件为正式报价单（含封面与费用明细表）。" : "Formal quotation — cover and schedule of fees (ex GST).",
    scheduleTitle: zh ? "报价汇总表" : "SCHEDULE OF FEES (EX GST)",
    metaHwCount: zh ? "硬件条目" : "Hardware lines",
    thNo: zh ? "序号" : "#",
    thDesc: zh ? "设备型号" : "Description",
    thQty: zh ? "数量" : "Qty",
    thOrig: zh ? "原价" : "List",
    thDisc: zh ? "折扣" : "Disc.",
    thNet: zh ? "现价" : "Net",
    /** 汇总表（GST）页：五列明细 */
    thImage: zh ? "图" : "Img",
    thProductName: zh ? "产品名" : "Product",
    thUnitPrice: zh ? "单价" : "Unit price",
    thLineTotalCatalog: zh ? "总价" : "Total",
    thNetAfterDisc: zh ? "折扣后金额" : "Net after discount",
    thRem: zh ? "备注" : "Notes",
    emptyHw: zh ? "（当前无硬件明细，可在「硬件库」中添加）" : "(No hardware lines yet.)",
    sectionHw: zh ? "硬件" : "Hardware",
    sectionSw: zh ? "软件" : "Software",
    sectionSwOneTime: zh ? "软件（一次性）" : "Software (one-time)",
    sectionSwMonthly: zh ? "软件（按月）" : "Software (monthly)",
    sectionSwYearly: zh ? "软件（按年）" : "Software (annual)",
    recurringExclNote: zh ? "以下不计入上方不含 GST 小计。" : "Excluded from the ex-GST subtotal above.",
    sectionSv: zh ? "服务" : "Services",
    /** 按月 / 按年区块末尾合计（仍不计入上方 GST 小计） */
    swMoSubtotal: zh ? "按月合计（未含 GST）" : "Monthly recurring total (ex GST)",
    swYrSubtotal: zh ? "按年合计（未含 GST）" : "Annual recurring total (ex GST)",
    subEx: zh ? "小计（未含 GST）" : "Subtotal (ex GST)",
    gstLabel: zh ? `GST（${GST_RATE * 100}%）` : `GST (${GST_RATE * 100}%)`,
    totalInc: zh ? "合计（含 GST）" : "Total (inc GST)",
    otherTitle: zh ? "其他说明（自定义）" : "Terms & additional notes",
    quoteRef: zh ? "报价参考" : "Quote ref.",
    quoteDate: zh ? "日期" : "Date",
    /** 文末按月费用三行汇总（区别于表内按月小计行） */
    monthlyClosingHeading: zh ? "按月付费一览" : "Monthly recurring charges",
    monthlyRecurringSubEx: zh ? "按月金额（未含 GST）" : "Monthly amount (ex GST)",
    monthlyRecurringGst: zh ? `按月部分 GST（${GST_RATE * 100}%）` : `GST (${GST_RATE * 100}%) on monthly`,
    monthlyRecurringDue: zh ? "按月应付（含 GST）" : "Monthly due (inc GST)",
    docEndMarker: zh ? "— 文档结束 —" : "— End of quotation —",
  } as const;
}

function drawCoverPage(pdf: jsPDF, opts: QuotePdfBuildInput) {
  const L = quotePdfLocale(opts.uiLocale);
  const st = pdfPalette(opts.pdfStyle);
  const innerW = A4_W - 2 * M;
  const decor = opts.pdfStyle.coverDecor;

  if (decor === "frame") {
    pdf.setDrawColor(st.summaryGrid[0], st.summaryGrid[1], st.summaryGrid[2]);
    pdf.setLineWidth(0.35);
    pdf.rect(M, M, innerW, 78);
  } else if (decor === "topBar") {
    pdf.setFillColor(st.accentRgb[0], st.accentRgb[1], st.accentRgb[2]);
    pdf.rect(0, 0, A4_W, 3.5, "F");
  }

  let blockLeft = M;
  const blockTop = M + 6;
  const blockRight = M + innerW;

  if (opts.companyLogoDataUrl) {
    try {
      const fmt = imgFmt(opts.companyLogoDataUrl);
      const { w: logoW, h: logoH } = imageDisplaySizeMm(pdf, opts.companyLogoDataUrl, innerW, 0.22, 18);
      pdf.addImage(opts.companyLogoDataUrl, fmt, blockLeft, blockTop, logoW, logoH, undefined, "FAST");
      blockLeft = blockLeft + logoW + 4;
    } catch {
      /* skip broken logo */
    }
  }

  pdf.setFontSize(11);
  pdf.setTextColor(st.accentRgb[0], st.accentRgb[1], st.accentRgb[2]);
  const cn = (opts.companyName ?? "").trim();
  if (cn) {
    pdf.text(cn, blockLeft, blockTop + 5);
  }
  pdf.setFontSize(8.5);
  pdf.setTextColor(st.mutedRgb[0], st.mutedRgb[1], st.mutedRgb[2]);
  let ly = blockTop + 9;
  const tag = (opts.companyTagline ?? "").trim();
  if (tag) {
    pdf.text(tag, blockLeft, ly);
    ly += 4;
  }
  const addr = (opts.companyAddress ?? "").trim();
  if (addr) {
    const lines = pdf.splitTextToSize(addr, blockRight - blockLeft);
    pdf.text(lines, blockLeft, ly);
    ly += lines.length * 3.6 + 1;
  }
  const bits: string[] = [];
  if ((opts.companyPhone ?? "").trim()) bits.push(`Tel ${opts.companyPhone!.trim()}`);
  if ((opts.companyEmail ?? "").trim()) bits.push(opts.companyEmail!.trim());
  if (bits.length) {
    pdf.text(bits.join("  ·  "), blockLeft, ly);
    ly += 4;
  }
  if ((opts.companyWebsite ?? "").trim()) {
    pdf.text(opts.companyWebsite!.trim(), blockLeft, ly);
  }

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(17);
  pdf.text(L.docTitle, M, 50);
  pdf.setFontSize(12);
  pdf.setTextColor(60, 60, 60);
  const titleLines = pdf.splitTextToSize(opts.projectTitle || (opts.uiLocale === "zh" ? "未命名项目" : "Untitled project"), innerW);
  pdf.text(titleLines, M, 58);
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(10);
  const yMeta = 58 + titleLines.length * 6 + 4;
  pdf.setFontSize(9);
  pdf.setTextColor(80, 90, 105);
  const ref = (opts.quotationRef ?? "").trim() || "—";
  const d = new Date().toLocaleDateString(opts.uiLocale === "zh" ? "zh-CN" : "en-AU");
  pdf.text(`${L.quoteRef}: ${ref}    ${L.quoteDate}: ${d}`, M, yMeta);
  pdf.text(L.coverBlurb, M, yMeta + 5);
  pdf.setTextColor(0, 0, 0);
}

type SummaryCatalog = {
  softwareFeatures: SoftwareFeatureRow[];
  serviceItems: ServiceRow[];
  customPlanSoftwareLines: CustomPlanSoftwareLine[];
  customPlanServiceLines: CustomPlanServiceLine[];
};

function appendQuoteSummaryAndFooter(
  pdf: jsPDF,
  associations: AssociationRow[],
  placements: HardwarePlacement[],
  quoteFooterCustom: string,
  pdfStyle: QuotePdfExportStyle,
  catalog: SummaryCatalog,
  uiLocale: UiLocale | undefined,
  quoteGlobalPriceTier: QuotePriceTier,
  catalogCurrency: string,
  materials: MaterialPage[],
  categoryDefs: MaterialCategoryDef[],
  includeProductImages = false,
) {
  const L = quotePdfLocale(uiLocale);
  const cur = (catalogCurrency || "AUD").toUpperCase();
  const fmtMoney = (n: number) => formatMoneyAmount(n, cur);
  const st = pdfPalette(pdfStyle);
  const tableLine = pdfStyle.coverDecor === "frame" ? 0.25 : 0.2;
  pdf.setFontSize(14);
  pdf.setTextColor(20, 24, 31);
  pdf.text(L.scheduleTitle, M, 22);
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);

  const innerW = A4_W - 2 * M;
  const wThumb = includeProductImages ? 15 : 0;
  const wUnit = 22;
  const wQty = 12;
  const wTot = 24;
  const wNet = Math.max(28, includeProductImages ? 28 : 30);
  const wModel = Math.max(26, innerW - wThumb - wUnit - wQty - wTot - wNet);
  const ws = includeProductImages ? [wThumb, wModel, wUnit, wQty, wTot, wNet] : [wModel, wUnit, wQty, wTot, wNet];
  const lineH = 4.2;
  const pad = 1;

  const drawHeader = (yTop: number) => {
    pdf.setFillColor(st.summaryHeaderFill[0], st.summaryHeaderFill[1], st.summaryHeaderFill[2]);
    pdf.rect(M, yTop - 4, innerW, 8.5, "F");
    pdf.setDrawColor(st.summaryGrid[0], st.summaryGrid[1], st.summaryGrid[2]);
    pdf.setLineWidth(tableLine);
    let x = M;
    const heads = includeProductImages
      ? [L.thImage, L.thProductName, L.thUnitPrice, L.thQty, L.thLineTotalCatalog, L.thNetAfterDisc]
      : [L.thProductName, L.thUnitPrice, L.thQty, L.thLineTotalCatalog, L.thNetAfterDisc];
    pdf.setFontSize(8.5);
    for (let i = 0; i < heads.length; i++) {
      pdf.rect(x, yTop - 4, ws[i], 8.5);
      pdf.text(heads[i], x + pad, yTop + 0.8);
      x += ws[i];
    }
  };

  let y = 32;
  drawHeader(y);
  y += 11;

  const ensureSpace = (need: number) => {
    if (y + need > A4_H - M) {
      pdf.addPage();
      y = M + 6;
      drawHeader(y);
      y += 11;
    }
  };

  const assocSchedule = associations
    .map((row) => normalizeAssociationRow(row))
    .filter((r) => associationQuoteEffectiveQty(r, placements) > 0);

  if (assocSchedule.length > 0) {
    ensureSpace(14);
    setQuotePdfFont(pdf, "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(st.accentRgb[0], st.accentRgb[1], st.accentRgb[2]);
    pdf.text(L.sectionHw, M, y + 4);
    y += 10;
    setQuotePdfFont(pdf, "normal");
    pdf.setTextColor(0, 0, 0);
  }

  if (!assocSchedule.length) {
    ensureSpace(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text(L.emptyHw, M + 2, y + 4);
    y += 10;
    pdf.setTextColor(0, 0, 0);
  }

  let sum = 0;

  const paintCatalogPriceRow = (
    model: string,
    unitStr: string,
    qtyStr: string,
    listStr: string,
    netParenStr: string,
    gstPiece: number,
    rem: string,
    countTowardGstSubtotal: boolean,
    thumbDataUrl: string | null = null,
  ) => {
    if (countTowardGstSubtotal) sum += gstPiece;
    const modelBlock =
      rem.trim() && rem.trim() !== "—"
        ? `${model}\n${rem.trim()}`
        : model;
    pdf.setFontSize(9);
    const modelLines = pdf.splitTextToSize(modelBlock, wModel - 2 * pad);
    const unitLines = pdf.splitTextToSize(unitStr, wUnit - 2 * pad);
    const qtyLines = pdf.splitTextToSize(qtyStr, wQty - 2 * pad);
    const listLines = pdf.splitTextToSize(listStr, wTot - 2 * pad);
    const netLines = pdf.splitTextToSize(netParenStr, wNet - 2 * pad);
    const textCols = [modelLines, unitLines, qtyLines, listLines, netLines];
    const thumbMinH = includeProductImages && thumbDataUrl ? 14 : 0;
    const rowH = Math.max(
      thumbMinH,
      Math.max(
        8,
        Math.max(
          modelLines.length,
          unitLines.length,
          qtyLines.length,
          listLines.length,
          netLines.length,
        ) *
          lineH +
          3,
      ),
    );

    ensureSpace(rowH + 2);

    pdf.setDrawColor(st.summaryGrid[0], st.summaryGrid[1], st.summaryGrid[2]);
    let x = M;
    if (includeProductImages) {
      pdf.rect(x, y, ws[0], rowH);
      if (thumbDataUrl) {
        try {
          const fmt = imgFmt(thumbDataUrl);
          const prop = pdf.getImageProperties(thumbDataUrl);
          const maxBox = Math.min(ws[0] - 2 * pad, rowH - 2 * pad);
          const ratio = prop.height / prop.width;
          let imgW = maxBox;
          let imgH = imgW * ratio;
          if (imgH > maxBox) {
            imgH = maxBox;
            imgW = imgH / ratio;
          }
          const ix = x + (ws[0] - imgW) / 2;
          const iy = y + (rowH - imgH) / 2;
          pdf.addImage(thumbDataUrl, fmt, ix, iy, imgW, imgH, undefined, "FAST");
        } catch {
          /* skip */
        }
      }
      x += ws[0];
    }
    for (let c = 0; c < textCols.length; c++) {
      const wi = ws[includeProductImages ? c + 1 : c];
      pdf.rect(x, y, wi, rowH);
      let ty = y + 4;
      for (const line of textCols[c]) {
        pdf.text(line, x + pad, ty);
        ty += lineH;
      }
      x += wi;
    }
    y += rowH;
  };

  assocSchedule.forEach((r) => {
    const model = pdfHardwareProductBody(r, uiLocale, materials, categoryDefs);
    const qn = associationQuoteEffectiveQty(r, placements);
    const qty = String(qn);
    const listCatalog = associationQuoteLineScaledNoDiscount(r, placements, quoteGlobalPriceTier);
    const unitPrice = qn > 0 ? listCatalog / qn : 0;
    const lineTotal = associationQuoteLineTotal(r, placements, quoteGlobalPriceTier);
    const hasOv =
      (typeof r.quoteLineTotalOverride === "number" &&
        Number.isFinite(r.quoteLineTotalOverride) &&
        r.quoteLineTotalOverride >= 0) ||
      (typeof r.quoteLineUnitPriceOverride === "number" &&
        Number.isFinite(r.quoteLineUnitPriceOverride) &&
        r.quoteLineUnitPriceOverride >= 0);
    const pctParen = hasOv ? null : r.quoteLineDiscountPct;
    const netParenStr = formatNetAfterDiscountDisplay(lineTotal, listCatalog, pctParen, fmtMoney, uiLocale);
    const mat = includeProductImages ? firstLinkedMaterial(r, materials) : null;
    const thumb = mat?.dataUrl?.trim() ? mat.dataUrl : null;
    paintCatalogPriceRow(
      model,
      fmtMoney(unitPrice),
      qty,
      fmtMoney(listCatalog),
      netParenStr,
      lineTotal,
      tableRemark(r),
      true,
      thumb,
    );
  });

  const { softwareFeatures, serviceItems, customPlanSoftwareLines, customPlanServiceLines } = catalog;
  const featById = new Map(softwareFeatures.map((f) => [f.id, f]));
  const svcById = new Map(serviceItems.map((s) => [s.id, s]));

  const drawCatalogRow = (
    model: string,
    unitStr: string,
    qtyStr: string,
    listStr: string,
    netParenStr: string,
    gstPiece: number,
    rem: string,
    countTowardGstSubtotal = true,
    thumbDataUrl: string | null = null,
  ) => {
    paintCatalogPriceRow(model, unitStr, qtyStr, listStr, netParenStr, gstPiece, rem, countTowardGstSubtotal, thumbDataUrl);
  };

  /** PDF 分项：第一行为基础（规格底价×数量），后续每行一条 Add-on */
  const addonIndent = uiLocale === "zh" ? "　· " : "  · ";

  const drawSoftwareLineSplitToPdf = (
    fullModel: string,
    line: CustomPlanSoftwareLine,
    f: SoftwareFeatureRow,
    countTowardGst: boolean,
  ) => {
    const q = Math.floor(Number(line.quantity));
    const autoTotal = softwarePickLineTotal(f, line);
    const effective = customPlanSoftwareEffectiveTotal(f, line);
    const optPart = softwareLineSpecOptionPart(f, line);
    const note = (f.note ?? "").trim();
    const lineNote = (line.quoteLineNote ?? "").trim();
    const baseRemParts = lineNote
      ? [lineNote]
      : [optPart !== "—" ? optPart : "", note].filter(Boolean);
    const baseRem = baseRemParts.filter(Boolean).join(" · ") || "—";

    const hasOverride =
      line.lineTotalOverride !== null &&
      line.lineTotalOverride !== undefined &&
      typeof line.lineTotalOverride === "number" &&
      Number.isFinite(line.lineTotalOverride) &&
      line.lineTotalOverride >= 0;

    const unitMain = q > 0 ? fmtMoney(autoTotal / q) : fmtMoney(0);
    const netParenLine = formatNetAfterDiscountDisplay(effective, autoTotal, null, fmtMoney, uiLocale);

    if (hasOverride) {
      drawCatalogRow(fullModel, unitMain, String(q), fmtMoney(autoTotal), netParenLine, effective, baseRem, countTowardGst);
      return;
    }

    const coreTotal = q * softwarePickCoreUnitPrice(f, line);
    const slices = softwarePickAddonUnitSlices(f, line);
    drawCatalogRow(fullModel, unitMain, String(q), fmtMoney(autoTotal), netParenLine, coreTotal, baseRem, countTowardGst);
    for (const sl of slices) {
      const amt = q * sl.unitAmount;
      drawCatalogRow(`${addonIndent}${sl.label}`, "—", "—", fmtMoney(amt), fmtMoney(amt), amt, "—", countTowardGst);
    }
  };

  const drawServiceLineSplitToPdf = (
    fullModel: string,
    line: CustomPlanServiceLine,
    sv: ServiceRow,
    countTowardGst: boolean,
  ) => {
    const q = Math.floor(Number(line.quantity));
    const autoTotal = servicePickLineTotal(sv, line);
    const effective = customPlanServiceEffectiveTotal(sv, line);
    const optPart = serviceLineSpecOptionPart(sv, line);
    const note = (sv.note ?? "").trim();
    const lineNote = (line.quoteLineNote ?? "").trim();
    const baseRemParts = lineNote
      ? [lineNote]
      : [optPart !== "—" ? optPart : "", note].filter(Boolean);
    const baseRem = baseRemParts.filter(Boolean).join(" · ") || "—";

    const hasOverride =
      line.lineTotalOverride !== null &&
      line.lineTotalOverride !== undefined &&
      typeof line.lineTotalOverride === "number" &&
      Number.isFinite(line.lineTotalOverride) &&
      line.lineTotalOverride >= 0;

    const unitMain = q > 0 ? fmtMoney(autoTotal / q) : fmtMoney(0);
    const netParenLine = formatNetAfterDiscountDisplay(effective, autoTotal, null, fmtMoney, uiLocale);

    if (hasOverride) {
      drawCatalogRow(fullModel, unitMain, String(q), fmtMoney(autoTotal), netParenLine, effective, baseRem, countTowardGst);
      return;
    }

    const coreTotal = q * servicePickCoreUnitPrice(sv, line);
    const slices = servicePickAddonUnitSlices(sv, line);
    drawCatalogRow(fullModel, unitMain, String(q), fmtMoney(autoTotal), netParenLine, coreTotal, baseRem, countTowardGst);
    for (const sl of slices) {
      const amt = q * sl.unitAmount;
      drawCatalogRow(`${addonIndent}${sl.label}`, "—", "—", fmtMoney(amt), fmtMoney(amt), amt, "—", countTowardGst);
    }
  };

  const swLinesActive = customPlanSoftwareLines.filter((line) => {
    const f = featById.get(line.catalogFeatureId);
    if (!f?.featureName.trim()) return false;
    const q = Math.floor(Number(line.quantity));
    return Number.isFinite(q) && q > 0;
  });
  const swScheduleOneTime = swLinesActive.filter((line) => {
    const f = featById.get(line.catalogFeatureId)!;
    return softwareBillingMode(f) === "one_time";
  });
  const swScheduleMonthly = swLinesActive.filter((line) => {
    const f = featById.get(line.catalogFeatureId)!;
    return softwareBillingMode(f) === "monthly";
  });
  const swScheduleYearly = swLinesActive.filter((line) => {
    const f = featById.get(line.catalogFeatureId)!;
    return softwareBillingMode(f) === "yearly";
  });
  const svSchedule = customPlanServiceLines.filter((line) => {
    const sv = svcById.get(line.catalogServiceId);
    if (!sv?.serviceName.trim()) return false;
    const q = Math.floor(Number(line.quantity));
    return Number.isFinite(q) && q > 0;
  });

  if (swScheduleOneTime.length > 0 || svSchedule.length > 0) {
    if (swScheduleOneTime.length > 0) {
      ensureSpace(14);
      setQuotePdfFont(pdf, "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(st.accentRgb[0], st.accentRgb[1], st.accentRgb[2]);
      pdf.text(L.sectionSwOneTime, M, y + 4);
      y += 10;
      setQuotePdfFont(pdf, "normal");
      pdf.setTextColor(0, 0, 0);
    }
    for (const line of swScheduleOneTime) {
      const f = featById.get(line.catalogFeatureId)!;
      const cat = (f.featureCategory ?? "").trim();
      const model = pdfSoftwareScheduleProductBody(f.featureName, cat, uiLocale, categoryDefs);
      drawSoftwareLineSplitToPdf(model, line, f, true);
    }
    if (svSchedule.length > 0) {
      ensureSpace(14);
      setQuotePdfFont(pdf, "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(st.accentRgb[0], st.accentRgb[1], st.accentRgb[2]);
      pdf.text(L.sectionSv, M, y + 4);
      y += 10;
      setQuotePdfFont(pdf, "normal");
      pdf.setTextColor(0, 0, 0);
    }
    for (const line of svSchedule) {
      const sv = svcById.get(line.catalogServiceId)!;
      const cat = (sv.serviceCategory ?? "").trim();
      const model = pdfServiceScheduleProductBody(sv.serviceName, cat, uiLocale, categoryDefs);
      drawServiceLineSplitToPdf(model, line, sv, true);
    }
  }

  const subEx = sum;
  const gstAmt = subEx * GST_RATE;
  const totalInc = subEx + gstAmt;
  ensureSpace(34);
  pdf.setDrawColor(st.summaryGrid[0], st.summaryGrid[1], st.summaryGrid[2]);
  pdf.setLineWidth(0.2);
  pdf.line(M, y, M + innerW, y);
  y += 6;

  /** jsPDF：`align: \"right\"` 时 x 为金额右边缘，与左侧标签同一基线对齐 */
  const amtRight = M + innerW;
  let tyGst = y + 4;
  const gstSummaryRow = (labelNoColon: string, amount: number, mode: "normal" | "emphasis") => {
    pdf.setFontSize(mode === "emphasis" ? 11 : 10);
    setQuotePdfFont(pdf, mode === "emphasis" ? "bold" : "normal");
    pdf.setTextColor(
      mode === "emphasis" ? 15 : 30,
      mode === "emphasis" ? 23 : 41,
      mode === "emphasis" ? 42 : 59,
    );
    const lbl = `${labelNoColon}:`;
    pdf.text(lbl, M, tyGst);
    pdf.text(fmtMoney(amount), amtRight, tyGst, { align: "right", baseline: "alphabetic" });
    tyGst += 6.2;
  };
  gstSummaryRow(L.subEx, subEx, "normal");
  gstSummaryRow(L.gstLabel, gstAmt, "normal");
  gstSummaryRow(L.totalInc, totalInc, "emphasis");
  y = tyGst + 5;
  setQuotePdfFont(pdf, "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);

  /** 按月/按年区块末尾：合计行（序号列「—」，不计入 GST 小计） */
  const drawRecurringSubtotalRow = (labelText: string, amount: number) => {
    const priceStr = fmtMoney(amount);
    pdf.setFontSize(9);
    setQuotePdfFont(pdf, "bold");
    const labelLines = pdf.splitTextToSize(labelText, wModel - 2 * pad);
    const netLines = pdf.splitTextToSize(priceStr, wNet - 2 * pad);
    const rowH = Math.max(8, Math.max(labelLines.length, netLines.length) * lineH + 3);
    ensureSpace(rowH + 2);
    pdf.setDrawColor(st.summaryGrid[0], st.summaryGrid[1], st.summaryGrid[2]);
    pdf.setTextColor(30, 41, 59);
    let x = M;
    if (includeProductImages) {
      pdf.rect(x, y, ws[0], rowH);
      x += ws[0];
    }
    const textCols: string[][] = [labelLines, [["—"]], [["—"]], [["—"]], netLines];
    for (let c = 0; c < textCols.length; c++) {
      const wi = ws[includeProductImages ? c + 1 : c];
      pdf.rect(x, y, wi, rowH);
      let ty = y + 4;
      for (const line of textCols[c]) {
        pdf.text(line, x + pad, ty);
        ty += lineH;
      }
      x += wi;
    }
    y += rowH;
    setQuotePdfFont(pdf, "normal");
    pdf.setTextColor(0, 0, 0);
  };

  const drawRecurringSoftwareBlock = (
    lines: typeof customPlanSoftwareLines,
    sectionTitle: string,
    moOrYr: "monthly" | "yearly",
  ) => {
    if (lines.length === 0) return;
    ensureSpace(18);
    setQuotePdfFont(pdf, "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(st.mutedRgb[0], st.mutedRgb[1], st.mutedRgb[2]);
    pdf.text(L.recurringExclNote, M, y + 4);
    y += 8;
    setQuotePdfFont(pdf, "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(st.accentRgb[0], st.accentRgb[1], st.accentRgb[2]);
    pdf.text(sectionTitle, M, y + 4);
    y += 10;
    setQuotePdfFont(pdf, "normal");
    pdf.setTextColor(0, 0, 0);

    let blockSum = 0;
    for (const line of lines) {
      const f = featById.get(line.catalogFeatureId)!;
      blockSum += customPlanSoftwareEffectiveTotal(f, line);
      const cat = (f.featureCategory ?? "").trim();
      const prefix =
        uiLocale === "zh"
          ? moOrYr === "monthly"
            ? "[按月]"
            : "[按年]"
          : moOrYr === "monthly"
            ? "[Monthly]"
            : "[Annual]";
      const model = pdfSoftwareScheduleProductBodyRecurring(f.featureName, cat, prefix, uiLocale, categoryDefs);
      drawSoftwareLineSplitToPdf(model, line, f, false);
    }
    const subLabel = moOrYr === "monthly" ? L.swMoSubtotal : L.swYrSubtotal;
    drawRecurringSubtotalRow(subLabel, blockSum);
  };

  drawRecurringSoftwareBlock(swScheduleMonthly, L.sectionSwMonthly, "monthly");
  drawRecurringSoftwareBlock(swScheduleYearly, L.sectionSwYearly, "yearly");

  let monthlyFeesGrandTotal = 0;
  for (const line of swScheduleMonthly) {
    const f = featById.get(line.catalogFeatureId)!;
    monthlyFeesGrandTotal += customPlanSoftwareEffectiveTotal(f, line);
  }
  if (monthlyFeesGrandTotal > 0.004) {
    const gstMonthly = monthlyFeesGrandTotal * GST_RATE;
    const monthlyInc = monthlyFeesGrandTotal + gstMonthly;
    ensureSpace(40);
    pdf.setDrawColor(st.summaryGrid[0], st.summaryGrid[1], st.summaryGrid[2]);
    pdf.setLineWidth(0.15);
    pdf.line(M, y, M + innerW, y);
    y += 6;
    setQuotePdfFont(pdf, "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(st.accentRgb[0], st.accentRgb[1], st.accentRgb[2]);
    const mh = L.monthlyClosingHeading;
    pdf.text(mh, textXForAlign("center", M, innerW, mh, pdf), y + 4);
    y += 10;
    setQuotePdfFont(pdf, "normal");
    pdf.setTextColor(30, 41, 59);
    let tyMo = y + 3;
    const monthlyRow = (labelNoColon: string, amount: number, mode: "normal" | "emphasis") => {
      pdf.setFontSize(mode === "emphasis" ? 11 : 10);
      setQuotePdfFont(pdf, mode === "emphasis" ? "bold" : "normal");
      pdf.setTextColor(
        mode === "emphasis" ? 15 : 30,
        mode === "emphasis" ? 23 : 41,
        mode === "emphasis" ? 42 : 59,
      );
      pdf.text(`${labelNoColon}:`, M, tyMo);
      pdf.text(fmtMoney(amount), amtRight, tyMo, { align: "right", baseline: "alphabetic" });
      tyMo += 6.2;
    };
    monthlyRow(L.monthlyRecurringSubEx, monthlyFeesGrandTotal, "normal");
    monthlyRow(L.monthlyRecurringGst, gstMonthly, "normal");
    monthlyRow(L.monthlyRecurringDue, monthlyInc, "emphasis");
    y = tyMo + 6;
    setQuotePdfFont(pdf, "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
  }

  const foot = (quoteFooterCustom ?? "").trim();
  if (foot) {
    ensureSpace(16);
    pdf.setFontSize(11);
    pdf.text(L.otherTitle, M, y);
    y += 6;
    pdf.setFontSize(9.5);
    pdf.setTextColor(55, 65, 81);
    const fl = pdf.splitTextToSize(foot, innerW);
    for (const line of fl) {
      ensureSpace(lineH + 1);
      pdf.text(line, M, y);
      y += lineH + 1.2;
    }
    pdf.setTextColor(0, 0, 0);
  }

  ensureSpace(14);
  pdf.setFontSize(8.5);
  setQuotePdfFont(pdf, "normal");
  pdf.setTextColor(140, 148, 163);
  const endLine = L.docEndMarker;
  pdf.text(endLine, textXForAlign("center", M, innerW, endLine, pdf), y + 4);
  y += 8;
  pdf.setTextColor(0, 0, 0);
}

const ALL_TEMPLATE_COLS: QuoteTemplateTableColumn[] = ["model", "qty", "price", "notes"];

type TemplatePdfRow = { model: string; qty: string; price: string; notes: string };

function computeQuoteSubtotalExGst(opts: QuotePdfBuildInput): number {
  const tier = opts.quoteGlobalPriceTier ?? "regular";
  let sum = 0;
  const assocSchedule = opts.associations
    .map((row) => normalizeAssociationRow(row))
    .filter((r) => associationQuoteEffectiveQty(r, opts.placements) > 0);
  for (const r of assocSchedule) {
    sum += associationQuoteLineTotal(r, opts.placements, tier);
  }
  const softwareFeatures = opts.softwareFeatures ?? [];
  const serviceItems = opts.serviceItems ?? [];
  const customPlanSoftwareLines = opts.customPlanSoftwareLines ?? [];
  const customPlanServiceLines = opts.customPlanServiceLines ?? [];
  const featById = new Map(softwareFeatures.map((f) => [f.id, f]));
  const svcById = new Map(serviceItems.map((s) => [s.id, s]));
  const swScheduleActive = customPlanSoftwareLines.filter((line) => {
    const f = featById.get(line.catalogFeatureId);
    if (!f?.featureName.trim()) return false;
    const q = Math.floor(Number(line.quantity));
    return Number.isFinite(q) && q > 0;
  });
  const svSchedule = customPlanServiceLines.filter((line) => {
    const sv = svcById.get(line.catalogServiceId);
    if (!sv?.serviceName.trim()) return false;
    const q = Math.floor(Number(line.quantity));
    return Number.isFinite(q) && q > 0;
  });
  for (const line of swScheduleActive) {
    const f = featById.get(line.catalogFeatureId)!;
    if (softwareBillingMode(f) !== "one_time") continue;
    sum += customPlanSoftwareEffectiveTotal(f, line);
  }
  for (const line of svSchedule) {
    const sv = svcById.get(line.catalogServiceId)!;
    sum += customPlanServiceEffectiveTotal(sv, line);
  }
  return sum;
}

function buildTemplateTableRows(opts: QuotePdfBuildInput): TemplatePdfRow[] {
  const tier = opts.quoteGlobalPriceTier ?? "regular";
  const cur = (opts.companyCatalogCurrency || "AUD").toUpperCase();
  const fmt = (n: number) => formatMoneyAmount(n, cur);
  const rows: TemplatePdfRow[] = [];
  const assocSchedule = opts.associations
    .map((row) => normalizeAssociationRow(row))
    .filter((r) => associationQuoteEffectiveQty(r, opts.placements) > 0);
  for (const r of assocSchedule) {
    const qn = associationQuoteEffectiveQty(r, opts.placements);
    const listCatalog = associationQuoteLineScaledNoDiscount(r, opts.placements, tier);
    const net = associationQuoteLineTotal(r, opts.placements, tier);
    const hasOv =
      (typeof r.quoteLineTotalOverride === "number" && Number.isFinite(r.quoteLineTotalOverride)) ||
      (typeof r.quoteLineUnitPriceOverride === "number" && Number.isFinite(r.quoteLineUnitPriceOverride));
    const pctParen = hasOv ? null : r.quoteLineDiscountPct;
    rows.push({
      model: pdfHardwareProductBody(r, opts.uiLocale, Array.from(opts.materialsById.values()), opts.categoryDefs),
      qty: String(qn),
      price: formatNetAfterDiscountDisplay(net, listCatalog, pctParen, fmt, opts.uiLocale),
      notes: tableRemark(r) || "—",
    });
  }
  const softwareFeatures = opts.softwareFeatures ?? [];
  const serviceItems = opts.serviceItems ?? [];
  const customPlanSoftwareLines = opts.customPlanSoftwareLines ?? [];
  const customPlanServiceLines = opts.customPlanServiceLines ?? [];
  const featById = new Map(softwareFeatures.map((f) => [f.id, f]));
  const svcById = new Map(serviceItems.map((s) => [s.id, s]));
  const uiLocale = opts.uiLocale;
  const swScheduleActive = customPlanSoftwareLines.filter((line) => {
    const f = featById.get(line.catalogFeatureId);
    if (!f?.featureName.trim()) return false;
    const q = Math.floor(Number(line.quantity));
    return Number.isFinite(q) && q > 0;
  });
  const addonIndTpl = uiLocale === "zh" ? "　· " : "  · ";

  const pushSoftwareTemplateRows = (
    line: (typeof customPlanSoftwareLines)[number],
    f: SoftwareFeatureRow,
    tag: string,
  ) => {
    const cat = (f.featureCategory ?? "").trim();
    const model = tag
      ? pdfSoftwareScheduleProductBodyRecurring(f.featureName, cat, tag, uiLocale, opts.categoryDefs)
      : pdfSoftwareScheduleProductBody(f.featureName, cat, uiLocale, opts.categoryDefs);
    const q = Math.floor(Number(line.quantity));
    const coreTotal = q * softwarePickCoreUnitPrice(f, line);
    const slices = softwarePickAddonUnitSlices(f, line);
    const optPart = softwareLineSpecOptionPart(f, line);
    const note = (f.note ?? "").trim();
    const baseRem =
      [optPart !== "—" ? optPart : "", note].filter(Boolean).join(" · ") || "—";
    rows.push({ model, qty: String(q), price: fmt(coreTotal), notes: baseRem });
    for (const sl of slices) {
      rows.push({
        model: `${addonIndTpl}${sl.label}`,
        qty: "—",
        price: fmt(q * sl.unitAmount),
        notes: "—",
      });
    }
  };
  for (const line of swScheduleActive) {
    const f = featById.get(line.catalogFeatureId)!;
    const mode = softwareBillingMode(f);
    if (mode === "one_time") pushSoftwareTemplateRows(line, f, "");
  }
  const svSchedule = customPlanServiceLines.filter((line) => {
    const sv = svcById.get(line.catalogServiceId);
    if (!sv?.serviceName.trim()) return false;
    const q = Math.floor(Number(line.quantity));
    return Number.isFinite(q) && q > 0;
  });
  for (const line of svSchedule) {
    const sv = svcById.get(line.catalogServiceId)!;
    const cat = (sv.serviceCategory ?? "").trim();
    const model = pdfServiceScheduleProductBody(sv.serviceName, cat, uiLocale, opts.categoryDefs);
    const q = Math.floor(Number(line.quantity));
    const coreTotal = q * servicePickCoreUnitPrice(sv, line);
    const slices = servicePickAddonUnitSlices(sv, line);
    const optPart = serviceLineSpecOptionPart(sv, line);
    const note = (sv.note ?? "").trim();
    const baseRem =
      [optPart !== "—" ? optPart : "", note].filter(Boolean).join(" · ") || "—";
    rows.push({ model, qty: String(q), price: fmt(coreTotal), notes: baseRem });
    for (const sl of slices) {
      rows.push({
        model: `${addonIndTpl}${sl.label}`,
        qty: "—",
        price: fmt(q * sl.unitAmount),
        notes: "—",
      });
    }
  }
  for (const line of swScheduleActive) {
    const f = featById.get(line.catalogFeatureId)!;
    const mode = softwareBillingMode(f);
    if (mode === "monthly") pushSoftwareTemplateRows(line, f, uiLocale === "zh" ? "[按月]" : "[Mo]");
  }
  for (const line of swScheduleActive) {
    const f = featById.get(line.catalogFeatureId)!;
    const mode = softwareBillingMode(f);
    if (mode === "yearly") pushSoftwareTemplateRows(line, f, uiLocale === "zh" ? "[按年]" : "[Yr]");
  }
  return rows;
}

function hexRgbForBlock(color: string | undefined): [number, number, number] {
  if (color && /^#[0-9A-Fa-f]{6}$/.test(color.trim())) return hexToRgbTuple(color);
  return [15, 23, 42];
}

function applyTemplateBlockStyle(pdf: jsPDF, b: QuoteTemplateBlock) {
  const rgb = hexRgbForBlock(b.style?.color);
  pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
  const px = b.style?.fontSizePx ?? 11;
  const pt = Math.min(24, Math.max(7, Math.round(px * 0.72)));
  pdf.setFontSize(pt);
  const w = b.style?.fontWeight;
  setQuotePdfFont(pdf, w === "700" || w === "600" ? "bold" : "normal");
}

function resetPdfTextStyle(pdf: jsPDF) {
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(10);
  setQuotePdfFont(pdf, "normal");
}

function textXForAlign(align: "left" | "center" | "right" | undefined, Mm: number, innerW: number, line: string, pdf: jsPDF) {
  const ta = align ?? "left";
  const w = pdf.getTextWidth(line);
  if (ta === "center") return Mm + (innerW - w) / 2;
  if (ta === "right") return Mm + innerW - w;
  return Mm;
}

/** 版心内放置块（图片等）：左 / 中 / 右对齐时的左上角 x（mm） */
function boxXForAlign(
  align: "left" | "center" | "right" | undefined,
  Mm: number,
  innerW: number,
  boxWmm: number,
): number {
  const ta = align ?? "left";
  if (ta === "center") return Mm + (innerW - boxWmm) / 2;
  if (ta === "right") return Mm + innerW - boxWmm;
  return Mm;
}

/** 按版心宽度比例缩放，保持宽高比（与 jsPDF getImageProperties 一致） */
function imageDisplaySizeMm(
  pdf: jsPDF,
  dataUrl: string,
  innerWmm: number,
  widthFrac: number | undefined,
  maxHeightMm: number | undefined | null,
): { w: number; h: number } {
  const frac = Math.min(1, Math.max(0.05, widthFrac ?? 1));
  const targetW = innerWmm * frac;
  let iw = 1;
  let ih = 1;
  try {
    const prop = pdf.getImageProperties(dataUrl);
    iw = Math.max(1, prop.width || 1);
    ih = Math.max(1, prop.height || 1);
  } catch {
    return { w: targetW, h: Math.min(targetW * 0.35, maxHeightMm ?? 55) };
  }
  let wMm = targetW;
  let hMm = (ih / iw) * targetW;
  if (maxHeightMm != null && maxHeightMm > 0 && hMm > maxHeightMm) {
    hMm = maxHeightMm;
    wMm = (iw / ih) * hMm;
  }
  return { w: wMm, h: hMm };
}

function drawQuoteTemplateFirstPages(pdf: jsPDF, opts: QuotePdfBuildInput, blocks: QuoteTemplateBlock[]) {
  const L = quotePdfLocale(opts.uiLocale);
  const st = pdfPalette(opts.pdfStyle);
  const innerW = A4_W - 2 * M;
  const cur = (opts.companyCatalogCurrency || "AUD").toUpperCase();
  const fmtMoney = (n: number) => formatMoneyAmount(n, cur);
  const decor = opts.pdfStyle.coverDecor;
  if (decor === "frame") {
    pdf.setDrawColor(st.summaryGrid[0], st.summaryGrid[1], st.summaryGrid[2]);
    pdf.setLineWidth(0.35);
    pdf.rect(M, M, innerW, 78);
  } else if (decor === "topBar") {
    pdf.setFillColor(st.accentRgb[0], st.accentRgb[1], st.accentRgb[2]);
    pdf.rect(0, 0, A4_W, 3.5, "F");
  }

  let y = M + 4;
  const needSpace = (h: number) => {
    if (y + h > A4_H - M) {
      pdf.addPage();
      y = M + 4;
    }
  };

  const tableRows = buildTemplateTableRows(opts);
  const subEx = computeQuoteSubtotalExGst(opts);
  const gstAmt = subEx * GST_RATE;
  const totalInc = subEx + gstAmt;

  const colLabel = (c: QuoteTemplateTableColumn): string => {
    if (c === "model") return L.thDesc;
    if (c === "qty") return L.thQty;
    if (c === "price") return L.thNet;
    return L.thRem;
  };

  const cellText = (row: TemplatePdfRow, c: QuoteTemplateTableColumn) => {
    if (c === "model") return row.model;
    if (c === "qty") return row.qty;
    if (c === "price") return row.price;
    return row.notes;
  };

  for (const b of blocks) {
    switch (b.kind) {
      case "co.logo": {
        if (opts.companyLogoDataUrl) {
          try {
            const fmt = imgFmt(opts.companyLogoDataUrl);
            const frac = b.style?.imageWidthFrac ?? 0.24;
            const maxH = b.style?.imageMaxHeightMm ?? undefined;
            const { w: logoW, h: logoH } = imageDisplaySizeMm(pdf, opts.companyLogoDataUrl, innerW, frac, maxH);
            needSpace(logoH + 6);
            const ta = b.style?.textAlign ?? "left";
            const gx = boxXForAlign(ta, M, innerW, logoW);
            pdf.addImage(opts.companyLogoDataUrl, fmt, gx, y, logoW, logoH, undefined, "FAST");
            y += logoH + 5;
          } catch {
            y += 4;
          }
        } else {
          needSpace(8);
          y += 6;
        }
        resetPdfTextStyle(pdf);
        break;
      }
      case "co.name": {
        applyTemplateBlockStyle(pdf, b);
        const ta = b.style?.textAlign ?? "left";
        const txt = (opts.companyName ?? "").trim() || (opts.uiLocale === "zh" ? "企业名称" : "Company name");
        const lines = pdf.splitTextToSize(txt, innerW);
        for (const line of lines) {
          needSpace(5);
          pdf.text(line, textXForAlign(ta, M, innerW, line, pdf), y);
          y += 4.8;
        }
        y += 2;
        resetPdfTextStyle(pdf);
        break;
      }
      case "co.tagline": {
        applyTemplateBlockStyle(pdf, b);
        const ta = b.style?.textAlign ?? "left";
        const txt = (opts.companyTagline ?? "").trim();
        if (txt) {
          const lines = pdf.splitTextToSize(txt, innerW);
          for (const line of lines) {
            needSpace(5);
            pdf.text(line, textXForAlign(ta, M, innerW, line, pdf), y);
            y += 4.5;
          }
        }
        y += 2;
        resetPdfTextStyle(pdf);
        break;
      }
      case "co.contact": {
        applyTemplateBlockStyle(pdf, b);
        const ta = b.style?.textAlign ?? "left";
        const bits = [opts.companyAddress, opts.companyPhone, opts.companyEmail, opts.companyWebsite]
          .map((x) => (typeof x === "string" ? x.trim() : ""))
          .filter(Boolean)
          .join("\n");
        const txt =
          bits ||
          (opts.uiLocale === "zh" ? "地址 / 电话 / 邮箱" : "Address / phone / email");
        const lines = pdf.splitTextToSize(txt, innerW);
        for (const line of lines) {
          needSpace(5);
          pdf.text(line, textXForAlign(ta, M, innerW, line, pdf), y);
          y += 4.2;
        }
        y += 3;
        resetPdfTextStyle(pdf);
        break;
      }
      case "q.title": {
        applyTemplateBlockStyle(pdf, b);
        const ta = b.style?.textAlign ?? "left";
        const titleLines = pdf.splitTextToSize(L.docTitle, innerW);
        for (const line of titleLines) {
          needSpace(6);
          pdf.text(line, textXForAlign(ta, M, innerW, line, pdf), y);
          y += 6;
        }
        pdf.setFontSize(Math.max(9, Math.round((b.style?.fontSizePx ?? 12) * 0.75)));
        const subLines = pdf.splitTextToSize(
          opts.projectTitle || (opts.uiLocale === "zh" ? "未命名项目" : "Untitled project"),
          innerW,
        );
        for (const line of subLines) {
          needSpace(5.5);
          pdf.text(line, textXForAlign(ta, M, innerW, line, pdf), y);
          y += 5.5;
        }
        resetPdfTextStyle(pdf);
        pdf.setFontSize(9);
        pdf.setTextColor(80, 90, 105);
        const ref = (opts.quotationRef ?? "").trim() || "—";
        const d = new Date().toLocaleDateString(opts.uiLocale === "zh" ? "zh-CN" : "en-AU");
        const meta = `${L.quoteRef}: ${ref}    ${L.quoteDate}: ${d}`;
        needSpace(5);
        pdf.text(meta, M, y);
        y += 5;
        pdf.setTextColor(60, 60, 60);
        needSpace(5);
        pdf.text(L.coverBlurb, M, y);
        y += 8;
        resetPdfTextStyle(pdf);
        break;
      }
      case "q.table": {
        const cols = b.tableColumns?.length ? b.tableColumns : ALL_TEMPLATE_COLS;
        const colCount = cols.length;
        const gap = 1.2;
        const cw = (innerW - gap * (colCount - 1)) / colCount;
        const headerH = 6.5;
        const lineH = 3.8;
        const pad = 1.1;
        needSpace(headerH + 4);
        pdf.setFillColor(st.summaryHeaderFill[0], st.summaryHeaderFill[1], st.summaryHeaderFill[2]);
        pdf.rect(M, y, innerW, headerH, "F");
        pdf.setDrawColor(st.summaryGrid[0], st.summaryGrid[1], st.summaryGrid[2]);
        pdf.setLineWidth(0.2);
        resetPdfTextStyle(pdf);
        pdf.setFontSize(9);
        pdf.setTextColor(15, 23, 42);
        let hx = M;
        for (let i = 0; i < colCount; i++) {
          pdf.rect(hx, y, cw, headerH);
          pdf.text(colLabel(cols[i]!), hx + pad, y + 4.5);
          hx += cw + (i < colCount - 1 ? gap : 0);
        }
        y += headerH + 1;
        if (!tableRows.length) {
          needSpace(8);
          pdf.setTextColor(100, 116, 139);
          pdf.text(L.emptyHw, M + pad, y + 4);
          y += 8;
          resetPdfTextStyle(pdf);
          break;
        }
        applyTemplateBlockStyle(pdf, b);
        for (const row of tableRows) {
          const cellLines = cols.map((c) => pdf.splitTextToSize(cellText(row, c), cw - 2 * pad));
          const rowH = Math.max(7, Math.max(...cellLines.map((cl) => cl.length * lineH + 3)));
          needSpace(rowH + 1);
          let cx = M;
          for (let i = 0; i < colCount; i++) {
            pdf.rect(cx, y, cw, rowH);
            let ty = y + 4;
            for (const ln of cellLines[i]!) {
              pdf.text(ln, cx + pad, ty);
              ty += lineH;
            }
            cx += cw + (i < colCount - 1 ? gap : 0);
          }
          y += rowH;
        }
        y += 3;
        resetPdfTextStyle(pdf);
        break;
      }
      case "q.totals": {
        applyTemplateBlockStyle(pdf, b);
        const ta = b.style?.textAlign ?? "right";
        const showGst = b.tableShowGst !== false;
        needSpace(5);
        const l1 = `${L.subEx}: ${fmtMoney(subEx)}`;
        pdf.text(l1, textXForAlign(ta, M, innerW, l1, pdf), y);
        y += 5;
        if (showGst) {
          const l2 = `${L.gstLabel}: ${fmtMoney(gstAmt)}`;
          needSpace(5);
          pdf.text(l2, textXForAlign(ta, M, innerW, l2, pdf), y);
          y += 5;
        }
        setQuotePdfFont(pdf, "bold");
        const l3 = showGst ? `${L.totalInc}: ${fmtMoney(totalInc)}` : `${L.subEx}: ${fmtMoney(subEx)}`;
        needSpace(6);
        pdf.text(l3, textXForAlign(ta, M, innerW, l3, pdf), y);
        y += 8;
        resetPdfTextStyle(pdf);
        break;
      }
      case "c.text": {
        applyTemplateBlockStyle(pdf, b);
        const ta = b.style?.textAlign ?? "left";
        const raw = (b.text ?? "").trim();
        if (raw) {
          const lines = pdf.splitTextToSize(raw, innerW);
          for (const line of lines) {
            needSpace(4.5);
            pdf.text(line, textXForAlign(ta, M, innerW, line, pdf), y);
            y += 4.3;
          }
        }
        y += 2;
        resetPdfTextStyle(pdf);
        break;
      }
      case "c.image": {
        const embedded =
          typeof b.imageDataUrl === "string" && b.imageDataUrl.length > 0 ? b.imageDataUrl : null;
        const mid = b.materialId;
        const mat = mid ? opts.materialsById.get(mid) : undefined;
        const url = embedded ?? mat?.dataUrl;
        if (url) {
          try {
            const fmt = imgFmt(url);
            const frac = b.style?.imageWidthFrac ?? 1;
            const maxH = b.style?.imageMaxHeightMm ?? undefined;
            const { w: imgW, h: imgH } = imageDisplaySizeMm(pdf, url, innerW, frac, maxH);
            needSpace(imgH + 4);
            const ta = b.style?.textAlign ?? "center";
            const gx = boxXForAlign(ta, M, innerW, imgW);
            pdf.addImage(url, fmt, gx, y, imgW, imgH, undefined, "FAST");
            y += imgH + 4;
          } catch {
            y += 4;
          }
        } else {
          needSpace(10);
          y += 8;
        }
        resetPdfTextStyle(pdf);
        break;
      }
      case "c.spacer": {
        const gap = Math.min(80, Math.max(1, b.spacerHeightMm ?? 8));
        needSpace(gap);
        y += gap;
        break;
      }
      case "c.rule": {
        const thick = Math.min(2, Math.max(0.05, b.ruleThicknessMm ?? 0.25));
        const rgb = hexRgbForBlock(b.ruleColor ?? "#94a3b8");
        needSpace(thick + 4);
        pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
        pdf.setLineWidth(thick);
        const ly = y + thick / 2;
        pdf.line(M, ly, M + innerW, ly);
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.2);
        y += thick + 4;
        resetPdfTextStyle(pdf);
        break;
      }
      default:
        break;
    }
  }
}

/** 生成完整报价 PDF（内存，不下载） */
export async function buildQuotePdfDocument(opts: QuotePdfBuildInput): Promise<jsPDF> {
  const {
    projectTitle,
    associations,
    placements,
    quoteFooterCustom,
    pdfStyle,
    quoteGlobalPriceTier = "regular",
    companyCatalogCurrency = "AUD",
  } = opts;
  const tier = quoteGlobalPriceTier;
  const cur = (companyCatalogCurrency || "AUD").toUpperCase();

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await ensurePdfUnicodeFont(pdf);

  const tpl = opts.quotePdfLayoutTemplate;
  const coverBlocks =
    tpl?.blocks?.filter((b) => b.kind !== "q.table" && b.kind !== "q.totals") ?? [];
  if (coverBlocks.length) {
    drawQuoteTemplateFirstPages(pdf, opts, coverBlocks);
  } else {
    drawCoverPage(pdf, { ...opts, projectTitle });
  }
  pdf.addPage();

  appendQuoteSummaryAndFooter(
    pdf,
    associations,
    placements,
    quoteFooterCustom,
    pdfStyle,
    {
      softwareFeatures: opts.softwareFeatures ?? [],
      serviceItems: opts.serviceItems ?? [],
      customPlanSoftwareLines: opts.customPlanSoftwareLines ?? [],
      customPlanServiceLines: opts.customPlanServiceLines ?? [],
    },
    opts.uiLocale,
    tier,
    cur,
    Array.from(opts.materialsById.values()),
    opts.categoryDefs ?? [],
    opts.includeProductImages === true,
  );
  return pdf;
}

export async function buildQuotePdfBlob(opts: QuotePdfBuildInput): Promise<Blob> {
  const pdf = await buildQuotePdfDocument(opts);
  return pdf.output("blob");
}

export async function exportQuotePdf(opts: QuotePdfBuildInput): Promise<void> {
  const pdf = await buildQuotePdfDocument(opts);
  const name = `${(opts.projectTitle || "报价").replace(/[\\/:*?"<>|]/g, "_")}.pdf`;
  pdf.save(name);
}
