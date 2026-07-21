import {
  HARDWARE_IOT_BUCKET_CATEGORY_NAME,
  UNCATEGORIZED_CATEGORY_NAME,
} from "../constants/materialCategories";
import { SERVICE_CATEGORY_PRESETS, normalizeServiceCategoryStored } from "../constants/serviceCategoryPresets";
import { SOFTWARE_FEATURE_CATEGORY_PRESETS, normalizeSoftwareFeatureCategoryStored } from "../constants/softwareFeatureCategories";
import type {
  AssociationRow,
  ErpHardwareNavSortMode,
  ErpStockKind,
  MaterialCategoryDef,
  MaterialPage,
  ServiceRow,
  SoftwareFeatureRow,
} from "../types";
import { associationMapCategory } from "./associationCatalog";
import { categoryOptionText } from "./categoryDisplay";

/** 用于拆分「主类·子类」「主类-子类」的符号 */
const SUB_SEP = /[·•\u2010\u2011\u2012\u2013\u2014\u2015\-–—]/;

function normalizeText(s: string | undefined | null): string {
  return (s ?? "").trim();
}

/** 将导入/Excel 中的「Uncategorized」等与库内键 `未分类` 对齐；空字符串原样返回以免盖住 hardwareName */
export function normalizeStorageCategory(s: string | undefined | null): string {
  const t = normalizeText(s);
  if (!t) return "";
  if (/^uncategorized$/i.test(t)) return UNCATEGORIZED_CATEGORY_NAME;
  return t;
}

export function categoryPrimaryFromLabel(label: string): string {
  const t = normalizeText(label) || UNCATEGORIZED_CATEGORY_NAME;
  const i = t.search(SUB_SEP);
  if (i < 0) return t;
  return normalizeText(t.slice(0, i)) || t;
}

/** 与 primary 可能不同的完整 filter 键；无子类时与 primary 相同 */
export function fullCategoryKeyFromLabel(label: string): string {
  const t = normalizeText(label) || UNCATEGORIZED_CATEGORY_NAME;
  return t;
}

function secondaryDisplayShort(full: string, primary: string): string {
  if (full === primary) return full;
  const t = fullCategoryKeyFromLabel(full);
  const i = t.search(SUB_SEP);
  if (i < 0) return t;
  return normalizeText(t.slice(i + 1)) || t;
}

export type ErpCatRow = {
  kind: ErpStockKind;
  id: string;
  name: string;
  catalogOptionId: string | null;
  primary: string;
  /** 精确到行的过滤键；软件/服务为完整分类字符串，硬件为「素材类」或「类 · 规格」 */
  filterKey: string;
};

export function buildHardwareCatRows(
  associations: AssociationRow[],
  matById: Map<string, MaterialPage>,
  categoryDefs: MaterialCategoryDef[],
): ErpCatRow[] {
  const materials = [...matById.values()];
  const out: ErpCatRow[] = [];
  for (const a of associations) {
    const title = (a.deviceModel || a.hardwareName || a.id).trim();
    const mat = a.productMaterialId ? matById.get(a.productMaterialId) : null;
    const matCat = normalizeStorageCategory(mat?.category);
    const assocCat = normalizeStorageCategory(a.hardwareName);
    const matIsStale =
      !matCat ||
      matCat === UNCATEGORIZED_CATEGORY_NAME ||
      matCat === HARDWARE_IOT_BUCKET_CATEGORY_NAME;

    const primary =
      associationMapCategory(a, materials, categoryDefs).trim() || UNCATEGORIZED_CATEGORY_NAME;

    let filterKeyNoOpt: string;
    if (assocCat) {
      filterKeyNoOpt = fullCategoryKeyFromLabel(assocCat);
    } else if (!matIsStale && matCat) {
      filterKeyNoOpt = fullCategoryKeyFromLabel(matCat);
    } else {
      filterKeyNoOpt = primary;
    }

    const opts = a.options.filter((o) => o.label.trim());
    if (opts.length === 0) {
      out.push({
        kind: "hardware",
        id: a.id,
        name: title,
        catalogOptionId: null,
        primary,
        filterKey: filterKeyNoOpt,
      });
      continue;
    }
    for (const o of opts) {
      const fk = `${primary} · ${o.label.trim()}`;
      out.push({
        kind: "hardware",
        id: a.id,
        name: `${title} · ${o.label}`,
        catalogOptionId: o.id,
        primary,
        filterKey: fk,
      });
    }
  }
  return out;
}

export function buildSoftwareCatRows(features: SoftwareFeatureRow[]): ErpCatRow[] {
  return features.map((f) => {
    const fcRaw = normalizeSoftwareFeatureCategoryStored(f.featureCategory);
    const key = fullCategoryKeyFromLabel(fcRaw || UNCATEGORIZED_CATEGORY_NAME);
    const pr = categoryPrimaryFromLabel(key);
    return {
      kind: "software" as const,
      id: f.id,
      name: f.featureName || f.id,
      catalogOptionId: null,
      primary: pr,
      filterKey: key,
    };
  });
}

export function buildServiceCatRows(items: ServiceRow[]): ErpCatRow[] {
  return items.map((s) => {
    const scRaw = normalizeServiceCategoryStored(s.serviceCategory);
    const key = fullCategoryKeyFromLabel(scRaw || UNCATEGORIZED_CATEGORY_NAME);
    const pr = categoryPrimaryFromLabel(key);
    return {
      kind: "service" as const,
      id: s.id,
      name: s.serviceName || s.id,
      catalogOptionId: null,
      primary: pr,
      filterKey: key,
    };
  });
}

export function listPrimariesForKind(rows: ErpCatRow[], kind: ErpStockKind): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.kind === kind) set.add(r.primary);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function listSecondariesForPrimary(rows: ErpCatRow[], kind: ErpStockKind, primary: string): { key: string; label: string }[] {
  const set = new Map<string, string>();
  for (const r of rows) {
    if (r.kind !== kind || r.primary !== primary) continue;
    if (r.filterKey === r.primary) continue;
    /** 硬件：子目录只表示「素材子类」等，不把规格 (Spec options) 行当成子文件夹 */
    if (kind === "hardware" && r.catalogOptionId != null) continue;
    if (!set.has(r.filterKey)) {
      set.set(r.filterKey, secondaryDisplayShort(r.filterKey, primary));
    }
  }
  return Array.from(set.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.key.localeCompare(b.key, undefined, { sensitivity: "base" }));
}

export function filterCatRows(
  rows: ErpCatRow[],
  kind: ErpStockKind,
  primary: string | null,
  filterKey: string | null,
): ErpCatRow[] {
  const kindRows = rows.filter((r) => r.kind === kind);
  /** 未选左侧分类时：中间栏仍显示该 kind 全部行（避免无数据时整栏空白） */
  if (!primary) return kindRows;
  const base = kindRows.filter((r) => r.primary === primary);
  if (!filterKey) return base;
  return base.filter((r) => r.filterKey === filterKey);
}

/** 左侧硬件主类展示名（与 ERP 左栏一致） */
export function hardwareNavPrimaryLabel(primary: string, defs: MaterialCategoryDef[]): string {
  const inGroup = defs.filter((d) => categoryPrimaryFromLabel(d.name) === primary);
  if (inGroup.length === 0) return primary;
  const withEn = inGroup.find((d) => d.nameEn?.trim());
  if (withEn?.nameEn) {
    const s = withEn.nameEn.trim();
    const j = s.indexOf(" · ");
    if (j > 0) return s.slice(0, j).trim();
    return s;
  }
  return primary;
}

/** 硬件主类顺序：按 `categoryDefs` 在库中的顺序，其余主类按名称（便于与手动重排 `categoryDefs` 一致） */
export function sortHardwareNavPrimariesByDefsOrder(primaries: string[], defs: MaterialCategoryDef[]): string[] {
  const want = new Set(primaries);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const d of defs) {
    const n = normalizeStorageCategory(d.name);
    const p = n ? categoryPrimaryFromLabel(n) : UNCATEGORIZED_CATEGORY_NAME;
    if (!want.has(p) || seen.has(p)) continue;
    seen.add(p);
    ordered.push(p);
  }
  const rest = [...want]
    .filter((p) => !seen.has(p))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return [...ordered, ...rest];
}

/**
 * 左侧导航「主类」：合并 categoryDefs、素材 category、以及已有行，避免「无行则无类名」。
 * 行内主类由「素材类名」与「表单分类 hardwareName」共同推导，见 `buildHardwareCatRows`。
 */
export function listHardwareNavPrimaries(
  allRows: ErpCatRow[],
  categoryDefs: MaterialCategoryDef[] | undefined,
  materials: MaterialPage[] | undefined,
): string[] {
  const set = new Set<string>();
  for (const d of categoryDefs ?? []) {
    const n = normalizeStorageCategory(d.name);
    if (n) set.add(categoryPrimaryFromLabel(n));
  }
  for (const m of materials ?? []) {
    const c = normalizeStorageCategory(m.category);
    if (c) set.add(categoryPrimaryFromLabel(c));
  }
  for (const r of allRows) {
    if (r.kind === "hardware") set.add(r.primary);
  }
  return sortHardwareNavPrimariesByDefsOrder(Array.from(set), categoryDefs ?? []);
}

/** 软件：预设主类 + 行内实际出现的主类 */
export function listSoftwareNavPrimaries(allRows: ErpCatRow[]): string[] {
  const set = new Set<string>([...SOFTWARE_FEATURE_CATEGORY_PRESETS]);
  for (const r of allRows) {
    if (r.kind === "software") set.add(r.primary);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** 服务：预设主类 + 行内实际出现的主类 */
export function listServiceNavPrimaries(allRows: ErpCatRow[]): string[] {
  const set = new Set<string>([...SERVICE_CATEGORY_PRESETS]);
  for (const r of allRows) {
    if (r.kind === "service") set.add(r.primary);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** 左侧主类列表：未分类固定第一行 */
export function sortCatalogPrimariesUncategorizedFirst(names: string[]): string[] {
  const u = UNCATEGORIZED_CATEGORY_NAME;
  const hasU = names.some((x) => x === u);
  const rest = names.filter((x) => x !== u).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return hasU ? [u, ...rest] : [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** 左侧已选目录、且中间未选中具体行时，右侧硬件编辑区默认分类名 */
export function resolveHardwareCategoryNameForNav(
  primary: string | null,
  filterKey: string | null,
  defs: MaterialCategoryDef[],
): string | null {
  const fk = filterKey ? normalizeText(filterKey) : "";
  const pr = primary == null ? "" : normalizeText(primary);
  if (!fk && !pr) return null;
  if (fk && defs.some((d) => d.name === fk)) return fk;
  if (pr) {
    const byPrimary = defs.find((d) => categoryPrimaryFromLabel(d.name) === pr);
    if (byPrimary) return byPrimary.name;
    if (defs.some((d) => d.name === pr)) return pr;
    if (fk && categoryPrimaryFromLabel(fk) === pr) return fk;
  }
  if (fk) return fk;
  return pr || null;
}

/** 同上：软件功能分类 */
export function resolveSoftwareCategoryForNav(primary: string | null, filterKey: string | null): string {
  const fk = filterKey ? normalizeText(filterKey) : "";
  const pr = primary == null ? "" : normalizeText(primary);
  const presets = SOFTWARE_FEATURE_CATEGORY_PRESETS as readonly string[];
  const fallback = SOFTWARE_FEATURE_CATEGORY_PRESETS[0] ?? "Sales";
  if (fk) {
    const n = normalizeSoftwareFeatureCategoryStored(fk);
    if (presets.includes(n)) return n;
    return fk || fallback;
  }
  if (pr) {
    const hit = SOFTWARE_FEATURE_CATEGORY_PRESETS.find((p) => categoryPrimaryFromLabel(p) === pr);
    if (hit) return hit;
    const n = normalizeSoftwareFeatureCategoryStored(pr);
    if (presets.includes(n)) return n;
    return pr || fallback;
  }
  return fallback;
}

/** 同上：服务分类 */
export function resolveServiceCategoryForNav(primary: string | null, filterKey: string | null): string {
  const fk = filterKey ? normalizeText(filterKey) : "";
  const pr = primary == null ? "" : normalizeText(primary);
  const presets = SERVICE_CATEGORY_PRESETS as readonly string[];
  const fallback = SERVICE_CATEGORY_PRESETS[0] ?? "Consulting";
  if (fk) {
    const n = normalizeServiceCategoryStored(fk);
    if (presets.includes(n)) return n;
    return fk || fallback;
  }
  if (pr) {
    const hit = SERVICE_CATEGORY_PRESETS.find((p) => categoryPrimaryFromLabel(p) === pr);
    if (hit) return hit;
    const n = normalizeServiceCategoryStored(pr);
    if (presets.includes(n)) return n;
    return pr || fallback;
  }
  return fallback;
}

export function filterAssociationsByCatalogNav(
  associations: AssociationRow[],
  matById: Map<string, MaterialPage>,
  categoryDefs: MaterialCategoryDef[],
  primary: string | null,
  filterKey: string | null,
): AssociationRow[] {
  const rows = buildHardwareCatRows(associations, matById, categoryDefs);
  const idSet = new Set(filterCatRows(rows, "hardware", primary, filterKey).map((r) => r.id));
  return associations.filter((a) => idSet.has(a.id));
}

export function filterSoftwareFeaturesByCatalogNav(
  features: SoftwareFeatureRow[],
  primary: string | null,
  filterKey: string | null,
): SoftwareFeatureRow[] {
  const rows = buildSoftwareCatRows(features);
  const idSet = new Set(filterCatRows(rows, "software", primary, filterKey).map((r) => r.id));
  return features.filter((f) => idSet.has(f.id));
}

export function filterServiceItemsByCatalogNav(
  items: ServiceRow[],
  primary: string | null,
  filterKey: string | null,
): ServiceRow[] {
  const rows = buildServiceCatRows(items);
  const idSet = new Set(filterCatRows(rows, "service", primary, filterKey).map((r) => r.id));
  return items.filter((s) => idSet.has(s.id));
}

export function erpCatalogRowMatchesQuery(r: ErpCatRow, query: string): boolean {
  const t = query.trim().toLowerCase();
  if (!t) return true;
  return (
    r.name.toLowerCase().includes(t) ||
    r.primary.toLowerCase().includes(t) ||
    r.filterKey.toLowerCase().includes(t)
  );
}

/** 硬件行：型号、表单分类、规格名、各槽位素材标题与分类 */
export function associationMatchesErpCatalogSearch(
  a: AssociationRow,
  query: string,
  matById: Map<string, MaterialPage>,
): boolean {
  const t = query.trim().toLowerCase();
  if (!t) return true;
  if ((a.deviceModel ?? "").toLowerCase().includes(t)) return true;
  if ((a.hardwareName ?? "").toLowerCase().includes(t)) return true;
  for (const o of a.options) {
    if ((o.label ?? "").toLowerCase().includes(t)) return true;
  }
  for (const mid of [a.productMaterialId, a.quoteAdMaterialId, a.technicalMaterialId]) {
    if (!mid) continue;
    const m = matById.get(mid);
    if (!m) continue;
    if ((m.category ?? "").toLowerCase().includes(t)) return true;
    if ((m.fileName ?? "").toLowerCase().includes(t)) return true;
  }
  return false;
}

export function softwareFeatureMatchesErpCatalogSearch(
  f: SoftwareFeatureRow,
  query: string,
  matById?: Map<string, MaterialPage>,
): boolean {
  const t = query.trim().toLowerCase();
  if (!t) return true;
  if ((f.featureName ?? "").toLowerCase().includes(t)) return true;
  if ((f.featureCategory ?? "").toLowerCase().includes(t)) return true;
  if (matById) {
    for (const mid of f.docMaterialIds) {
      if (!mid) continue;
      const m = matById.get(mid);
      if (!m) continue;
      if ((m.category ?? "").toLowerCase().includes(t)) return true;
      if ((m.fileName ?? "").toLowerCase().includes(t)) return true;
    }
  }
  return false;
}

export function serviceItemMatchesErpCatalogSearch(s: ServiceRow, query: string): boolean {
  const t = query.trim().toLowerCase();
  if (!t) return true;
  if ((s.serviceName ?? "").toLowerCase().includes(t)) return true;
  if ((s.serviceCategory ?? "").toLowerCase().includes(t)) return true;
  return false;
}

export function filterHardwareNavPrimariesForSearch(
  primaries: string[],
  query: string,
  associations: AssociationRow[],
  matById: Map<string, MaterialPage>,
  defs: MaterialCategoryDef[],
): string[] {
  const q = query.trim();
  if (!q) return primaries;
  const ql = q.toLowerCase();
  return primaries.filter((p) => {
    if (hardwareNavPrimaryLabel(p, defs).toLowerCase().includes(ql)) return true;
    if (p.toLowerCase().includes(ql)) return true;
    return associations.some((a) => {
      if (!associationMatchesErpCatalogSearch(a, q, matById)) return false;
      return buildHardwareCatRows([a], matById, defs).some((r) => r.primary === p);
    });
  });
}

export function filterSoftwareNavPrimariesForSearch(
  primaries: string[],
  query: string,
  allRows: ErpCatRow[],
): string[] {
  const q = query.trim();
  if (!q) return primaries;
  const ql = q.toLowerCase();
  return primaries.filter(
    (p) =>
      p.toLowerCase().includes(ql) ||
      allRows.some((r) => r.kind === "software" && r.primary === p && erpCatalogRowMatchesQuery(r, q)),
  );
}

export function filterServiceNavPrimariesForSearch(
  primaries: string[],
  query: string,
  allRows: ErpCatRow[],
): string[] {
  const q = query.trim();
  if (!q) return primaries;
  const ql = q.toLowerCase();
  return primaries.filter(
    (p) =>
      p.toLowerCase().includes(ql) ||
      allRows.some((r) => r.kind === "service" && r.primary === p && erpCatalogRowMatchesQuery(r, q)),
  );
}

/**
 * 在「全库主类顺序」中只重排 `subsetOrdered` 这一段（例如市场资料子集侧栏），
 * 其它主类相对顺序不变。
 */
export function mergeHardwarePrimarySubsetOrder(fullOrder: string[], subsetOrdered: string[]): string[] {
  const subset = new Set(subsetOrdered);
  if (subset.size === 0) return fullOrder;
  const indices = [...subset].map((p) => fullOrder.indexOf(p)).filter((i) => i >= 0);
  if (indices.length === 0) return [...fullOrder.filter((p) => !subset.has(p)), ...subsetOrdered];
  const pos = Math.min(...indices);
  const without = fullOrder.filter((p) => !subset.has(p));
  const insertAt = fullOrder.slice(0, pos + 1).filter((p) => !subset.has(p)).length;
  return [...without.slice(0, insertAt), ...subsetOrdered, ...without.slice(insertAt)];
}

/** 按硬件主类重排 `categoryDefs`（同主类下子类相对顺序不变） */
export function reorderCategoryDefsByHardwarePrimary(
  defs: MaterialCategoryDef[],
  orderedPrimaries: string[],
): MaterialCategoryDef[] {
  const byPrimary = new Map<string, MaterialCategoryDef[]>();
  for (const d of defs) {
    const n = normalizeStorageCategory(d.name);
    const pr = n ? categoryPrimaryFromLabel(n) : UNCATEGORIZED_CATEGORY_NAME;
    if (!byPrimary.has(pr)) byPrimary.set(pr, []);
    byPrimary.get(pr)!.push(d);
  }
  const placed = new Set<string>();
  const next: MaterialCategoryDef[] = [];
  for (const p of orderedPrimaries) {
    const group = byPrimary.get(p);
    if (!group?.length) continue;
    for (const d of group) next.push(d);
    placed.add(p);
  }
  const restKeys = [...byPrimary.keys()]
    .filter((p) => !placed.has(p))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  for (const p of restKeys) {
    for (const d of byPrimary.get(p)!) next.push(d);
  }
  return next;
}

/** 硬件主类顺序：manual 保持输入顺序；A–Z 时「未分类」固定最前，其余按展示名排序 */
export function sortHardwareNavPrimariesByMode(
  primaries: string[],
  defs: MaterialCategoryDef[],
  mode: ErpHardwareNavSortMode,
): string[] {
  if (mode === "manual") return [...primaries];
  const u = UNCATEGORIZED_CATEGORY_NAME;
  const hasU = primaries.some((x) => x === u);
  const rest = primaries.filter((x) => x !== u);
  const sortedRest = [...rest].sort((a, b) =>
    hardwareNavPrimaryLabel(a, defs).localeCompare(hardwareNavPrimaryLabel(b, defs), "en", { sensitivity: "base" }),
  );
  return hasU ? [u, ...sortedRest] : sortedRest;
}

/** 左侧硬件子目录行顺序：manual 与分类库 `categoryDefs` 顺序一致；A–Z 按选项展示名 */
export function orderHardwareSecondariesForNav(
  secondaryRows: { key: string; label: string }[],
  categoryDefs: MaterialCategoryDef[],
  mode: ErpHardwareNavSortMode,
): { key: string; label: string }[] {
  if (mode === "az") {
    return [...secondaryRows].sort((a, b) => {
      const da = categoryDefs.find((d) => d.name === a.key);
      const db = categoryDefs.find((d) => d.name === b.key);
      const la = da ? categoryOptionText(da) : a.label;
      const lb = db ? categoryOptionText(db) : b.label;
      return la.localeCompare(lb, "en", { sensitivity: "base" }) || a.key.localeCompare(b.key, undefined, { sensitivity: "base" });
    });
  }
  const idx = (key: string) => {
    const i = categoryDefs.findIndex((d) => d.name === key);
    return i < 0 ? 1e9 : i;
  };
  return [...secondaryRows].sort(
    (a, b) => idx(a.key) - idx(b.key) || a.key.localeCompare(b.key, undefined, { sensitivity: "base" }),
  );
}
