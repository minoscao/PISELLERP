import type { MaterialPage, PlanPage, PlanTemplateBackgroundRule, PlanTemplatePageEntry } from "../types";
import {
  collectBrandMaterialIds,
  collectSelectedHardwareTechnicalIds,
  collectSelectedSoftwareDocIds,
  type SolutionBookStoreSlice,
} from "./solutionBookMaterialOrder";

export type PlanTemplateResolveSlice = SolutionBookStoreSlice;

/** 从底图反查素材 id（旧数据无 backgroundMaterialId 时用 dataUrl 匹配） */
export function inferBackgroundMaterialId(page: PlanPage, materials: MaterialPage[]): string | null {
  if (typeof page.backgroundMaterialId === "string" && page.backgroundMaterialId) {
    return page.backgroundMaterialId;
  }
  const m = materials.find((x) => x.dataUrl === page.backgroundDataUrl);
  return m?.id ?? null;
}

export function inferPlanTemplateBackgroundRule(page: PlanPage, s: PlanTemplateResolveSlice): PlanTemplateBackgroundRule {
  const mid = inferBackgroundMaterialId(page, s.materials);
  if (!mid) return { kind: "unknown" };

  const brand = collectBrandMaterialIds(s);
  const ib = brand.indexOf(mid);
  if (ib >= 0) return { kind: "brand", index: ib };

  const hw = collectSelectedHardwareTechnicalIds(s);
  const ih = hw.indexOf(mid);
  if (ih >= 0) return { kind: "hardwareTechnical", index: ih };

  const sw = collectSelectedSoftwareDocIds(s);
  const is = sw.indexOf(mid);
  if (is >= 0) return { kind: "softwareDoc", index: is };

  return { kind: "material", materialId: mid };
}

export function buildTemplateEntriesFromPlanPages(pages: PlanPage[], s: PlanTemplateResolveSlice): PlanTemplatePageEntry[] {
  return pages.map((p) => ({
    background: inferPlanTemplateBackgroundRule(p, s),
    overlayAspect:
      typeof p.overlayCropAspect === "string" && /^\d+:\d+$/.test(p.overlayCropAspect.trim())
        ? p.overlayCropAspect.trim()
        : null,
  }));
}

export function resolveMaterialIdForRule(rule: PlanTemplateBackgroundRule, s: PlanTemplateResolveSlice): string | null {
  switch (rule.kind) {
    case "brand": {
      const a = collectBrandMaterialIds(s);
      return a[rule.index] ?? null;
    }
    case "hardwareTechnical": {
      const a = collectSelectedHardwareTechnicalIds(s);
      return a[rule.index] ?? null;
    }
    case "softwareDoc": {
      const a = collectSelectedSoftwareDocIds(s);
      return a[rule.index] ?? null;
    }
    case "material": {
      return s.materials.some((m) => m.id === rule.materialId) ? rule.materialId : null;
    }
    default:
      return null;
  }
}

/** 由模板生成新方案页（无标注、无叠图；裁切比例沿用模板） */
export function materializePlanPagesFromTemplate(
  entries: PlanTemplatePageEntry[],
  s: PlanTemplateResolveSlice,
): PlanPage[] {
  const byId = new Map(s.materials.map((m) => [m.id, m]));
  const out: PlanPage[] = [];
  for (const e of entries) {
    const mid = resolveMaterialIdForRule(e.background, s);
    if (!mid) continue;
    const m = byId.get(mid);
    if (!m) continue;
    const crop = e.overlayAspect && /^\d+:\d+$/.test(e.overlayAspect) ? e.overlayAspect : null;
    out.push({
      id: crypto.randomUUID(),
      backgroundDataUrl: m.dataUrl,
      widthPx: m.widthPx,
      heightPx: m.heightPx,
      sourceFileName: m.fileName,
      sourcePage: m.sourcePage,
      backgroundMaterialId: m.id,
      overlayMaterialId: null,
      overlayCropAspect: crop,
      previewExtra: null,
    });
  }
  return out;
}
