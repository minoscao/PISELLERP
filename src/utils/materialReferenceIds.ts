import type { AssociationRow, MaterialPage, PlanPage, ServiceRow, SoftwareFeatureRow } from "../types";

function addAssocSlots(s: Set<string>, a: AssociationRow) {
  for (const id of [a.productMaterialId, a.quoteAdMaterialId, a.technicalMaterialId]) {
    if (id) s.add(id);
  }
  for (const o of a.options) {
    if (o.productMaterialId) s.add(o.productMaterialId);
    if (o.technicalMaterialId) s.add(o.technicalMaterialId);
  }
}

/** All material ids referenced outside a given association list (e.g. keep these on catalog import). */
export function collectMaterialIdsReferencedOutsideAssociations(input: {
  associationsToIgnore: AssociationRow[];
  allAssociations: AssociationRow[];
  softwareFeatures: SoftwareFeatureRow[];
  serviceItems: ServiceRow[];
  planPages: PlanPage[];
  layoutMaterialOrder: string[];
  floorPlanDataUrl: string | null;
  companyLogoDataUrl: string | null;
  materials: MaterialPage[];
}): Set<string> {
  const ignore = new Set(input.associationsToIgnore.map((a) => a.id));
  const s = new Set<string>();

  for (const a of input.allAssociations) {
    if (ignore.has(a.id)) continue;
    addAssocSlots(s, a);
  }

  for (const f of input.softwareFeatures) {
    for (const id of f.docMaterialIds) if (id) s.add(id);
  }

  for (const p of input.planPages) {
    if (p.backgroundMaterialId) s.add(p.backgroundMaterialId);
    if (p.overlayMaterialId) s.add(p.overlayMaterialId);
  }

  for (const id of input.layoutMaterialOrder) if (id) s.add(id);

  if (input.floorPlanDataUrl?.startsWith("data:")) {
    const hit = input.materials.find((m) => m.dataUrl === input.floorPlanDataUrl);
    if (hit) s.add(hit.id);
  }

  if (input.companyLogoDataUrl?.startsWith("data:")) {
    const hit = input.materials.find((m) => m.dataUrl === input.companyLogoDataUrl);
    if (hit) s.add(hit.id);
  }

  return s;
}

export function collectAssociationSlotMaterialIds(associations: AssociationRow[]): Set<string> {
  const s = new Set<string>();
  for (const a of associations) addAssocSlots(s, a);
  return s;
}
