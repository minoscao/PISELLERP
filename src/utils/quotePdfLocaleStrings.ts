import type { AssociationRow, MaterialCategoryDef, MaterialPage, UiLocale } from "../types";
import { associationMapCategory } from "./associationCatalog";

/** 去掉中日韩等字符，英文模式下无法对照目录时用 */
const HAN_RANGE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g;

export function stripHanSegments(s: string): string {
  return s.replace(HAN_RANGE, "").replace(/\s+/g, " ").replace(/\s*[·•]+\s*/g, " ").trim();
}

/** 中文分类名 → categoryDefs.nameEn（精确匹配素材分类名） */
export function pdfResolvedCategoryEnglish(raw: string, defs: MaterialCategoryDef[]): string {
  const t = raw.trim();
  if (!t) return "";
  const d = defs.find((x) => x.name.trim() === t);
  return (d?.nameEn ?? "").trim();
}

/**
 * PDF「产品名」列硬件：中文两行型号/目录名；英文第二行优先 Hardware / nameEn。
 */
export function pdfHardwareProductBody(
  row: AssociationRow,
  locale: UiLocale | undefined,
  materials: MaterialPage[],
  categoryDefs: MaterialCategoryDef[],
): string {
  const zh = locale === "zh";
  const dm = row.deviceModel.trim();
  const hn = row.hardwareName.trim();
  const title = dm || hn || "—";

  if (zh) {
    if (hn && dm && hn !== dm) return `${dm}\n${hn}`;
    return title;
  }

  const catZh = associationMapCategory(row, materials, categoryDefs);
  const catEn = pdfResolvedCategoryEnglish(catZh, categoryDefs) || stripHanSegments(catZh);
  const line2 = catEn ? `Hardware / ${catEn}` : "";
  if (line2) return `${title}\n${line2}`;
  return title;
}

export function pdfSoftwareCategoryLabel(cat: string, locale: UiLocale | undefined, defs: MaterialCategoryDef[]): string {
  const c = cat.trim();
  const zh = locale === "zh";
  if (zh) {
    if (!c) return "软件";
    return `软件 · ${c}`;
  }
  const en = pdfResolvedCategoryEnglish(c, defs) || stripHanSegments(c);
  return en ? `Software / ${en}` : "Software";
}

export function pdfSoftwareScheduleProductBody(
  featureName: string,
  category: string,
  locale: UiLocale | undefined,
  defs: MaterialCategoryDef[],
): string {
  return `${featureName.trim()}\n${pdfSoftwareCategoryLabel(category, locale, defs)}`;
}

export function pdfSoftwareScheduleProductBodyRecurring(
  featureName: string,
  category: string,
  billingPrefix: string,
  locale: UiLocale | undefined,
  defs: MaterialCategoryDef[],
): string {
  const tail = pdfSoftwareCategoryLabel(category, locale, defs);
  const line2 = `${billingPrefix} ${tail}`.trim();
  return `${featureName.trim()}\n${line2}`;
}

export function pdfServiceCategoryLabel(cat: string, locale: UiLocale | undefined, defs: MaterialCategoryDef[]): string {
  const c = cat.trim();
  const zh = locale === "zh";
  if (zh) {
    if (!c) return "服务";
    return `服务 · ${c}`;
  }
  const en = pdfResolvedCategoryEnglish(c, defs) || stripHanSegments(c);
  return en ? `Services / ${en}` : "Services";
}

export function pdfServiceScheduleProductBody(
  serviceName: string,
  category: string,
  locale: UiLocale | undefined,
  defs: MaterialCategoryDef[],
): string {
  return `${serviceName.trim()}\n${pdfServiceCategoryLabel(category, locale, defs)}`;
}
