import type { SoftwareFeatureRow } from "../types";
import { normalizeSoftwareFeatureCategoryStored } from "../constants/softwareFeatureCategories";
import { softwareMaterialCategoryPath } from "../constants/softwareMaterialPaths";

/** Material `category` string for software-doc uploads; must stay in sync with software library rows. */
export function softwareFeatureMaterialCategory(
  f: Pick<SoftwareFeatureRow, "featureCategory" | "featureName">,
): string {
  const cat = normalizeSoftwareFeatureCategoryStored(f.featureCategory ?? "");
  const name = (f.featureName ?? "").trim() || "Untitled";
  return softwareMaterialCategoryPath(cat, name);
}
