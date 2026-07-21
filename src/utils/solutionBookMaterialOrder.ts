import type {
  AssociationRow,
  CustomPlanSoftwareLine,
  HardwarePlacement,
  MaterialPage,
  SoftwareFeatureRow,
} from "../types";
import { orderedMaterialIds } from "./layoutOrder";

export type SolutionBookStoreSlice = {
  materials: MaterialPage[];
  layoutMaterialOrder: string[];
  placements: HardwarePlacement[];
  associations: AssociationRow[];
  customPlanSoftwareLines: CustomPlanSoftwareLine[];
  softwareFeatures: SoftwareFeatureRow[];
};

/** 地图上已选硬件 → 技术资料页 id（按落点顺序，去重） */
export function collectSelectedHardwareTechnicalIds(s: SolutionBookStoreSlice): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const pl of s.placements) {
    const a = s.associations.find((x) => x.id === pl.associationId);
    const tid = a?.technicalMaterialId;
    if (!tid || seen.has(tid)) continue;
    seen.add(tid);
    out.push(tid);
  }
  return out;
}

/** 定制方案软件行顺序 → 各功能资料槽（去重） */
export function collectSelectedSoftwareDocIds(s: SolutionBookStoreSlice): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of s.customPlanSoftwareLines) {
    const f = s.softwareFeatures.find((x) => x.id === line.catalogFeatureId);
    if (!f) continue;
    for (const mid of f.docMaterialIds) {
      if (mid && !seen.has(mid)) {
        seen.add(mid);
        out.push(mid);
      }
    }
  }
  return out;
}

/** 品牌（quoteAd）按全局素材顺序 */
export function collectBrandMaterialIds(s: SolutionBookStoreSlice): string[] {
  const ordered = orderedMaterialIds(s.materials, s.layoutMaterialOrder);
  return ordered.filter((id) => s.materials.find((m) => m.id === id)?.imageKind === "quoteAd");
}

/**
 * 默认方案书页序：公司宣传册（品牌）→ 地图上已选硬件技术页 → 定制方案已选软件资料页。
 * 每项对应一页（以该素材图为底图）。
 */
export function collectDefaultSolutionBookMaterialIds(s: SolutionBookStoreSlice): string[] {
  return [
    ...collectBrandMaterialIds(s),
    ...collectSelectedHardwareTechnicalIds(s),
    ...collectSelectedSoftwareDocIds(s),
  ];
}

export function collectUnselectedTechnicalMaterialIds(s: SolutionBookStoreSlice): string[] {
  const selected = new Set(collectSelectedHardwareTechnicalIds(s));
  const ordered = orderedMaterialIds(s.materials, s.layoutMaterialOrder);
  return ordered.filter((id) => {
    const m = s.materials.find((x) => x.id === id);
    return m?.imageKind === "technical" && !selected.has(id);
  });
}

export function collectUnselectedSoftwareDocIds(s: SolutionBookStoreSlice): string[] {
  const selected = new Set(collectSelectedSoftwareDocIds(s));
  const ordered = orderedMaterialIds(s.materials, s.layoutMaterialOrder);
  return ordered.filter((id) => {
    const m = s.materials.find((x) => x.id === id);
    return m?.imageKind === "softwareDoc" && !selected.has(id);
  });
}
