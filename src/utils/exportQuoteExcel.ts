import ExcelJS from "exceljs";
import type { QuotePdfBuildInput } from "./exportQuotePdf";
import { quotePdfLocale } from "./exportQuotePdf";
import type {
  AssociationRow,
  CustomPlanServiceLine,
  CustomPlanSoftwareLine,
  ServiceRow,
  SoftwareFeatureRow,
} from "../types";
import {
  associationQuoteEffectiveQty,
  associationQuoteLineScaledNoDiscount,
  associationQuoteLineTotal,
  formatMoneyAmount,
  normalizeAssociationRow,
} from "./hardwareOptionsAddons";
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
import { serviceLineSpecOptionPart, softwareLineSpecOptionPart } from "./customPlanLineSpecSummary";
import { formatNetAfterDiscountDisplay } from "./quoteNetDisplay";
import {
  pdfHardwareProductBody,
  pdfServiceScheduleProductBody,
  pdfSoftwareScheduleProductBody,
  pdfSoftwareScheduleProductBodyRecurring,
} from "./quotePdfLocaleStrings";
import { normalizeQuotePdfExportStyle } from "../theme/quotePdfStyle";
import { firstLinkedMaterial } from "./associationMaterials";

const GST_RATE = 0.1;

function fxMult(input: QuotePdfBuildInput): number {
  const m = input.companyCatalogFxMultiplier;
  return typeof m === "number" && Number.isFinite(m) ? m : 1;
}

function moneyStr(input: QuotePdfBuildInput, n: number): string {
  const cur = (input.companyCatalogCurrency ?? "AUD").toUpperCase();
  return formatMoneyAmount(n * fxMult(input), cur);
}

function hexToArgb(hex: string, fallback = "#e2e8f0"): string {
  const h = (hex || "").trim();
  if (/^#[0-9A-Fa-f]{6}$/i.test(h)) return `FF${h.slice(1).toUpperCase()}`;
  const f = fallback.trim();
  if (/^#[0-9A-Fa-f]{6}$/i.test(f)) return `FF${f.slice(1).toUpperCase()}`;
  return "FFE2E8F0";
}

function tableRemark(row: AssociationRow): string {
  const q = (row.quoteTableNote ?? "").trim();
  if (q) return q;
  return (row.note ?? "").trim();
}

function thinBorder(colorArgb: string): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: "thin", color: { argb: colorArgb } };
  return { top: side, left: side, bottom: side, right: side };
}

function mergeRow(ws: ExcelJS.Worksheet, r: number, c1: number, c2: number) {
  if (c2 > c1) ws.mergeCells(r, c1, r, c2);
}

/** Excel 列宽约等于字符数（Calibri 11）— 用于估算像素上限 */
const EXCEL_COL_WIDTH_TO_PX = 7;

function sheetColumnsWidthPx(cols: readonly { width?: number }[]): number {
  return cols.reduce((acc, col) => acc + (Number(col.width) || 8.43) * EXCEL_COL_WIDTH_TO_PX, 0);
}

/** Excel 行高（pt）→ 内容区最大高度（px，96dpi） */
function rowHeightPointsToMaxPx(rowHeightPt: number): number {
  return (Math.max(1, rowHeightPt) * 96) / 72;
}

/**
 * 将图片缩放到完全落在 maxW×maxH 内，保持宽高比，不拉伸变形。
 * Logo / 产品图默认 allowUpscale: false（不放大超过原图像素，也不裁切）。
 */
function containImagePixels(
  naturalW: number,
  naturalH: number,
  maxW: number,
  maxH: number,
  opts?: { allowUpscale?: boolean },
): { w: number; h: number } {
  const nw = Math.max(1, naturalW);
  const nh = Math.max(1, naturalH);
  const allowUpscale = opts?.allowUpscale === true;
  const mx = Math.max(4, maxW);
  const my = Math.max(4, maxH);
  let scale = Math.min(mx / nw, my / nh);
  if (!allowUpscale) scale = Math.min(scale, 1);
  const w = Math.round(nw * scale * 100) / 100;
  const h = Math.round(nh * scale * 100) / 100;
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

function loadImageNaturalSize(dataUrl: string): Promise<{ w: number; h: number } | null> {
  if (typeof Image === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) resolve({ w: img.naturalWidth, h: img.naturalHeight });
      else resolve(null);
    };
    img.onload = done;
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function imageExtensionFromDataUrl(dataUrl: string): "png" | "jpeg" {
  return dataUrl.startsWith("data:image/png") ? "png" : "jpeg";
}

/**
 * 与 PDF 汇总页相同的配色、五列表头、GST 与分区标题；打印为 A4 纵向。
 */
export async function exportQuoteExcelFile(input: QuotePdfBuildInput): Promise<void> {
  const style = normalizeQuotePdfExportStyle(input.pdfStyle);
  const argbAccent = hexToArgb(style.accentColor);
  const argbMuted = hexToArgb(style.mutedColor);
  const argbHdr = hexToArgb(style.tableHeaderFill);
  const argbGrid = hexToArgb(style.tableGridColor);
  const ui = input.uiLocale;
  const L = quotePdfLocale(ui);
  const tier = input.quoteGlobalPriceTier ?? "regular";
  const fmtMoney = (n: number) => moneyStr(input, n);
  const categoryDefs = input.categoryDefs;
  const materials = [...input.materialsById.values()];
  const useImg = input.includeProductImages === true;
  const COL_LAST = useImg ? 6 : 5;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Marketing Quote";
  wb.created = new Date();
  const ws = wb.addWorksheet(L.docTitle, {
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      margins: { left: 0.55, right: 0.55, top: 0.72, bottom: 0.72, header: 0.32, footer: 0.32 },
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
    },
    properties: { defaultRowHeight: 18 },
  });

  ws.columns = useImg
    ? [
        { width: 11 },
        { width: 28 },
        { width: 12 },
        { width: 8 },
        { width: 12 },
        { width: 18 },
      ]
    : [
        { width: 34 },
        { width: 14 },
        { width: 9 },
        { width: 14 },
        { width: 22 },
      ];

  let r = 1;
  /** 顶栏装饰（与 PDF coverDecor topBar 一致） */
  if (style.coverDecor === "topBar") {
    mergeRow(ws, r, 1, COL_LAST);
    for (let c = 1; c <= COL_LAST; c++) {
      const cell = ws.getCell(r, c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argbAccent } };
      cell.border = thinBorder(argbGrid);
    }
    ws.getRow(r).height = 6;
    r += 1;
  }

  const imgSizeCache = new Map<string, { w: number; h: number } | null>();
  const cachedNaturalSize = async (dataUrl: string) => {
    if (imgSizeCache.has(dataUrl)) return imgSizeCache.get(dataUrl) ?? null;
    const d = await loadImageNaturalSize(dataUrl);
    imgSizeCache.set(dataUrl, d);
    return d;
  };

  const titleRow = r;
  if (input.companyLogoDataUrl) {
    try {
      const raw = input.companyLogoDataUrl;
      const dims = await cachedNaturalSize(raw);
      if (!dims) throw new Error("logo dimensions");
      mergeRow(ws, titleRow, 1, COL_LAST);
      const b64 = raw.replace(/^data:[^;]+;base64,/, "");
      const imgId = wb.addImage({ base64: b64, extension: imageExtensionFromDataUrl(raw) });
      const maxW = Math.min(480, sheetColumnsWidthPx(ws.columns as { width?: number }[]) - 12);
      const maxH = 100;
      const { w, h } = containImagePixels(dims.w, dims.h, maxW, maxH, { allowUpscale: false });
      ws.addImage(imgId, {
        tl: { col: 0, row: titleRow - 1 },
        ext: { width: w, height: h },
      });
      const rowPt = Math.min(409, Math.max((h * 72) / 96 + 8, 28));
      ws.getRow(titleRow).height = rowPt;
      r = titleRow + 1;
    } catch {
      r = titleRow;
    }
  }

  const co = ws.getCell(r, 1);
  co.value = (input.companyName ?? "").trim() || (ui === "zh" ? "企业名称" : "Company name");
  co.font = { size: 14, bold: true, color: { argb: argbAccent } };
  mergeRow(ws, r, 1, COL_LAST);
  r += 1;

  const tag = (input.companyTagline ?? "").trim();
  if (tag) {
    const c = ws.getCell(r, 1);
    c.value = tag;
    c.font = { size: 10, color: { argb: argbMuted } };
    mergeRow(ws, r, 1, COL_LAST);
    r += 1;
  }
  const addr = (input.companyAddress ?? "").trim();
  if (addr) {
    const c = ws.getCell(r, 1);
    c.value = addr;
    c.font = { size: 9, color: { argb: argbMuted } };
    c.alignment = { wrapText: true, vertical: "top" };
    mergeRow(ws, r, 1, COL_LAST);
    r += 1;
  }
  const bits: string[] = [];
  if ((input.companyPhone ?? "").trim()) bits.push(`Tel ${input.companyPhone!.trim()}`);
  if ((input.companyEmail ?? "").trim()) bits.push(input.companyEmail!.trim());
  if (bits.length) {
    const c = ws.getCell(r, 1);
    c.value = bits.join("  ·  ");
    c.font = { size: 9, color: { argb: argbMuted } };
    mergeRow(ws, r, 1, COL_LAST);
    r += 1;
  }
  if ((input.companyWebsite ?? "").trim()) {
    const c = ws.getCell(r, 1);
    c.value = input.companyWebsite!.trim();
    c.font = { size: 9, color: { argb: argbMuted } };
    mergeRow(ws, r, 1, COL_LAST);
    r += 1;
  }

  r += 1;
  const docT = ws.getCell(r, 1);
  docT.value = L.docTitle;
  docT.font = { size: 16, bold: true, color: { argb: "FF0F172A" } };
  mergeRow(ws, r, 1, COL_LAST);
  r += 1;

  const proj = ws.getCell(r, 1);
  proj.value = input.projectTitle?.trim() || (ui === "zh" ? "未命名项目" : "Untitled project");
  proj.font = { size: 12, color: { argb: "FF3C3C43" } };
  mergeRow(ws, r, 1, COL_LAST);
  r += 1;

  const ref = (input.quotationRef ?? "").trim() || "—";
  const d = new Date().toLocaleDateString(ui === "zh" ? "zh-CN" : "en-AU");
  const meta = ws.getCell(r, 1);
  meta.value = `${L.quoteRef}: ${ref}    ${L.quoteDate}: ${d}`;
  meta.font = { size: 10, color: { argb: "FF505A6E" } };
  mergeRow(ws, r, 1, COL_LAST);
  r += 2;

  const sched = ws.getCell(r, 1);
  sched.value = L.scheduleTitle;
  sched.font = { size: 13, bold: true, color: { argb: "FF14181F" } };
  mergeRow(ws, r, 1, COL_LAST);
  r += 1;

  const hdrRow = r;
  const heads = useImg
    ? [L.thImage, L.thProductName, L.thUnitPrice, L.thQty, L.thLineTotalCatalog, L.thNetAfterDisc]
    : [L.thProductName, L.thUnitPrice, L.thQty, L.thLineTotalCatalog, L.thNetAfterDisc];
  for (let i = 0; i < heads.length; i++) {
    const cell = ws.getCell(hdrRow, i + 1);
    cell.value = heads[i];
    cell.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argbHdr } };
    cell.border = thinBorder(argbGrid);
    cell.alignment = { vertical: "middle", wrapText: true };
  }
  ws.getRow(hdrRow).height = 22;
  ws.views = [{ state: "frozen", ySplit: hdrRow }];
  r += 1;

  const addonIndent = ui === "zh" ? "　· " : "  · ";

  const thumbColMaxWpx = useImg
    ? Math.max(20, (Number(ws.columns[0]?.width) || 11) * EXCEL_COL_WIDTH_TO_PX - 8)
    : 0;

  const paintRow = async (cells: string[], rowH = 20, thumbUrl: string | null = null) => {
    const textCells = cells.slice(0, 5);
    while (textCells.length < 5) textCells.push("");
    const rh = ws.getRow(r);
    rh.height = rowH;
    if (useImg) {
      const z = ws.getCell(r, 1);
      z.value = "";
      z.font = { size: 10, color: { argb: "FF0F172A" } };
      z.border = thinBorder(argbGrid);
      z.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
      if (thumbUrl) {
        try {
          const raw = thumbUrl;
          const dims = await cachedNaturalSize(thumbUrl);
          const maxH = Math.max(16, rowHeightPointsToMaxPx(rowH) - 8);
          const maxW = thumbColMaxWpx;
          if (dims) {
            const b64 = raw.replace(/^data:[^;]+;base64,/, "");
            const imgId = wb.addImage({ base64: b64, extension: imageExtensionFromDataUrl(raw) });
            const { w, h } = containImagePixels(dims.w, dims.h, maxW, maxH, { allowUpscale: false });
            ws.addImage(imgId, {
              tl: { col: 0, row: r - 1 },
              ext: { width: w, height: h },
            });
          }
        } catch {
          /* skip bad image */
        }
      }
      for (let i = 0; i < 5; i++) {
        const cell = ws.getCell(r, i + 2);
        cell.value = textCells[i] ?? "";
        cell.font = { size: 10, color: { argb: "FF0F172A" } };
        cell.border = thinBorder(argbGrid);
        cell.alignment = { wrapText: true, vertical: "top" };
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const cell = ws.getCell(r, i + 1);
        cell.value = textCells[i] ?? "";
        cell.font = { size: 10, color: { argb: "FF0F172A" } };
        cell.border = thinBorder(argbGrid);
        cell.alignment = { wrapText: true, vertical: "top" };
      }
    }
    r += 1;
  };

  const assocSchedule = input.associations
    .map((row) => normalizeAssociationRow(row))
    .filter((x) => associationQuoteEffectiveQty(x, input.placements) > 0);

  if (assocSchedule.length > 0) {
    const sec = ws.getCell(r, 1);
    sec.value = L.sectionHw;
    sec.font = { bold: true, size: 11, color: { argb: argbAccent } };
    mergeRow(ws, r, 1, COL_LAST);
    r += 1;
  } else {
    const emp = ws.getCell(r, 1);
    emp.value = L.emptyHw;
    emp.font = { italic: true, color: { argb: "FF64748B" } };
    mergeRow(ws, r, 1, COL_LAST);
    r += 1;
  }

  let sum = 0;

  for (const row of assocSchedule) {
    const model = pdfHardwareProductBody(row, ui, materials, categoryDefs);
    const qn = associationQuoteEffectiveQty(row, input.placements);
    const qty = String(qn);
    const listCatalog = associationQuoteLineScaledNoDiscount(row, input.placements, tier);
    const unitPrice = qn > 0 ? listCatalog / qn : 0;
    const lineTotal = associationQuoteLineTotal(row, input.placements, tier);
    sum += lineTotal;
    const hasOv =
      (typeof row.quoteLineTotalOverride === "number" &&
        Number.isFinite(row.quoteLineTotalOverride) &&
        row.quoteLineTotalOverride >= 0) ||
      (typeof row.quoteLineUnitPriceOverride === "number" &&
        Number.isFinite(row.quoteLineUnitPriceOverride) &&
        row.quoteLineUnitPriceOverride >= 0);
    const pctParen = hasOv ? null : row.quoteLineDiscountPct;
    const netParenStr = formatNetAfterDiscountDisplay(lineTotal, listCatalog, pctParen, fmtMoney, ui);
    const rem = tableRemark(row);
    const modelBlock = rem.trim() && rem.trim() !== "—" ? `${model}\n${rem.trim()}` : model;
    const mat = useImg ? firstLinkedMaterial(row, materials) : null;
    const thumb = mat?.dataUrl?.trim() ? mat.dataUrl : null;
    await paintRow([modelBlock, fmtMoney(unitPrice), qty, fmtMoney(listCatalog), netParenStr], thumb ? 56 : 22, thumb);
  }

  const featById = new Map((input.softwareFeatures ?? []).map((f) => [f.id, f]));
  const svcById = new Map((input.serviceItems ?? []).map((s) => [s.id, s]));
  const customPlanSoftwareLines = input.customPlanSoftwareLines ?? [];
  const customPlanServiceLines = input.customPlanServiceLines ?? [];

  const drawSoftwareLine = async (
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
    const baseRemParts = lineNote ? [lineNote] : [optPart !== "—" ? optPart : "", note].filter(Boolean);
    const baseRem = baseRemParts.filter(Boolean).join(" · ") || "—";

    const hasOverride =
      line.lineTotalOverride !== null &&
      line.lineTotalOverride !== undefined &&
      typeof line.lineTotalOverride === "number" &&
      Number.isFinite(line.lineTotalOverride) &&
      line.lineTotalOverride >= 0;

    const unitMain = q > 0 ? fmtMoney(autoTotal / q) : fmtMoney(0);
    const netParenLine = formatNetAfterDiscountDisplay(effective, autoTotal, null, fmtMoney, ui);

    if (hasOverride) {
      if (countTowardGst) sum += effective;
      await paintRow([`${fullModel}\n${baseRem}`, unitMain, String(q), fmtMoney(autoTotal), netParenLine], 24);
      return;
    }

    const coreTotal = q * softwarePickCoreUnitPrice(f, line);
    const slices = softwarePickAddonUnitSlices(f, line);
    if (countTowardGst) sum += coreTotal;
    await paintRow([`${fullModel}\n${baseRem}`, unitMain, String(q), fmtMoney(autoTotal), netParenLine], 24);
    for (const sl of slices) {
      const amt = q * sl.unitAmount;
      if (countTowardGst) sum += amt;
      await paintRow([`${addonIndent}${sl.label}`, "—", "—", fmtMoney(amt), fmtMoney(amt)], 18);
    }
  };

  const drawServiceLine = async (
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
    const baseRemParts = lineNote ? [lineNote] : [optPart !== "—" ? optPart : "", note].filter(Boolean);
    const baseRem = baseRemParts.filter(Boolean).join(" · ") || "—";

    const hasOverride =
      line.lineTotalOverride !== null &&
      line.lineTotalOverride !== undefined &&
      typeof line.lineTotalOverride === "number" &&
      Number.isFinite(line.lineTotalOverride) &&
      line.lineTotalOverride >= 0;

    const unitMain = q > 0 ? fmtMoney(autoTotal / q) : fmtMoney(0);
    const netParenLine = formatNetAfterDiscountDisplay(effective, autoTotal, null, fmtMoney, ui);

    if (hasOverride) {
      if (countTowardGst) sum += effective;
      await paintRow([`${fullModel}\n${baseRem}`, unitMain, String(q), fmtMoney(autoTotal), netParenLine], 24);
      return;
    }

    const coreTotal = q * servicePickCoreUnitPrice(sv, line);
    const slices = servicePickAddonUnitSlices(sv, line);
    if (countTowardGst) sum += coreTotal;
    await paintRow([`${fullModel}\n${baseRem}`, unitMain, String(q), fmtMoney(autoTotal), netParenLine], 24);
    for (const sl of slices) {
      const amt = q * sl.unitAmount;
      if (countTowardGst) sum += amt;
      await paintRow([`${addonIndent}${sl.label}`, "—", "—", fmtMoney(amt), fmtMoney(amt)], 18);
    }
  };

  const swLinesActive = customPlanSoftwareLines.filter((line) => {
    const f = featById.get(line.catalogFeatureId);
    if (!f?.featureName.trim()) return false;
    const q = Math.floor(Number(line.quantity));
    return Number.isFinite(q) && q > 0;
  });
  const swOne = swLinesActive.filter((line) => softwareBillingMode(featById.get(line.catalogFeatureId)!) === "one_time");
  const swMo = swLinesActive.filter((line) => softwareBillingMode(featById.get(line.catalogFeatureId)!) === "monthly");
  const swYr = swLinesActive.filter((line) => softwareBillingMode(featById.get(line.catalogFeatureId)!) === "yearly");
  const svSchedule = customPlanServiceLines.filter((line) => {
    const sv = svcById.get(line.catalogServiceId);
    if (!sv?.serviceName.trim()) return false;
    const q = Math.floor(Number(line.quantity));
    return Number.isFinite(q) && q > 0;
  });

  if (swOne.length > 0 || svSchedule.length > 0) {
    if (swOne.length > 0) {
      const sec = ws.getCell(r, 1);
      sec.value = L.sectionSwOneTime;
      sec.font = { bold: true, size: 11, color: { argb: argbAccent } };
      mergeRow(ws, r, 1, COL_LAST);
      r += 1;
      for (const line of swOne) {
        const f = featById.get(line.catalogFeatureId)!;
        const cat = (f.featureCategory ?? "").trim();
        const model = pdfSoftwareScheduleProductBody(f.featureName, cat, ui, categoryDefs);
        await drawSoftwareLine(model, line, f, true);
      }
    }
    if (svSchedule.length > 0) {
      const sec = ws.getCell(r, 1);
      sec.value = L.sectionSv;
      sec.font = { bold: true, size: 11, color: { argb: argbAccent } };
      mergeRow(ws, r, 1, COL_LAST);
      r += 1;
      for (const line of svSchedule) {
        const sv = svcById.get(line.catalogServiceId)!;
        const cat = (sv.serviceCategory ?? "").trim();
        const model = pdfServiceScheduleProductBody(sv.serviceName, cat, ui, categoryDefs);
        await drawServiceLine(model, line, sv, true);
      }
    }
  }

  const subEx = sum;
  const gstAmt = subEx * GST_RATE;
  const totalInc = subEx + gstAmt;

  r += 1;
  const lineC = ws.getRow(r);
  lineC.height = 4;
  for (let c = 1; c <= COL_LAST; c++) {
    ws.getCell(r, c).border = { bottom: { style: "medium", color: { argb: argbGrid } } };
  }
  r += 1;

  const gstSummary = (label: string, amount: string, bold: boolean) => {
    const lbl = ws.getCell(r, 1);
    lbl.value = `${label}:`;
    lbl.font = { bold, size: bold ? 11 : 10, color: { argb: bold ? "FF0F172A" : "FF1E293B" } };
    mergeRow(ws, r, 1, COL_LAST - 1);
    const amt = ws.getCell(r, COL_LAST);
    amt.value = amount;
    amt.font = { bold, size: bold ? 11 : 10, color: { argb: bold ? "FF0F172A" : "FF1E293B" } };
    amt.alignment = { horizontal: "right", vertical: "middle" };
    r += 1;
  };
  gstSummary(L.subEx, fmtMoney(subEx), false);
  gstSummary(L.gstLabel, fmtMoney(gstAmt), false);
  gstSummary(L.totalInc, fmtMoney(totalInc), true);
  r += 1;

  const drawRecurringBlock = async (
    lines: CustomPlanSoftwareLine[],
    sectionTitle: string,
    moOrYr: "monthly" | "yearly",
  ) => {
    if (!lines.length) return;
    const note = ws.getCell(r, 1);
    note.value = L.recurringExclNote;
    note.font = { italic: true, size: 9, color: { argb: argbMuted } };
    mergeRow(ws, r, 1, COL_LAST);
    r += 1;
    const sec = ws.getCell(r, 1);
    sec.value = sectionTitle;
    sec.font = { bold: true, size: 11, color: { argb: argbAccent } };
    mergeRow(ws, r, 1, COL_LAST);
    r += 1;
    let blockSum = 0;
    for (const line of lines) {
      const f = featById.get(line.catalogFeatureId)!;
      blockSum += customPlanSoftwareEffectiveTotal(f, line);
      const cat = (f.featureCategory ?? "").trim();
      const prefix =
        ui === "zh" ? (moOrYr === "monthly" ? "[按月]" : "[按年]") : moOrYr === "monthly" ? "[Monthly]" : "[Annual]";
      const model = pdfSoftwareScheduleProductBodyRecurring(f.featureName, cat, prefix, ui, categoryDefs);
      await drawSoftwareLine(model, line, f, false);
    }
    const subLabel = moOrYr === "monthly" ? L.swMoSubtotal : L.swYrSubtotal;
    await paintRow([subLabel, "—", "—", "—", fmtMoney(blockSum)], 20);
  };

  await drawRecurringBlock(swMo, L.sectionSwMonthly, "monthly");
  await drawRecurringBlock(swYr, L.sectionSwYearly, "yearly");

  let monthlyFeesGrandTotal = 0;
  for (const line of swMo) {
    const f = featById.get(line.catalogFeatureId)!;
    monthlyFeesGrandTotal += customPlanSoftwareEffectiveTotal(f, line);
  }
  if (monthlyFeesGrandTotal > 0.004) {
    const gstMonthly = monthlyFeesGrandTotal * GST_RATE;
    const monthlyInc = monthlyFeesGrandTotal + gstMonthly;
    r += 1;
    for (let c = 1; c <= COL_LAST; c++) {
      ws.getCell(r, c).border = { top: { style: "thin", color: { argb: argbGrid } } };
    }
    r += 1;
    const mh = ws.getCell(r, 1);
    mh.value = L.monthlyClosingHeading;
    mh.font = { bold: true, size: 11, color: { argb: argbAccent } };
    mh.alignment = { horizontal: "center" };
    mergeRow(ws, r, 1, COL_LAST);
    r += 1;
    gstSummary(L.monthlyRecurringSubEx, fmtMoney(monthlyFeesGrandTotal), false);
    gstSummary(L.monthlyRecurringGst, fmtMoney(gstMonthly), false);
    gstSummary(L.monthlyRecurringDue, fmtMoney(monthlyInc), true);
    r += 1;
  }

  const foot = (input.quoteFooterCustom ?? "").trim();
  if (foot) {
    r += 1;
    const h = ws.getCell(r, 1);
    h.value = L.otherTitle;
    h.font = { bold: true, size: 11 };
    mergeRow(ws, r, 1, COL_LAST);
    r += 1;
    const fcell = ws.getCell(r, 1);
    fcell.value = foot;
    fcell.font = { size: 10, color: { argb: "FF374151" } };
    fcell.alignment = { wrapText: true, vertical: "top" };
    mergeRow(ws, r, 1, COL_LAST);
    r += 2;
  }

  const end = ws.getCell(r, 1);
  end.value = L.docEndMarker;
  end.font = { size: 9, italic: true, color: { argb: "FF8C92A4" } };
  end.alignment = { horizontal: "center" };
  mergeRow(ws, r, 1, COL_LAST);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const safeRef = (input.quotationRef ?? "").replace(/[^\w.-]+/g, "_").slice(0, 40) || "quote";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Quote-${safeRef}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
