/** Canonical prefix for software-linked material categories (storage). */
export const SOFTWARE_MATERIAL_PREFIX = "Software";
export const LEGACY_SOFTWARE_MATERIAL_PREFIX = "软件功能";

const SEP = " · ";

export function softwareMaterialCategoryPath(featureCategory: string, featureName: string): string {
  const cat = featureCategory.trim() || "Uncategorized";
  const name = featureName.trim() || "Untitled";
  return `${SOFTWARE_MATERIAL_PREFIX}${SEP}${cat}${SEP}${name}`;
}

export function isSoftwareMaterialCategoryName(name: string): boolean {
  return (
    name.startsWith(`${SOFTWARE_MATERIAL_PREFIX}${SEP}`) ||
    name.startsWith(`${LEGACY_SOFTWARE_MATERIAL_PREFIX}${SEP}`)
  );
}

export function softwareMaterialParentKeyFromPath(name: string): string {
  const i = name.indexOf(SEP);
  if (i === -1) return name.trim() || "Other";
  return name.slice(0, i).trim() || "Other";
}
