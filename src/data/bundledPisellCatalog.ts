import type { AssociationRow, ErpInventoryLine, MaterialPage } from "../types";

/** Shape of `src/data/pisellHardwareSeed.json` (also written to `public/` by the seed script). */
export type BundledPisellHardwarePayload = {
  generatedAt?: number;
  materials: MaterialPage[];
  associations: Partial<AssociationRow>[];
  erpInventoryLines?: Partial<ErpInventoryLine>[];
};

import bundledJson from "./pisellHardwareSeed.json";

export const bundledPisellHardwarePayload = bundledJson as BundledPisellHardwarePayload;

/** Monotonic id from seed file; bump by regenerating the JSON (`generatedAt` timestamp). */
export function bundledPisellHardwareBuildId(): number {
  const g = bundledPisellHardwarePayload.generatedAt;
  return typeof g === "number" && Number.isFinite(g) && g > 0 ? g : 0;
}

export function isBundledPisellHardwareCatalogNonEmpty(): boolean {
  const p = bundledPisellHardwarePayload;
  return Array.isArray(p.associations) && p.associations.length > 0;
}
