import type { AssociationRow, ErpInventoryLine, MaterialPage } from "../types";

/** Shape of the full R2 catalog seed or the lightweight public picker index. */
export type BundledPisellHardwarePayload = {
  generatedAt?: number;
  materials: MaterialPage[];
  associations: Partial<AssociationRow>[];
  erpInventoryLines?: Partial<ErpInventoryLine>[];
};

let cachedPayload: BundledPisellHardwarePayload | null = null;

/**
 * The catalog contains product images and is intentionally served as a static file,
 * rather than imported into the JavaScript bundle. This keeps production builds
 * within Cloudflare's build-memory limit.
 */
export async function loadBundledPisellHardwarePayload(): Promise<BundledPisellHardwarePayload | null> {
  if (cachedPayload) return cachedPayload;
  try {
    const response = await fetch("/api/catalog-seed", {
      cache: "force-cache",
    });
    if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
      const payload = (await response.json()) as BundledPisellHardwarePayload;
      if (Array.isArray(payload.materials) && Array.isArray(payload.associations)) {
        cachedPayload = payload;
        return payload;
      }
    }
  } catch {
    // The Worker can be configured as a static SPA before the R2 API is bound.
  }
  try {
    const response = await fetch("./pisellCatalogIndex.json", { cache: "force-cache" });
    if (!response.ok) return null;
    const payload = (await response.json()) as BundledPisellHardwarePayload;
    if (!Array.isArray(payload.associations)) return null;
    cachedPayload = { ...payload, materials: [] };
    return cachedPayload;
  } catch {
    return null;
  }
}

/** Monotonic id from the static seed file; bump by regenerating the JSON. */
export function bundledPisellHardwareBuildId(payload: BundledPisellHardwarePayload | null): number {
  const g = payload?.generatedAt;
  return typeof g === "number" && Number.isFinite(g) && g > 0 ? g : 0;
}

export function isBundledPisellHardwareCatalogNonEmpty(payload: BundledPisellHardwarePayload | null): boolean {
  return Array.isArray(payload?.associations) && payload.associations.length > 0;
}
