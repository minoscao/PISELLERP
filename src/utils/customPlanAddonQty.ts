import type { CustomPlanServiceLine, CustomPlanSoftwareLine } from "../types";

export type AddonQtyLinePick =
  | Pick<CustomPlanSoftwareLine, "addonIds" | "addonQtyById">
  | Pick<CustomPlanServiceLine, "addonIds" | "addonQtyById">;

/** Merge legacy `addonIds` (each ×1) with optional `addonQtyById`; drops zero qty. */
export function mergeAddonQtyMap(line: AddonQtyLinePick): Record<string, number> {
  const out: Record<string, number> = {};
  const raw = line.addonQtyById;
  const useExplicitQty =
    raw !== undefined && typeof raw === "object" && raw !== null && !Array.isArray(raw);
  if (useExplicitQty) {
    for (const [k, v] of Object.entries(raw)) {
      if (typeof k !== "string" || !k.trim()) continue;
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const n = Math.max(0, Math.floor(v));
      if (n > 0) out[k.trim()] = n;
    }
    return out;
  }
  for (const id of line.addonIds ?? []) {
    if (typeof id === "string" && id) out[id] = 1;
  }
  return out;
}

export function addonIdsSortedFromQty(qty: Record<string, number>): string[] {
  return Object.keys(qty).sort((a, b) => a.localeCompare(b));
}

export function filterAddonQtyMapForCatalog(qty: Record<string, number>, validIds: Set<string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, q] of Object.entries(qty)) {
    if (validIds.has(id) && q >= 1) out[id] = q;
  }
  return out;
}
