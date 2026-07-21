import type { SoftwareFeatureRow, SoftwarePriceBillingMode } from "../types";

export function normalizeSoftwarePriceBilling(raw: unknown): SoftwarePriceBillingMode {
  if (raw === "monthly" || raw === "yearly") return raw;
  return "one_time";
}

export function softwareBillingMode(f: Pick<SoftwareFeatureRow, "softwarePriceBilling">): SoftwarePriceBillingMode {
  return normalizeSoftwarePriceBilling(f.softwarePriceBilling);
}

export function isSoftwareBillingOneTime(f: Pick<SoftwareFeatureRow, "softwarePriceBilling">): boolean {
  return softwareBillingMode(f) === "one_time";
}
