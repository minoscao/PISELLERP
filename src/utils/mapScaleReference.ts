import type { MapScaleReference } from "../types";

const clampPct = (value: number) => Math.min(100, Math.max(0, value));

/** Accept only usable scale references from persistence or imported project files. */
export function normalizeMapScaleReference(raw: unknown): MapScaleReference | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<MapScaleReference>;
  const fields = [value.startXPct, value.startYPct, value.endXPct, value.endYPct, value.lengthCm];
  if (!fields.every((field) => typeof field === "number" && Number.isFinite(field))) return null;
  const startXPct = clampPct(value.startXPct!);
  const startYPct = clampPct(value.startYPct!);
  const endXPct = clampPct(value.endXPct!);
  const endYPct = clampPct(value.endYPct!);
  if (Math.hypot(endXPct - startXPct, endYPct - startYPct) < 0.1) return null;
  return {
    startXPct,
    startYPct,
    endXPct,
    endYPct,
    lengthCm: Math.min(1_000_000, Math.max(0.1, value.lengthCm!)),
  };
}
