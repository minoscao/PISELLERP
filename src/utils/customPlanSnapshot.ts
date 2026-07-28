import type { MapThemeMode } from "../icons/mapColors";
import type {
  CustomPlanSelectStep,
  CustomPlanServiceLine,
  CustomPlanSnapshotData,
  CustomPlanSoftwareLine,
  CustomPlanTab,
  HardwarePlacement,
  MaterialPage,
  PlanPage,
  QuotePriceTier,
  QuoteTableRowKey,
  SavedCustomPlan,
} from "../types";
import { addonIdsSortedFromQty, mergeAddonQtyMap } from "./customPlanAddonQty";
import { normalizePlanVisibility, uniqueUserIds } from "../config/auth";
import { normalizePlacement } from "./hardwareOptionsAddons";
import { normalizePlanPreviewExtra } from "./planPreviewExtra";
import { parseQuoteTableOrder } from "./quoteTableOrder";

export type CustomPlanSnapshotSource = {
  placements: HardwarePlacement[];
  floorPlanDataUrl: string | null;
  floorPlanOpacityPct: number;
  floorPlanPlacementImageSpace: boolean;
  mapShowName: boolean;
  mapShowQuantity: boolean;
  mapTheme: MapThemeMode;
  mapPlacementGlyphScale: number;
  customPlanSoftwareLines: CustomPlanSoftwareLine[];
  customPlanServiceLines: CustomPlanServiceLine[];
  planPages: PlanPage[];
  quoteFooterCustom: string;
  quoteTableOrder: QuoteTableRowKey[] | null;
  quotationRef: string | null;
  quoteExportIncludeImages: boolean;
  quoteGlobalPriceTier: QuotePriceTier;
  customPlanTab: CustomPlanTab;
  customPlanSelectStep: CustomPlanSelectStep;
};

function normalizeSoftwareLine(raw: Partial<CustomPlanSoftwareLine>): CustomPlanSoftwareLine {
  const q = raw.quantity;
  const quantity = typeof q === "number" && Number.isFinite(q) ? Math.max(0, Math.floor(q)) : 1;
  const addonIdsLegacy = Array.isArray(raw.addonIds) ? raw.addonIds.filter((x): x is string => typeof x === "string") : [];
  const rq = raw.addonQtyById;
  const addonQtyRaw =
    rq && typeof rq === "object" && !Array.isArray(rq) ? (rq as Record<string, number>) : undefined;
  const addonQtyById = mergeAddonQtyMap({ addonIds: addonIdsLegacy, addonQtyById: addonQtyRaw });
  const addonIds = addonIdsSortedFromQty(addonQtyById);
  const lto = raw.lineTotalOverride;
  const lineTotalOverride =
    lto !== null && lto !== undefined && typeof lto === "number" && Number.isFinite(lto) && lto >= 0 ? lto : null;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
    catalogFeatureId: String(raw.catalogFeatureId ?? ""),
    quantity,
    optionId: typeof raw.optionId === "string" && raw.optionId ? raw.optionId : null,
    addonIds,
    addonQtyById,
    lineTotalOverride,
    quoteLineNote: typeof raw.quoteLineNote === "string" ? raw.quoteLineNote : "",
  };
}

function normalizeServiceLine(raw: Partial<CustomPlanServiceLine>): CustomPlanServiceLine {
  const q = raw.quantity;
  const quantity = typeof q === "number" && Number.isFinite(q) ? Math.max(0, Math.floor(q)) : 1;
  const addonIdsLegacy = Array.isArray(raw.addonIds) ? raw.addonIds.filter((x): x is string => typeof x === "string") : [];
  const rq = raw.addonQtyById;
  const addonQtyRaw =
    rq && typeof rq === "object" && !Array.isArray(rq) ? (rq as Record<string, number>) : undefined;
  const addonQtyById = mergeAddonQtyMap({ addonIds: addonIdsLegacy, addonQtyById: addonQtyRaw });
  const addonIds = addonIdsSortedFromQty(addonQtyById);
  const lto = raw.lineTotalOverride;
  const lineTotalOverride =
    lto !== null && lto !== undefined && typeof lto === "number" && Number.isFinite(lto) && lto >= 0 ? lto : null;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
    catalogServiceId: String(raw.catalogServiceId ?? ""),
    quantity,
    optionId: typeof raw.optionId === "string" && raw.optionId ? raw.optionId : null,
    addonIds,
    addonQtyById,
    lineTotalOverride,
    quoteLineNote: typeof raw.quoteLineNote === "string" ? raw.quoteLineNote : "",
  };
}

function normalizePlanPages(raw: unknown, materials: MaterialPage[]): PlanPage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o, i) => {
      const x = o as Partial<PlanPage>;
      const bg = String(x.backgroundDataUrl ?? "");
      if (!bg) return null;
      const cropRaw = x.overlayCropAspect;
      const crop =
        typeof cropRaw === "string" && /^\d+:\d+$/.test(String(cropRaw).trim()) ? String(cropRaw).trim() : undefined;
      const bgMidRaw = x.backgroundMaterialId;
      const bgMidGuess =
        typeof bgMidRaw === "string" && bgMidRaw ? bgMidRaw : (materials.find((mm) => mm.dataUrl === bg)?.id ?? null);
      const page: PlanPage = {
        id: typeof x.id === "string" && x.id ? x.id : crypto.randomUUID(),
        backgroundDataUrl: bg,
        widthPx: Number(x.widthPx) || 800,
        heightPx: Number(x.heightPx) || 600,
        sourceFileName: String(x.sourceFileName ?? "方案.pdf"),
        sourcePage: Number.isFinite(Number(x.sourcePage)) ? Number(x.sourcePage) : i,
        backgroundMaterialId: bgMidGuess,
        overlayMaterialId:
          typeof x.overlayMaterialId === "string" && x.overlayMaterialId ? x.overlayMaterialId : null,
      };
      if (crop) page.overlayCropAspect = crop;
      if (x.previewExtra !== undefined && x.previewExtra !== null) {
        page.previewExtra = normalizePlanPreviewExtra(x.previewExtra);
      }
      return page;
    })
    .filter((x): x is PlanPage => x !== null);
}

export function snapshotRichness(data: CustomPlanSnapshotData): number {
  let score = 0;
  if (typeof data.floorPlanDataUrl === "string" && data.floorPlanDataUrl.length > 64) score += 800;
  score += data.placements.length * 25;
  score += data.planPages.length * 12;
  score += data.customPlanSoftwareLines.length * 4;
  score += data.customPlanServiceLines.length * 4;
  if (data.quoteFooterCustom.trim()) score += 3;
  return score;
}

export function pickRicherCustomPlanSnapshot(
  a: CustomPlanSnapshotData,
  b: CustomPlanSnapshotData,
): CustomPlanSnapshotData {
  return snapshotRichness(a) >= snapshotRichness(b) ? a : b;
}

export function captureCustomPlanSnapshotFromSlice(
  slice: Partial<CustomPlanSnapshotSource>,
): CustomPlanSnapshotData {
  const empty = emptyCustomPlanSnapshot();
  return captureCustomPlanSnapshot({
    placements: slice.placements ?? empty.placements,
    floorPlanDataUrl: slice.floorPlanDataUrl ?? empty.floorPlanDataUrl,
    floorPlanOpacityPct: slice.floorPlanOpacityPct ?? empty.floorPlanOpacityPct,
    floorPlanPlacementImageSpace: slice.floorPlanPlacementImageSpace ?? empty.floorPlanPlacementImageSpace,
    mapShowName: slice.mapShowName ?? empty.mapShowName,
    mapShowQuantity: slice.mapShowQuantity ?? empty.mapShowQuantity,
    mapTheme: slice.mapTheme ?? empty.mapTheme,
    mapPlacementGlyphScale: slice.mapPlacementGlyphScale ?? empty.mapPlacementGlyphScale,
    customPlanSoftwareLines: slice.customPlanSoftwareLines ?? empty.customPlanSoftwareLines,
    customPlanServiceLines: slice.customPlanServiceLines ?? empty.customPlanServiceLines,
    planPages: slice.planPages ?? empty.planPages,
    quoteFooterCustom: slice.quoteFooterCustom ?? empty.quoteFooterCustom,
    quoteTableOrder: slice.quoteTableOrder ?? empty.quoteTableOrder,
    quotationRef: slice.quotationRef ?? empty.quotationRef,
    quoteExportIncludeImages: slice.quoteExportIncludeImages ?? empty.quoteExportIncludeImages,
    quoteGlobalPriceTier: slice.quoteGlobalPriceTier ?? empty.quoteGlobalPriceTier,
    customPlanTab: slice.customPlanTab ?? empty.customPlanTab,
    customPlanSelectStep: slice.customPlanSelectStep ?? empty.customPlanSelectStep,
  });
}

export function emptyCustomPlanSnapshot(): CustomPlanSnapshotData {
  return {
    placements: [],
    floorPlanDataUrl: null,
    floorPlanOpacityPct: 100,
    floorPlanPlacementImageSpace: true,
    mapShowName: true,
    mapShowQuantity: false,
    mapTheme: "dark",
    mapPlacementGlyphScale: 1,
    customPlanSoftwareLines: [],
    customPlanServiceLines: [],
    planPages: [],
    quoteFooterCustom: "",
    quoteTableOrder: null,
    quotationRef: null,
    quoteExportIncludeImages: false,
    quoteGlobalPriceTier: "regular",
    customPlanTab: "select",
    customPlanSelectStep: "map",
  };
}

export function captureCustomPlanSnapshot(s: CustomPlanSnapshotSource): CustomPlanSnapshotData {
  return {
    placements: s.placements.map((p) => normalizePlacement({ ...p, addonIds: [...p.addonIds] })),
    floorPlanDataUrl: s.floorPlanDataUrl,
    floorPlanOpacityPct:
      typeof s.floorPlanOpacityPct === "number" && Number.isFinite(s.floorPlanOpacityPct)
        ? Math.min(100, Math.max(0, Math.round(s.floorPlanOpacityPct)))
        : 100,
    floorPlanPlacementImageSpace: s.floorPlanPlacementImageSpace === true,
    mapShowName: s.mapShowName,
    mapShowQuantity: s.mapShowQuantity,
    mapTheme: s.mapTheme === "light" ? "light" : "dark",
    mapPlacementGlyphScale:
      typeof s.mapPlacementGlyphScale === "number" && Number.isFinite(s.mapPlacementGlyphScale)
        ? Math.min(2.5, Math.max(0.5, s.mapPlacementGlyphScale))
        : 1,
    customPlanSoftwareLines: s.customPlanSoftwareLines.map((l) => normalizeSoftwareLine(l)),
    customPlanServiceLines: s.customPlanServiceLines.map((l) => normalizeServiceLine(l)),
    planPages: s.planPages.map((p) => ({ ...p })),
    quoteFooterCustom: s.quoteFooterCustom,
    quoteTableOrder: s.quoteTableOrder ? [...s.quoteTableOrder] : null,
    quotationRef: s.quotationRef?.trim() ? s.quotationRef.trim() : null,
    quoteExportIncludeImages: s.quoteExportIncludeImages,
    quoteGlobalPriceTier:
      s.quoteGlobalPriceTier === "vip" || s.quoteGlobalPriceTier === "vvip" ? s.quoteGlobalPriceTier : "regular",
    customPlanTab: s.customPlanTab === "plan" || s.customPlanTab === "quote" ? s.customPlanTab : "select",
    customPlanSelectStep:
      s.customPlanSelectStep === "software" || s.customPlanSelectStep === "services"
        ? s.customPlanSelectStep
        : "map",
  };
}

export function normalizeCustomPlanSnapshotData(
  raw: unknown,
  ctx: { materials: MaterialPage[]; softwareFeatureIds: Set<string>; serviceIds: Set<string>; associationIds: Set<string> },
): CustomPlanSnapshotData {
  const base = emptyCustomPlanSnapshot();
  if (!raw || typeof raw !== "object") return base;
  const d = raw as Partial<CustomPlanSnapshotData>;

  const placements = Array.isArray(d.placements)
    ? d.placements
        .map((p) => normalizePlacement(p as HardwarePlacement))
        .filter((p) => ctx.associationIds.has(p.associationId))
    : [];

  const customPlanSoftwareLines = Array.isArray(d.customPlanSoftwareLines)
    ? d.customPlanSoftwareLines
        .map((x) => normalizeSoftwareLine(x as Partial<CustomPlanSoftwareLine>))
        .filter((l) => ctx.softwareFeatureIds.has(l.catalogFeatureId))
    : [];

  const customPlanServiceLines = Array.isArray(d.customPlanServiceLines)
    ? d.customPlanServiceLines
        .map((x) => normalizeServiceLine(x as Partial<CustomPlanServiceLine>))
        .filter((l) => ctx.serviceIds.has(l.catalogServiceId))
    : [];

  let quoteTableOrder: QuoteTableRowKey[] | null = null;
  if (d.quoteTableOrder === null) quoteTableOrder = null;
  else if (d.quoteTableOrder !== undefined) {
    const parsed = parseQuoteTableOrder(d.quoteTableOrder);
    if (parsed) quoteTableOrder = parsed;
  }

  return {
    placements,
    floorPlanDataUrl: typeof d.floorPlanDataUrl === "string" || d.floorPlanDataUrl === null ? d.floorPlanDataUrl : null,
    floorPlanOpacityPct:
      typeof d.floorPlanOpacityPct === "number" && Number.isFinite(d.floorPlanOpacityPct)
        ? Math.min(100, Math.max(0, Math.round(d.floorPlanOpacityPct)))
        : 100,
    floorPlanPlacementImageSpace: d.floorPlanPlacementImageSpace === true,
    mapShowName: typeof d.mapShowName === "boolean" ? d.mapShowName : base.mapShowName,
    mapShowQuantity: typeof d.mapShowQuantity === "boolean" ? d.mapShowQuantity : base.mapShowQuantity,
    mapTheme: d.mapTheme === "light" ? "light" : "dark",
    mapPlacementGlyphScale:
      typeof d.mapPlacementGlyphScale === "number" && Number.isFinite(d.mapPlacementGlyphScale)
        ? Math.min(2.5, Math.max(0.5, d.mapPlacementGlyphScale))
        : 1,
    customPlanSoftwareLines,
    customPlanServiceLines,
    planPages: normalizePlanPages(d.planPages, ctx.materials),
    quoteFooterCustom: typeof d.quoteFooterCustom === "string" ? d.quoteFooterCustom : "",
    quoteTableOrder,
    quotationRef:
      typeof d.quotationRef === "string" && d.quotationRef.trim() ? d.quotationRef.trim() : null,
    quoteExportIncludeImages: d.quoteExportIncludeImages === true,
    quoteGlobalPriceTier:
      d.quoteGlobalPriceTier === "vip" || d.quoteGlobalPriceTier === "vvip" ? d.quoteGlobalPriceTier : "regular",
    customPlanTab: d.customPlanTab === "plan" || d.customPlanTab === "quote" ? d.customPlanTab : "select",
    customPlanSelectStep:
      d.customPlanSelectStep === "software" || d.customPlanSelectStep === "services"
        ? d.customPlanSelectStep
        : "map",
  };
}

export function snapshotToWorkspacePatch(data: CustomPlanSnapshotData): Partial<CustomPlanSnapshotSource> {
  return {
    placements: data.placements,
    floorPlanDataUrl: data.floorPlanDataUrl,
    floorPlanOpacityPct: data.floorPlanOpacityPct,
    floorPlanPlacementImageSpace: data.floorPlanPlacementImageSpace,
    mapShowName: data.mapShowName,
    mapShowQuantity: data.mapShowQuantity,
    mapTheme: data.mapTheme,
    mapPlacementGlyphScale: data.mapPlacementGlyphScale,
    customPlanSoftwareLines: data.customPlanSoftwareLines,
    customPlanServiceLines: data.customPlanServiceLines,
    planPages: data.planPages,
    quoteFooterCustom: data.quoteFooterCustom,
    quoteTableOrder: data.quoteTableOrder,
    quotationRef: data.quotationRef,
    quoteExportIncludeImages: data.quoteExportIncludeImages,
    quoteGlobalPriceTier: data.quoteGlobalPriceTier,
    customPlanTab: data.customPlanTab,
    customPlanSelectStep: data.customPlanSelectStep,
  };
}

export function defaultCustomPlanName(existing: SavedCustomPlan[], locale: "en" | "zh"): string {
  const used = new Set(existing.map((p) => p.name.trim()));
  for (let i = 1; i < 500; i++) {
    const name = locale === "zh" ? `方案 ${i}` : `Plan ${i}`;
    if (!used.has(name)) return name;
  }
  return locale === "zh" ? `方案 ${Date.now()}` : `Plan ${Date.now()}`;
}

export function normalizeSavedCustomPlan(
  raw: unknown,
  ctx: { materials: MaterialPage[]; softwareFeatureIds: Set<string>; serviceIds: Set<string>; associationIds: Set<string> },
): SavedCustomPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<SavedCustomPlan>;
  if (typeof o.id !== "string" || !o.id) return null;
  const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : "Plan";
  const createdAt = typeof o.createdAt === "number" && Number.isFinite(o.createdAt) ? o.createdAt : Date.now();
  const updatedAt = typeof o.updatedAt === "number" && Number.isFinite(o.updatedAt) ? o.updatedAt : createdAt;
  return {
    id: o.id,
    name,
    createdAt,
    updatedAt,
    ownerUserId: typeof o.ownerUserId === "string" && o.ownerUserId.trim() ? o.ownerUserId.trim() : "pisell",
    visibility: normalizePlanVisibility(o.visibility),
    sharedUserIds: uniqueUserIds(o.sharedUserIds),
    data: normalizeCustomPlanSnapshotData(o.data, ctx),
  };
}

export type CustomPlanHydrationInput = {
  locale: "en" | "zh";
  rootSnapshot: CustomPlanSnapshotData;
  savedPlans: SavedCustomPlan[];
  activePlanId: string | null;
  backupRootSnapshot?: CustomPlanSnapshotData | null;
  backupPlans?: SavedCustomPlan[];
};

export type CustomPlanHydrationResult = {
  savedCustomPlans: SavedCustomPlan[];
  activeCustomPlanId: string | null;
  workspace: CustomPlanSnapshotData;
};

/** 合并根级持久化、方案快照与 localStorage 备份；有 active 方案时只恢复该方案，不混入其他方案数据。 */
export function resolveCustomPlanHydration(input: CustomPlanHydrationInput): CustomPlanHydrationResult {
  const now = Date.now();
  let plans = [...input.savedPlans];
  let activeId = input.activePlanId;

  if (activeId && plans.some((p) => p.id === activeId)) {
    const activePlan = plans.find((p) => p.id === activeId)!;
    const activeCandidates: CustomPlanSnapshotData[] = [activePlan.data, input.rootSnapshot];
    if (input.backupRootSnapshot) activeCandidates.push(input.backupRootSnapshot);
    const backupActive = input.backupPlans?.find((p) => p.id === activeId);
    if (backupActive) activeCandidates.push(backupActive.data);

    let workspace = activePlan.data;
    for (let i = 1; i < activeCandidates.length; i++) {
      workspace = pickRicherCustomPlanSnapshot(workspace, activeCandidates[i]!);
    }

    if (snapshotRichness(workspace) > snapshotRichness(activePlan.data)) {
      plans = plans.map((p) => (p.id === activeId ? { ...p, data: workspace, updatedAt: now } : p));
    }
    return { savedCustomPlans: plans, activeCustomPlanId: activeId, workspace };
  }

  const candidates: CustomPlanSnapshotData[] = [input.rootSnapshot];
  if (input.backupRootSnapshot) candidates.push(input.backupRootSnapshot);
  for (const p of plans) candidates.push(p.data);
  if (input.backupPlans) {
    for (const p of input.backupPlans) candidates.push(p.data);
  }

  let best = candidates[0] ?? emptyCustomPlanSnapshot();
  for (let i = 1; i < candidates.length; i++) {
    best = pickRicherCustomPlanSnapshot(best, candidates[i]!);
  }

  if (plans.length === 0 && snapshotRichness(best) > 0) {
    const id = `legacy-${now}`;
    const name = defaultCustomPlanName([], input.locale);
    plans = [{
      id,
      name,
      createdAt: now,
      updatedAt: now,
      ownerUserId: "pisell",
      visibility: "company",
      sharedUserIds: [],
      data: best,
    }];
    activeId = id;
    return { savedCustomPlans: plans, activeCustomPlanId: activeId, workspace: best };
  }

  if (plans.length > 0) {
    const richest = plans.reduce((acc, p) =>
      snapshotRichness(p.data) > snapshotRichness(acc.data) ? p : acc,
    );
    activeId = richest.id;
    return { savedCustomPlans: plans, activeCustomPlanId: activeId, workspace: richest.data };
  }

  return { savedCustomPlans: plans, activeCustomPlanId: activeId, workspace: best };
}
