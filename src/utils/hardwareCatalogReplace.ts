import type {
  AssociationRow,
  ErpInventoryLine,
  HardwarePlacement,
  MaterialPage,
  PlanPage,
  ServiceRow,
  SoftwareFeatureRow,
} from "../types";
import {
  collectAssociationSlotMaterialIds,
  collectMaterialIdsReferencedOutsideAssociations,
} from "./materialReferenceIds";

export type HardwareCatalogImportBundle = {
  materials: MaterialPage[];
  associations: AssociationRow[];
  erpInventoryLines: ErpInventoryLine[];
};

/** Same merge as Excel import: replace hardware rows, drop orphaned slot materials, clear map pins for removed assocs. */
export function patchStateWithHardwareCatalogBundle<
  T extends {
    associations: AssociationRow[];
    materials: MaterialPage[];
    placements: HardwarePlacement[];
    erpInventoryLines: ErpInventoryLine[];
    softwareFeatures: SoftwareFeatureRow[];
    serviceItems: ServiceRow[];
    planPages: PlanPage[];
    layoutMaterialOrder: string[];
    floorPlanDataUrl: string | null;
    companyLogoDataUrl: string | null;
  },
>(s: T, bundle: HardwareCatalogImportBundle): Pick<T, "materials" | "associations" | "placements" | "erpInventoryLines"> {
  const oldAss = s.associations;
  const oldSlotIds = collectAssociationSlotMaterialIds(oldAss);
  const keepIds = collectMaterialIdsReferencedOutsideAssociations({
    associationsToIgnore: oldAss,
    allAssociations: oldAss,
    softwareFeatures: s.softwareFeatures,
    serviceItems: s.serviceItems,
    planPages: s.planPages,
    layoutMaterialOrder: s.layoutMaterialOrder,
    floorPlanDataUrl: s.floorPlanDataUrl,
    companyLogoDataUrl: s.companyLogoDataUrl,
    materials: s.materials,
  });
  const removeSet = new Set([...oldSlotIds].filter((id) => !keepIds.has(id)));
  const materials = [...s.materials.filter((m) => !removeSet.has(m.id)), ...bundle.materials];
  const placements = s.placements.filter((p) => !oldAss.some((a) => a.id === p.associationId));
  const erpInventoryLines = [
    ...s.erpInventoryLines.filter((l) => l.kind !== "hardware"),
    ...bundle.erpInventoryLines,
  ];
  return {
    materials,
    associations: bundle.associations,
    placements,
    erpInventoryLines,
  };
}
