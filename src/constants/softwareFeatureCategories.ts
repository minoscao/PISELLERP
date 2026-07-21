/** Stored values (English). UI labels follow locale via i18n. */
export const SOFTWARE_FEATURE_CATEGORY_PRESETS = ["Sales", "Management", "Fulfillment"] as const;

export type SoftwareFeatureCategoryPreset = (typeof SOFTWARE_FEATURE_CATEGORY_PRESETS)[number];

/** Map legacy Chinese preset labels to stored English keys. */
export const LEGACY_SOFTWARE_FEATURE_CATEGORY_TO_EN: Record<string, SoftwareFeatureCategoryPreset | undefined> = {
  销售类: "Sales",
  管理类: "Management",
  履约类: "Fulfillment",
};

export function normalizeSoftwareFeatureCategoryStored(raw: string): string {
  const t = raw.trim();
  const mapped = LEGACY_SOFTWARE_FEATURE_CATEGORY_TO_EN[t];
  if (mapped) return mapped;
  return t;
}
