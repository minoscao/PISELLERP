/** Canonical English category labels for services (enterprise + datalist). */
export const SERVICE_CATEGORY_PRESETS = [
  "Consulting",
  "Design",
  "Development",
  "Field",
  "Remote",
  "Training",
] as const;

const LEGACY_SERVICE_CATEGORY_TO_EN: Record<string, string> = {
  咨询规划: "Consulting",
  设计服务: "Design",
  开发服务: "Development",
  现场服务: "Field",
  远程服务: "Remote",
  培训服务: "Training",
};

export function normalizeServiceCategoryStored(raw: string | undefined | null): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  return LEGACY_SERVICE_CATEGORY_TO_EN[t] ?? t;
}
