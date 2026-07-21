import type { MaterialPage } from "../types";

export function orderedMaterialIds(
  materials: MaterialPage[],
  layoutMaterialOrder: string[],
): string[] {
  const setIds = new Set(materials.map((m) => m.id));
  const head = layoutMaterialOrder.filter((id) => setIds.has(id));
  const tail = materials.map((m) => m.id).filter((id) => !head.includes(id));
  return [...head, ...tail];
}
