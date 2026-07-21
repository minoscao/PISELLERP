import type { HardwarePlacement } from "../types";

/** 单个落点的数量；缺省或非法视为 1 */
export function placementQty(p: HardwarePlacement): number {
  const q = p.qty;
  return typeof q === "number" && Number.isFinite(q) && q >= 1 ? Math.floor(q) : 1;
}

export function placementCountForAssociation(
  associationId: string,
  placements: HardwarePlacement[],
): number {
  return placements
    .filter((p) => p.associationId === associationId)
    .reduce((s, p) => s + placementQty(p), 0);
}
