import html2canvas from "html2canvas";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { compressImageFileToJpegDataUrl } from "../utils/compressImageFile";
import { splitPdfToJpegPages } from "../utils/pdfPages";
import { placementCountForAssociation, placementQty } from "../utils/placementQty";
import {
  associationLineMaxUnit,
  associationLineMinUnit,
  associationQuoteLineTotal,
  formatMoneyAmount,
  optionLabelBrief,
  tierForAssociationRow,
} from "../utils/hardwareOptionsAddons";
import { normalizePriceBandPartial, priceAtTier } from "../utils/priceTriple";
import { HardwareGlyph } from "../icons/hardwareGlyphs";
import {
  accentForMap,
  chipLabelTextForMap,
  chipSurfaceForMap,
  mapLabelPillBgForMap,
  mapLabelPillBorderForMap,
} from "../icons/mapColors";
import { useQuoteStore } from "../store/quoteStore";
import type { HardwarePlacement } from "../types";
import { DEFAULT_UI_APPEARANCE } from "../theme/applyAppearance";
import { iconKeyForAssociation } from "../utils/categoryIcon";
import { firstLinkedMaterial } from "../utils/associationMaterials";
import { associationMapCategory } from "../utils/associationCatalog";
import { useT } from "../i18n/useT";
import { patchMapLabelsForHtml2Canvas } from "../utils/mapExportCapture";
import { CustomPlanServicesStep } from "./CustomPlanServicesStep";
import { CustomPlanSoftwareStep } from "./CustomPlanSoftwareStep";
import { PhotoUploadModal } from "./PhotoUploadModal";

const DND_ASSOC_MIME = "application/x-marketing-association-id";
const DND_ASSOC_OPTION = "application/x-marketing-assoc-option-v1";
const MAP_HW_RAIL_LS = "marketing-map-hw-rail-open";
const MAP_HW_CAT_COLLAPSED_LS = "marketing-map-hw-cat-collapsed";
const MAP_ZOOM_MIN = 0.4;
const MAP_ZOOM_MAX = 3.2;
/** Zoom at or above this may auto-show device name beside the icon when there is horizontal room. */
const MAP_AUTO_NAME_ZOOM = 1.1;
/** At or above this zoom, always auto-show the map title (abbrev / model) even when pins are dense or near edges. */
const MAP_ZOOM_FORCE_SHOW_LABEL = 2;
/** Need roughly this much free margin on one side (%, of map width) to place a side label. */
const MAP_LABEL_SIDE_MIN_PCT = 20;
/** 名称气泡左右内边距之和（用于碰撞盒宽度，略大于实际 padding） */
const MAP_LABEL_PILL_EXTRA_W = 14;
const MAP_STAGE_EDGE_PAD_PX = 8;
type CatalogMode = "hardware" | "software" | "services";

const CATALOG_MODES: { id: CatalogMode; label: string }[] = [
  { id: "hardware", label: "Hardware" },
  { id: "software", label: "Software" },
  { id: "services", label: "Services" },
];

function mapPinWantsAutoLabel(
  mapShowName: boolean,
  mapZoom: number,
  sideOk: boolean,
  neigh: number,
  hasMapAbbrev: boolean,
): boolean {
  if (mapShowName) return false;
  if (mapZoom < MAP_AUTO_NAME_ZOOM) return false;
  if (hasMapAbbrev) return true;
  if (mapZoom >= MAP_ZOOM_FORCE_SHOW_LABEL) return true;
  return sideOk && neigh < 6;
}

function readCollapsedCatsFromLs(): Set<string> {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(MAP_HW_CAT_COLLAPSED_LS) : null;
    if (!raw) return new Set();
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return new Set();
    return new Set(j.filter((x): x is string => typeof x === "string" && x.length > 0));
  } catch {
    return new Set();
  }
}

function persistCollapsedCats(set: Set<string>) {
  try {
    window.localStorage.setItem(MAP_HW_CAT_COLLAPSED_LS, JSON.stringify([...set]));
  } catch {
    /* noop */
  }
}

/** Letterbox rect for `object-fit: contain` image inside cw×ch. */
function objectContainRect(cw: number, ch: number, iw: number, ih: number) {
  if (cw <= 0 || ch <= 0 || iw <= 0 || ih <= 0) return { ox: 0, oy: 0, w: Math.max(0, cw), h: Math.max(0, ch) };
  const scale = Math.min(cw / iw, ch / ih);
  const w = iw * scale;
  const h = ih * scale;
  const ox = (cw - w) / 2;
  const oy = (ch - h) / 2;
  return { ox, oy, w, h };
}

/** Scales map marker chrome with the settings slider (not floor zoom). Border ~1px at 0.5×, ~4px at 2.5×. */
function mapMarkerLayoutMetrics(scale: number) {
  const s = Math.min(2.5, Math.max(0.5, scale));
  const borderPx = 1 + ((s - 0.5) / 2) * 3;
  return {
    borderPx,
    ringPx: Math.max(1, Math.min(3, borderPx * 0.88)),
    iconPx: 20 * s,
    titleFs: Math.max(7.5, 10.5 * s),
    subFs: Math.max(7, 9 * s),
    padX: Math.max(2, Math.min(6.5, 2.3 * s + 0.4)),
    padY: Math.max(2, Math.min(5.5, 1.8 * s + 0.4)),
    gapIcon: Math.max(2, 3.5 * s),
    colGap: Math.max(2, 2.2 * s),
    radius: Math.max(3.5, 6.5 * s),
  };
}

/** Fixed UI radius for map chip + label pill (does not grow with glyph scale; pin stays visually anchored). */
const MAP_CHIP_UI_RADIUS_PX = 4;

/** Floor plan editor: multiple markers per category; upload floor image, export JPG (map theme in Settings). */
export function HardwareLayoutPanel({
  catalogMode = "hardware",
  onCatalogModeChange,
}: {
  catalogMode?: CatalogMode;
  onCatalogModeChange?: (mode: CatalogMode) => void;
}) {
  const tr = useT();
  const materials = useQuoteStore((s) => s.materials);
  const categoryDefs = useQuoteStore((s) => s.categoryDefs);
  const associations = useQuoteStore((s) => s.associations);
  const placements = useQuoteStore((s) => s.placements);
  const updatePlacement = useQuoteStore((s) => s.updatePlacement);
  const addPlacement = useQuoteStore((s) => s.addPlacement);
  const patchPlacement = useQuoteStore((s) => s.patchPlacement);
  const removePlacement = useQuoteStore((s) => s.removePlacement);
  const clearPlacementsForAssociation = useQuoteStore((s) => s.clearPlacementsForAssociation);
  const floorPlanDataUrl = useQuoteStore((s) => s.floorPlanDataUrl);
  const setFloorPlanDataUrl = useQuoteStore((s) => s.setFloorPlanDataUrl);
  const floorPlanOpacityPct = useQuoteStore((s) => s.floorPlanOpacityPct);
  const setFloorPlanOpacityPct = useQuoteStore((s) => s.setFloorPlanOpacityPct);
  const floorPlanPlacementImageSpace = useQuoteStore((s) => s.floorPlanPlacementImageSpace);
  const migrateFloorPlacementsToImageSpace = useQuoteStore((s) => s.migrateFloorPlacementsToImageSpace);
  const setPlacements = useQuoteStore((s) => s.setPlacements);
  const mapShowName = useQuoteStore((s) => s.mapShowName);
  const mapShowQuantity = useQuoteStore((s) => s.mapShowQuantity);
  const mapTheme = useQuoteStore((s) => s.mapTheme);
  const quoteGlobalPriceTier = useQuoteStore((s) => s.quoteGlobalPriceTier);
  const companyCatalogCurrency = useQuoteStore((s) => s.companyCatalogCurrency);
  const companyCatalogFxMultiplier = useQuoteStore((s) => s.companyCatalogFxMultiplier);
  const setActiveTab = useQuoteStore((s) => s.setActiveTab);
  const setMapShowName = useQuoteStore((s) => s.setMapShowName);
  const setMapShowQuantity = useQuoteStore((s) => s.setMapShowQuantity);
  const mapPlacementGlyphScale = useQuoteStore((s) => s.mapPlacementGlyphScale);
  const setMapPlacementGlyphScale = useQuoteStore((s) => s.setMapPlacementGlyphScale);

  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  /** 点击标记后浮出的数量 / 删除面板（与拖动区分） */
  const [mapFloatPanelId, setMapFloatPanelId] = useState<string | null>(null);
  const [exportingMap, setExportingMap] = useState(false);
  /** After drag from sidebar: pick spec and add-ons */
  const [placeDialog, setPlaceDialog] = useState<{
    associationId: string;
    xPct: number;
    yPct: number;
    optionId: string | null;
    addonIds: string[];
  } | null>(null);
  const mapInnerRef = useRef<HTMLDivElement>(null);
  /** Markers + floor image share this box (object-contain image rect or full inner when no image). */
  const mapStageRef = useRef<HTMLDivElement>(null);
  const floorImgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const mapPanDragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const captureElRef = useRef<HTMLElement | null>(null);
  const [floorModalOpen, setFloorModalOpen] = useState(false);
  const placementsUndoStack = useRef<HardwarePlacement[][]>([]);
  const [placementsUndoLen, setPlacementsUndoLen] = useState(0);
  const [mapLayoutTick, setMapLayoutTick] = useState(0);
  /** Pixel box of the map stage (object-contain image rect, or full inner when no image). */
  const [mapStageBox, setMapStageBox] = useState({ ox: 0, oy: 0, w: 0, h: 0 });
  const mapStageBoxRef = useRef(mapStageBox);
  const mapZoomRef = useRef(1);
  const mapPanRef = useRef({ x: 0, y: 0 });

  const [hwSearch, setHwSearch] = useState("");
  const [mapHwRailOpen, setMapHwRailOpen] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(MAP_HW_RAIL_LS) !== "0";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(MAP_HW_RAIL_LS, mapHwRailOpen ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [mapHwRailOpen]);
  /** 右侧：平面图 / 与软件、服务一致的「已选」列表 */
  const [mapPaneMode, setMapPaneMode] = useState<"map" | "list">("map");
  /** 地图上临时隐藏的设备类型（associationId），不影响实际标记数据 */
  const [mapHiddenAssocIds, setMapHiddenAssocIds] = useState<Set<string>>(() => new Set());
  const [mapFilterOpen, setMapFilterOpen] = useState(false);

  const assocMap = useMemo(() => new Map(associations.map((a) => [a.id, a])), [associations]);

  const filteredAssociations = useMemo(() => {
    const needle = hwSearch.trim().toLowerCase();
    return associations.filter((a) => {
      if (!needle) return true;
      const blob = `${a.hardwareName} ${a.deviceModel ?? ""}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [associations, hwSearch]);

  const assocOrderIndex = useMemo(() => {
    const m = new Map<string, number>();
    associations.forEach((a, i) => {
      if (!m.has(a.id)) m.set(a.id, i);
    });
    return m;
  }, [associations]);

  const hardwareGroups = useMemo(() => {
    const map = new Map<string, (typeof associations)[number][]>();
    for (const a of filteredAssociations) {
      const cat = associationMapCategory(a, materials, categoryDefs) || tr("cps.uncat");
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(a);
    }
    const entries = [...map.entries()].sort((a, b) => {
      const minA = Math.min(...a[1].map((x) => assocOrderIndex.get(x.id) ?? 9999));
      const minB = Math.min(...b[1].map((x) => assocOrderIndex.get(x.id) ?? 9999));
      return minA - minB;
    });
    return entries;
  }, [filteredAssociations, materials, categoryDefs, tr, assocOrderIndex]);

  const searchActive = hwSearch.trim().length > 0;
  const [collapsedHwCats, setCollapsedHwCats] = useState<Set<string>>(() => readCollapsedCatsFromLs());
  const toggleHwCat = useCallback((cat: string) => {
    setCollapsedHwCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      persistCollapsedCats(next);
      return next;
    });
  }, []);

  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [mapPanning, setMapPanning] = useState(false);
  const [mapHoverPlacementId, setMapHoverPlacementId] = useState<string | null>(null);

  useLayoutEffect(() => {
    mapStageBoxRef.current = mapStageBox;
  }, [mapStageBox]);
  useEffect(() => {
    mapZoomRef.current = mapZoom;
  }, [mapZoom]);
  useEffect(() => {
    mapPanRef.current = mapPan;
  }, [mapPan]);

  const fmtCatalog = useCallback(
    (n: number) =>
      formatMoneyAmount(n * (Number.isFinite(companyCatalogFxMultiplier) ? companyCatalogFxMultiplier : 1), companyCatalogCurrency),
    [companyCatalogCurrency, companyCatalogFxMultiplier],
  );

  const optUnitShown = useCallback(
    (assoc: (typeof associations)[number], opt: (typeof associations)[number]["options"][number]) => {
      const t = tierForAssociationRow(assoc, quoteGlobalPriceTier);
      const b = normalizePriceBandPartial(opt.priceBand, opt.optionPrice);
      return fmtCatalog(priceAtTier(b, t));
    },
    [fmtCatalog, quoteGlobalPriceTier],
  );

  const assocUnitRangeText = useCallback(
    (assoc: (typeof associations)[number]) => {
      const tier = tierForAssociationRow(assoc, quoteGlobalPriceTier);
      const lo = associationLineMinUnit(assoc, tier);
      const hi = associationLineMaxUnit(assoc, tier);
      const loText = fmtCatalog(lo);
      const hiText = fmtCatalog(hi);
      return loText === hiText ? loText : `${loText} - ${hiText}`;
    },
    [fmtCatalog, quoteGlobalPriceTier],
  );

  const maxOptionCount = useMemo(() => {
    const ids = new Set(placements.map((p) => p.associationId));
    return associations
      .filter((a) => ids.has(a.id))
      .reduce((m, a) => Math.max(m, a.options?.length ?? 0), 0);
  }, [associations, placements]);

  const mapMarker = useMemo(() => mapMarkerLayoutMetrics(mapPlacementGlyphScale), [mapPlacementGlyphScale]);

  const displayPlacements = useMemo(
    () => placements.filter((p) => !mapHiddenAssocIds.has(p.associationId)),
    [placements, mapHiddenAssocIds],
  );

  /** Tighter name width when crowded; auto-name gate uses neighbour density. Icons are never vertically nudged. */
  const mapMarkerOverlapHints = useMemo(() => {
    type Hint = { labelMaxPx: number; showAutoName: boolean; preferRight: boolean };
    const out = new Map<string, Hint>();
    const sw = mapStageBox.w;
    const sh = mapStageBox.h;
    if (sw < 8 || sh < 8 || displayPlacements.length < 1) return out;

    const iconPx = mapMarker.iconPx;
    const labelMaxBase = iconPx * 5;

    type Item = {
      id: string;
      showAutoName: boolean;
      preferRight: boolean;
      labelMaxPx: number;
    };

    const items: Item[] = displayPlacements.map((p) => {
      const aRow = assocMap.get(p.associationId);
      const hasMapAbbrev = !!(aRow && (aRow.mapLabelAbbrev ?? "").trim());
      const rightMarginPct = 100 - p.xPct;
      const leftMarginPct = p.xPct;
      const sideOk = Math.max(leftMarginPct, rightMarginPct) >= MAP_LABEL_SIDE_MIN_PCT;
      const neigh = displayPlacements.filter((o) => {
        if (o.id === p.id) return false;
        const dx = o.xPct - p.xPct;
        const dy = o.yPct - p.yPct;
        return Math.hypot(dx, dy) < 13;
      }).length;
      const showAutoName = mapPinWantsAutoLabel(mapShowName, mapZoom, sideOk, neigh, hasMapAbbrev);
      const preferRight = rightMarginPct >= leftMarginPct;
      const labelMaxPx = labelMaxBase * (neigh >= 3 ? 0.72 : neigh >= 2 ? 0.85 : 1);

      return {
        id: p.id,
        showAutoName,
        preferRight,
        labelMaxPx,
      };
    });

    for (const it of items) {
      out.set(it.id, {
        labelMaxPx: it.labelMaxPx,
        showAutoName: it.showAutoName,
        preferRight: it.preferRight,
      });
    }
    return out;
  }, [displayPlacements, mapStageBox.w, mapStageBox.h, mapMarker, mapShowName, mapZoom, assocMap]);

  const mapListRows = useMemo(() => {
    return associations
      .map((a) => {
        const cnt = placementCountForAssociation(a.id, placements);
        if (cnt < 1) return null;
        const ps = placements.filter((p) => p.associationId === a.id);
        const first = ps[0];
        if (!first) return null;
        const optLb = optionLabelBrief(a, first.optionId);
        const abbrev = (a.mapLabelAbbrev ?? "").trim();
        const label = abbrev || (a.deviceModel ?? "").trim() || a.hardwareName || tr("hw.unnamedOpt");
        return {
          id: a.id,
          a,
          cnt,
          label,
          line: associationQuoteLineTotal(a, placements, quoteGlobalPriceTier),
          cat: associationMapCategory(a, materials, categoryDefs) || tr("cps.uncat"),
          glyph: iconKeyForAssociation(a, materials, categoryDefs),
          optLb,
          placementId: first.id,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [associations, placements, materials, categoryDefs, tr, quoteGlobalPriceTier]);

  const mapFilterHiddenCount = mapHiddenAssocIds.size;

  useEffect(() => {
    setMapHiddenAssocIds((prev) => {
      const onMap = new Set(placements.map((p) => p.associationId));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (onMap.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [placements]);

  useEffect(() => {
    if (!selectedPlacementId) return;
    const sel = placements.find((p) => p.id === selectedPlacementId);
    if (sel && mapHiddenAssocIds.has(sel.associationId)) {
      setSelectedPlacementId(null);
      setMapFloatPanelId(null);
    }
  }, [mapHiddenAssocIds, placements, selectedPlacementId]);

  const setMapFilterAssocVisible = useCallback((associationId: string, visible: boolean) => {
    setMapHiddenAssocIds((prev) => {
      const next = new Set(prev);
      if (visible) next.delete(associationId);
      else next.add(associationId);
      return next;
    });
  }, []);

  const setAllMapFilterVisible = useCallback(
    (visible: boolean) => {
      if (visible) {
        setMapHiddenAssocIds(new Set());
        return;
      }
      setMapHiddenAssocIds(new Set(mapListRows.map((r) => r.id)));
    },
    [mapListRows],
  );

  const selectedPlacement = useMemo(
    () => (selectedPlacementId ? placements.find((p) => p.id === selectedPlacementId) ?? null : null),
    [placements, selectedPlacementId],
  );
  const selectedAssoc = selectedPlacement
    ? assocMap.get(selectedPlacement.associationId) ?? null
    : null;

  useEffect(() => {
    if (!mapFloatPanelId) return;
    const onDoc = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.closest("[data-map-marker-panel]")) return;
      if (el.closest("[data-map-marker-chip]")) return;
      setMapFloatPanelId(null);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [mapFloatPanelId]);

  const DRAG_THRESHOLD_PX = 8;

  const onChipPointerDown = (placementId: string, e: React.PointerEvent) => {
    const stage = mapStageRef.current;
    if (!stage) return;
    e.preventDefault();
    setSelectedPlacementId(placementId);
    const rect = stage.getBoundingClientRect();
    const cur = placements.find((p) => p.id === placementId);
    if (!cur) return;
    const chipX = rect.left + (cur.xPct / 100) * rect.width;
    const chipY = rect.top + (cur.yPct / 100) * rect.height;
    dragRef.current = {
      id: placementId,
      offsetX: e.clientX - chipX,
      offsetY: e.clientY - chipY,
    };
    const el = e.currentTarget as HTMLElement;
    captureElRef.current = el;
    el.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    let dragged = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragged && dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        dragged = true;
        setMapFloatPanelId(null);
      }
      if (!dragged) return;
      const d = dragRef.current;
      const st = mapStageRef.current;
      if (!d || !st) return;
      const r = st.getBoundingClientRect();
      const x = ev.clientX - d.offsetX - r.left;
      const y = ev.clientY - d.offsetY - r.top;
      const nx = Math.min(94, Math.max(2, (x / r.width) * 100));
      const ny = Math.min(94, Math.max(2, (y / r.height) * 100));
      updatePlacement(d.id, nx, ny);
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      dragRef.current = null;
      try {
        captureElRef.current?.releasePointerCapture(ev.pointerId);
      } catch {
        /* noop */
      }
      captureElRef.current = null;
      if (!dragged) {
        setMapFloatPanelId((prev) => (prev === placementId ? null : placementId));
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const addPlacementNear = useCallback(
    (placementId: string) => {
      const cur = placements.find((x) => x.id === placementId);
      if (!cur) return;
      patchPlacement(placementId, { qty: placementQty(cur) + 1 });
      setSelectedPlacementId(placementId);
      setMapFloatPanelId(placementId);
    },
    [patchPlacement, placements],
  );

  const removePlacementOne = useCallback(
    (placementId: string) => {
      const cur = placements.find((x) => x.id === placementId);
      if (!cur) return;
      const q = placementQty(cur);
      if (q > 1) {
        patchPlacement(placementId, { qty: q - 1 });
        return;
      }
      removePlacement(placementId);
      setMapFloatPanelId((prev) => (prev === placementId ? null : prev));
      setSelectedPlacementId((prev) => (prev === placementId ? null : prev));
    },
    [patchPlacement, placements, removePlacement],
  );

  const removePlacementAllForAssoc = useCallback(
    (associationId: string) => {
      clearPlacementsForAssociation(associationId);
      setMapFloatPanelId(null);
      setSelectedPlacementId((prev) => {
        const selected = placements.find((p) => p.id === prev);
        if (!selected) return prev;
        return selected.associationId === associationId ? null : prev;
      });
    },
    [clearPlacementsForAssociation, placements],
  );

  const clonePlacementsSnapshot = useCallback(
    (pls: HardwarePlacement[]) => pls.map((p) => ({ ...p, addonIds: [...p.addonIds] })),
    [],
  );

  const pushPlacementsUndo = useCallback(() => {
    placementsUndoStack.current.push(clonePlacementsSnapshot(useQuoteStore.getState().placements));
    if (placementsUndoStack.current.length > 30) placementsUndoStack.current.shift();
    setPlacementsUndoLen(placementsUndoStack.current.length);
  }, [clonePlacementsSnapshot]);

  const clearAllMarkers = useCallback(() => {
    const current = useQuoteStore.getState().placements;
    if (!current.length) return;
    pushPlacementsUndo();
    setPlacements([]);
    setMapFloatPanelId(null);
    setSelectedPlacementId(null);
  }, [pushPlacementsUndo, setPlacements]);

  const undoClearMarkers = useCallback(() => {
    const prev = placementsUndoStack.current.pop();
    setPlacementsUndoLen(placementsUndoStack.current.length);
    if (!prev?.length) return;
    setPlacements(prev);
  }, [setPlacements]);

  const resetMapView = useCallback(() => {
    setMapZoom(1);
    setMapPan({ x: 0, y: 0 });
  }, []);

  const onMapPanPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const el = e.target as HTMLElement;
    if (el.closest("[data-map-marker-chip]")) return;
    if (el.closest("[data-map-marker-panel]")) return;
    if (dragRef.current) return;
    e.preventDefault();
    const pan = mapPanRef.current;
    mapPanDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setMapPanning(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onMapPanPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = mapPanDragRef.current;
    if (!d) return;
    const next = {
      x: d.panX + (e.clientX - d.startX),
      y: d.panY + (e.clientY - d.startY),
    };
    mapPanRef.current = next;
    setMapPan(next);
  }, []);

  const endMapPanDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!mapPanDragRef.current) return;
    mapPanDragRef.current = null;
    setMapPanning(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    const el = mapInnerRef.current;
    if (!el || mapPaneMode !== "map") return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { ox, oy } = mapStageBoxRef.current;
      const zPrev = mapZoomRef.current;
      const pan = mapPanRef.current;
      const factor = e.deltaY < 0 ? 1.09 : 0.91;
      const z = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, zPrev * factor));
      if (z === zPrev) return;
      const worldX = (mx - ox - pan.x) / zPrev;
      const worldY = (my - oy - pan.y) / zPrev;
      const nextPan = { x: mx - ox - worldX * z, y: my - oy - worldY * z };
      mapZoomRef.current = z;
      mapPanRef.current = nextPan;
      setMapZoom(z);
      setMapPan(nextPan);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [mapPaneMode]);

  const openPlaceFlow = useCallback(
    (associationId: string, xPct: number, yPct: number, presetOptionId?: string | null) => {
      const assoc = associations.find((x) => x.id === associationId);
      if (!assoc) return;
      const nx = Math.min(94, Math.max(2, xPct));
      const ny = Math.min(94, Math.max(2, yPct));
      if (!assoc.options.length && !assoc.addons.length) {
        addPlacement(associationId, null, { xPct: nx, yPct: ny, addonIds: [] });
        const last = useQuoteStore.getState().placements.slice(-1)[0];
        if (last) setSelectedPlacementId(last.id);
        return;
      }
      const opts = assoc.options;
      let initialOption: string | null = null;
      if (opts.length) {
        const pre =
          presetOptionId && opts.some((o) => o.id === presetOptionId) ? presetOptionId : null;
        initialOption = pre ?? opts[0]!.id;
      }
      setPlaceDialog({
        associationId,
        xPct: nx,
        yPct: ny,
        optionId: initialOption,
        addonIds: [],
      });
    },
    [addPlacement, associations],
  );

  const confirmPlaceDialog = useCallback(() => {
    if (!placeDialog) return;
    addPlacement(placeDialog.associationId, placeDialog.optionId, {
      xPct: placeDialog.xPct,
      yPct: placeDialog.yPct,
      addonIds: placeDialog.addonIds,
    });
    const last = useQuoteStore.getState().placements.slice(-1)[0];
    if (last) setSelectedPlacementId(last.id);
    setPlaceDialog(null);
  }, [addPlacement, placeDialog]);

  const placeDialogAssoc = useMemo(
    () => (placeDialog ? assocMap.get(placeDialog.associationId) ?? null : null),
    [assocMap, placeDialog],
  );

  useEffect(() => {
    if (placeDialog && !placeDialogAssoc) setPlaceDialog(null);
  }, [placeDialog, placeDialogAssoc]);

  useLayoutEffect(() => {
    const inner = mapInnerRef.current;
    if (!inner) return;
    const ro = new ResizeObserver(() => {
      setMapLayoutTick((t) => t + 1);
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [mapPaneMode]);

  useLayoutEffect(() => {
    if (mapPaneMode !== "map") return;
    const inner = mapInnerRef.current;
    if (!inner) return;
    const cw = inner.clientWidth;
    const ch = inner.clientHeight;
    const img = floorImgRef.current;
    let ox = 0;
    let oy = 0;
    let w = Math.max(cw, 1);
    let h = Math.max(ch, 1);
    if (floorPlanDataUrl && img?.naturalWidth && img?.naturalHeight) {
      const r = objectContainRect(cw, ch, img.naturalWidth, img.naturalHeight);
      ox = r.ox;
      oy = r.oy;
      w = r.w;
      h = r.h;
    }
    setMapStageBox((prev) =>
      prev.ox === ox && prev.oy === oy && prev.w === w && prev.h === h ? prev : { ox, oy, w, h },
    );
  }, [floorPlanDataUrl, mapLayoutTick, mapPaneMode]);

  /** Legacy placements were % of full map pane; convert once to % of the object-contain image rect. */
  useLayoutEffect(() => {
    if (floorPlanPlacementImageSpace) return;
    if (mapPaneMode !== "map") return;
    if (!floorPlanDataUrl) {
      migrateFloorPlacementsToImageSpace([]);
      return;
    }
    const inner = mapInnerRef.current;
    const img = floorImgRef.current;
    if (!inner || !img?.naturalWidth) return;
    const cw = inner.clientWidth;
    const ch = inner.clientHeight;
    if (cw < 16 || ch < 16) return;
    const { ox, oy, w, h } = objectContainRect(cw, ch, img.naturalWidth, img.naturalHeight);
    if (w < 4 || h < 4) return;
    const pls = useQuoteStore.getState().placements;
    if (!pls.length) {
      migrateFloorPlacementsToImageSpace([]);
      return;
    }
    const updates = pls.map((p) => {
      const px = (p.xPct / 100) * cw;
      const py = (p.yPct / 100) * ch;
      return {
        id: p.id,
        xPct: Math.min(94, Math.max(2, ((px - ox) / w) * 100)),
        yPct: Math.min(94, Math.max(2, ((py - oy) / h) * 100)),
      };
    });
    migrateFloorPlacementsToImageSpace(updates);
  }, [
    floorPlanPlacementImageSpace,
    floorPlanDataUrl,
    mapLayoutTick,
    mapPaneMode,
    migrateFloorPlacementsToImageSpace,
  ]);

  const onFloorUpload = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    try {
      if ((f.name || "").toLowerCase().endsWith(".pdf") || f.type === "application/pdf") {
        const pages = await splitPdfToJpegPages(f);
        if (!pages.length) throw new Error(tr("photo.fail"));
        setFloorPlanDataUrl(pages[0]!.dataUrl);
        return;
      }
      if (!f.type.startsWith("image/")) throw new Error(tr("photo.floorImageOnly"));
      const url = await compressImageFileToJpegDataUrl(f, { maxEdge: 2560, quality: 0.82 });
      setFloorPlanDataUrl(url);
    } catch (e) {
      throw e instanceof Error ? e : new Error(tr("photo.fail"));
    }
  };

  const exportMapJpg = async () => {
    const el = mapInnerRef.current;
    if (!el) return;
    setExportingMap(true);
    try {
      const cs = getComputedStyle(document.documentElement);
      const key = mapTheme === "dark" ? "--app-map-export-capture-dark" : "--app-map-export-capture-light";
      let captureBg = cs.getPropertyValue(key).trim();
      if (!captureBg) {
        captureBg =
          mapTheme === "dark" ? DEFAULT_UI_APPEARANCE.panelFillColor : DEFAULT_UI_APPEARANCE.backgroundColor;
      }
      const w = Math.max(1, el.offsetWidth);
      const h = Math.max(1, el.offsetHeight);
      const targetLong = 3840;
      const scale = Math.min(6, Math.max(2.5, targetLong / Math.max(w, h)));
      const canvas = await html2canvas(el, {
        scale,
        useCORS: true,
        backgroundColor: captureBg,
        logging: false,
        onclone: (_doc, clonedEl) => {
          patchMapLabelsForHtml2Canvas(clonedEl);
        },
      });
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const d = new Date();
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
        const pad2 = (n: number) => String(n).padStart(2, "0");
        const line = `Updated ${pad2(d.getHours())}:${pad2(d.getMinutes())} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        const fs = Math.round(Math.max(22, Math.min(44, canvas.width * 0.018)));
        const padX = Math.round(canvas.width * 0.02);
        const padY = Math.round(canvas.height * 0.018);
        ctx.save();
        ctx.font = `600 ${fs}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textBaseline = "top";
        const tw = ctx.measureText(line).width;
        ctx.fillStyle = mapTheme === "dark" ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.78)";
        ctx.fillRect(padX - 10, padY - 6, tw + 20, fs + 14);
        ctx.fillStyle = mapTheme === "dark" ? "rgba(248,250,252,0.95)" : "rgba(15,23,42,0.9)";
        ctx.fillText(line, padX, padY);
        ctx.restore();
      }
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/jpeg", 0.92);
      a.download = `floor-map-${Date.now()}.jpg`;
      a.click();
    } finally {
      setExportingMap(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-1.5 lg:p-2">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-app-panel-border bg-app-panel-bg lg:flex-row">
        {/* Left: category rail + search + catalog list (same pattern as Software / Services custom plan) */}
        {mapHwRailOpen ? (
        <div className="flex min-h-0 min-w-0 flex-col border-app-line-subtle lg:max-w-[min(440px,46%)] lg:shrink-0 lg:border-r">
          <div className="ui-mapEditor-head ui-mapEditor-head--left min-h-[96px] bg-app-surface-2">
            <div className="ui-catalogModuleSwitch" aria-label="Design modules">
              {CATALOG_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onCatalogModeChange?.(mode.id)}
                  className={`ui-catalogModuleSwitchBtn${catalogMode === mode.id ? " ui-catalogModuleSwitchBtn--on" : ""}`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMapHwRailOpen(false)}
              className="ui-toolBtn inline-flex h-8 w-8 items-center justify-center rounded-lg border border-app-line-mid text-base font-semibold text-app-muted hover:bg-app-surface-2"
              title={tr("hw.collapseList")}
              aria-label={tr("hw.collapseList")}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("enterpriseResources")}
              className="shrink-0 rounded-lg border border-app-line-strong px-2.5 py-1.5 text-xs text-app-muted hover:bg-app-surface-2"
            >
              {tr("hw.toLibrary")}
            </button>
            </div>
          </div>
          {catalogMode === "hardware" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-2">
              <input
                value={hwSearch}
                onChange={(e) => setHwSearch(e.target.value)}
                placeholder={tr("cps.searchPh")}
                className="shrink-0 rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm text-app-text"
              />
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-app-line-subtle p-2">
                {associations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-xs text-app-muted">
                    <p>{tr("hw.emptyCats")}</p>
                    <button type="button" className="text-app-tone hover:underline" onClick={() => setActiveTab("enterpriseResources")}>
                      {tr("hw.toLibrary")}
                    </button>
                  </div>
                ) : filteredAssociations.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-app-muted">{tr("cps.noMatch")}</p>
                ) : (
                  hardwareGroups.map(([cat, rows]) => {
                    const open = searchActive || !collapsedHwCats.has(cat);
                    return (
                      <div key={cat} className="rounded-lg border border-app-line-subtle/80 bg-app-surface/40">
                        <button
                          type="button"
                          onClick={() => toggleHwCat(cat)}
                          disabled={searchActive}
                          className="flex w-full items-center gap-2 border-b border-app-line-subtle/60 px-2 py-2 text-left text-xs font-semibold text-app-text hover:bg-app-surface-2/50 disabled:cursor-default disabled:opacity-90"
                          aria-expanded={open}
                          title={open ? tr("hw.catAriaCollapse") : tr("hw.catAriaExpand")}
                        >
                          <span className="shrink-0 text-app-muted" aria-hidden>
                            {open ? "▾" : "▸"}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{cat}</span>
                          <span className="shrink-0 tabular-nums text-[11px] font-normal text-app-subtle">
                            {rows.length}
                          </span>
                        </button>
                        {open ? (
                          <div className="space-y-2 p-2 pt-2">
                            {rows.map((a) => {
                              const cnt = placementCountForAssociation(a.id, placements);
                              const mat = firstLinkedMaterial(a, materials);
                              const glyph = iconKeyForAssociation(a, materials, categoryDefs);
                              const rowCat = associationMapCategory(a, materials, categoryDefs) || tr("cps.uncat");
                              const accent = accentForMap(a.color, mapTheme);
                              const rowActive = placements.some(
                                (p) => p.id === selectedPlacementId && p.associationId === a.id,
                              );
                              const deviceName = (a.deviceModel ?? "").trim() || a.hardwareName;
                              return (
                                <div
                                  key={a.id}
                                  className={`w-full rounded-lg border p-2 transition ${
                                    rowActive
                                      ? "border-app-primary bg-app-primary-soft"
                                      : "border-app-line-subtle bg-app-surface-2/60"
                                  }`}
                                >
                                  <div className="flex gap-2">
                                    <div
                                      draggable
                                      title={tr("hw.dragTitle")}
                                      onDragStart={(e) => {
                                        e.dataTransfer.setData(DND_ASSOC_MIME, a.id);
                                        e.dataTransfer.effectAllowed = "copy";
                                      }}
                                      className="flex h-12 w-12 shrink-0 cursor-grab items-center justify-center rounded-md border border-app-line-mid bg-app-surface active:cursor-grabbing"
                                      style={{ borderColor: accent }}
                                    >
                                      {mat ? (
                                        <img src={mat.dataUrl} alt="" className="h-full w-full rounded object-cover" />
                                      ) : (
                                        <HardwareGlyph id={glyph} className="h-7 w-7" style={{ color: accent }} />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1 text-xs">
                                      <div className="flex items-center gap-1 font-medium text-app-text">
                                        <HardwareGlyph id={glyph} className="h-4 w-4 shrink-0" style={{ color: accent }} />
                                        <span className="truncate">{deviceName}</span>
                                      </div>
                                      <div className="mt-0.5 truncate text-app-muted">{rowCat}</div>
                                      <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-app-subtle">
                                        <span className="truncate">{assocUnitRangeText(a)}</span>
                                        <span className="shrink-0">{tr("hw.addedCount", { n: String(cnt) })}</span>
                                      </div>
                                      <div className="mt-1.5 flex flex-wrap gap-1">
                                        {a.options.map((opt) => (
                                          <div
                                            key={opt.id}
                                            draggable
                                            title={tr("hw.dragSpecTitle")}
                                            onDragStart={(ev) => {
                                              ev.dataTransfer.setData(
                                                DND_ASSOC_OPTION,
                                                JSON.stringify({ associationId: a.id, optionId: opt.id }),
                                              );
                                              ev.dataTransfer.effectAllowed = "copy";
                                            }}
                                            className="cursor-grab rounded border border-app-primary/40 bg-app-surface-2/80 px-2 py-0.5 text-xs text-app-text active:cursor-grabbing"
                                          >
                                            {opt.label || tr("hw.unnamedOpt")}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden p-2">
              {catalogMode === "software" ? <CustomPlanSoftwareStep /> : <CustomPlanServicesStep />}
            </div>
          )}
        </div>
        ) : null}

        {/* Right: map editor */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {!mapHwRailOpen ? (
            <button
              type="button"
              onClick={() => setMapHwRailOpen(true)}
              className="absolute left-2 top-24 z-10 flex h-28 w-9 shrink-0 items-center justify-center rounded-r-lg border border-app-line-strong bg-app-panel-bg/95 text-lg font-semibold text-app-text shadow-md backdrop-blur-sm hover:bg-app-surface-2"
              title={tr("hw.expandList")}
              aria-label={tr("hw.expandList")}
              aria-expanded={false}
            >
              ›
            </button>
          ) : null}
          <div className="ui-mapEditor-head ui-mapEditor-head--right min-h-[96px] bg-app-surface-2">
          <h3 className="text-sm font-semibold text-app-text">{tr("hw.mapTitle")}</h3>
          <div className="w-full basis-full" />
          <div className="order-last flex w-full shrink-0 gap-0.5 rounded-lg border border-app-line-mid p-0.5 sm:order-none sm:w-auto">
            <button
              type="button"
              onClick={() => setMapPaneMode("map")}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium sm:flex-none ${
                mapPaneMode === "map" ? "bg-app-primary text-app-on-primary" : "text-app-muted hover:bg-app-surface-2"
              }`}
            >
              {tr("hw.viewMap")}
            </button>
            <button
              type="button"
              onClick={() => setMapPaneMode("list")}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium sm:flex-none ${
                mapPaneMode === "list" ? "bg-app-primary text-app-on-primary" : "text-app-muted hover:bg-app-surface-2"
              }`}
            >
              {tr("hw.viewList")}
            </button>
          </div>
          <PhotoUploadModal
            open={floorModalOpen}
            onClose={() => setFloorModalOpen(false)}
            title={tr("hw.uploadFloor")}
            accept="image/jpeg,.jpg,.jpeg,image/png,.png,application/pdf,.pdf"
            onConfirmFiles={(fs) => onFloorUpload(fs)}
          />
          <button
            type="button"
            onClick={() => setFloorModalOpen(true)}
            className="rounded-lg border border-app-line-strong px-2.5 py-1.5 text-xs hover:bg-app-surface-2"
          >
            {tr("hw.uploadFloor")}
          </button>
          <button
            type="button"
            disabled={!floorPlanDataUrl}
            onClick={() => setFloorPlanDataUrl(null)}
            className="rounded-lg border border-app-line-strong px-2.5 py-1.5 text-xs hover:bg-app-surface-2 disabled:opacity-40"
          >
            {tr("hw.clearFloor")}
          </button>
          {floorPlanDataUrl ? (
            <label className="flex min-w-0 max-w-[220px] items-center gap-2 text-xs text-app-muted sm:max-w-none">
              <span className="shrink-0 whitespace-nowrap">{tr("hw.floorOpacity")}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={floorPlanOpacityPct}
                onChange={(e) => setFloorPlanOpacityPct(parseInt(e.target.value, 10))}
                className="h-1 min-w-[72px] flex-1 accent-app-primary"
              />
              <span className="w-8 shrink-0 tabular-nums text-app-text">{floorPlanOpacityPct}%</span>
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className="rounded-lg border border-app-line-mid px-2.5 py-1.5 text-xs text-app-muted hover:bg-app-surface-2"
          >
            {tr("hw.themeLink")}
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-app-muted">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 shrink-0 rounded border border-app-line-mid bg-app-surface-2"
              checked={mapShowName}
              onChange={(e) => setMapShowName(e.target.checked)}
            />
            {tr("hw.showName")}
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-app-muted">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 shrink-0 rounded border border-app-line-mid bg-app-surface-2"
              checked={mapShowQuantity}
              onChange={(e) => setMapShowQuantity(e.target.checked)}
            />
            {tr("hw.showQty")}
          </label>
          <label className="flex min-w-0 max-w-[200px] items-center gap-2 text-xs text-app-muted sm:max-w-none">
            <span className="shrink-0 whitespace-nowrap">{tr("hw.iconScale")}</span>
            <input
              type="range"
              min={0.5}
              max={2.5}
              step={0.05}
              value={mapPlacementGlyphScale}
              onChange={(e) => setMapPlacementGlyphScale(parseFloat(e.target.value))}
              className="h-1 min-w-[72px] flex-1 accent-app-primary"
            />
          </label>
          <button
            type="button"
            disabled={!mapListRows.length}
            onClick={() => setMapFilterOpen(true)}
            aria-haspopup="dialog"
            title={mapFilterHiddenCount ? tr("hw.mapFilterHidden", { n: mapFilterHiddenCount }) : tr("hw.mapFilter")}
            className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-app-surface-2 disabled:opacity-40 ${
              mapFilterHiddenCount
                ? "border-app-primary/50 text-app-text"
                : "border-app-line-strong text-app-muted"
            }`}
          >
            {tr("hw.mapFilter")}
            {mapFilterHiddenCount ? (
              <span className="ml-1 tabular-nums text-app-primary">({mapFilterHiddenCount})</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={clearAllMarkers}
            disabled={!placements.length}
            className="rounded-lg border border-app-danger-border px-2.5 py-1.5 text-xs text-app-danger-text hover:bg-app-danger-bg disabled:opacity-40"
          >
            {tr("hw.clearAllMarkers")}
          </button>
          <button
            type="button"
            onClick={undoClearMarkers}
            disabled={placementsUndoLen === 0}
            className="rounded-lg border border-app-line-strong px-2.5 py-1.5 text-xs hover:bg-app-surface-2 disabled:opacity-40"
          >
            {tr("hw.undoClearMarkers")}
          </button>
          <button
            type="button"
            onClick={resetMapView}
            className="rounded-lg border border-app-line-mid px-2.5 py-1.5 text-xs text-app-muted hover:bg-app-surface-2"
          >
            {tr("hw.resetMapView")}
          </button>
          <button
            type="button"
            disabled={exportingMap}
            title={tr("hw.exportHiResHint")}
            onClick={() => void exportMapJpg()}
            className="rounded-lg bg-app-primary px-2.5 py-1.5 text-xs font-medium text-app-on-primary hover:bg-app-primary-hover disabled:opacity-50"
          >
            {exportingMap ? tr("hw.exporting") : tr("hw.exportMap")}
          </button>
          </div>

          {mapPaneMode === "map" ? (
          <div
            ref={mapInnerRef}
          onPointerDown={onMapPanPointerDown}
          onPointerMove={onMapPanPointerMove}
          onPointerUp={endMapPanDrag}
          onPointerCancel={endMapPanDrag}
          onDragOverCapture={(e) => {
            const types = [...e.dataTransfer.types];
            if (types.includes(DND_ASSOC_MIME) || types.includes(DND_ASSOC_OPTION)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDropCapture={(e) => {
            const types = [...e.dataTransfer.types];
            if (!types.includes(DND_ASSOC_MIME) && !types.includes(DND_ASSOC_OPTION)) return;
            e.preventDefault();
            e.stopPropagation();
            let associationId: string | null = null;
            let presetOptionId: string | null = null;
            if (types.includes(DND_ASSOC_OPTION)) {
              try {
                const raw = e.dataTransfer.getData(DND_ASSOC_OPTION);
                const j = JSON.parse(raw) as { associationId?: string; optionId?: string };
                if (typeof j.associationId === "string") associationId = j.associationId;
                if (typeof j.optionId === "string") presetOptionId = j.optionId;
              } catch {
                return;
              }
            } else {
              associationId = e.dataTransfer.getData(DND_ASSOC_MIME);
            }
            const stage = mapStageRef.current;
            if (!associationId || !stage) return;
            const rect = stage.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const xPct = (x / rect.width) * 100;
            const yPct = (y / rect.height) * 100;
            openPlaceFlow(associationId, xPct, yPct, presetOptionId);
          }}
            className={`relative min-h-[min(60vh,560px)] flex-1 overflow-hidden rounded-2xl border border-app-line-strong shadow-inner ${
              mapTheme === "dark" ? "bg-app-surface-2" : "bg-app-bg"
            } ${mapPanning ? "cursor-grabbing" : "cursor-grab"}`}
          >
          {!floorPlanDataUrl && (
            <div className="pointer-events-none absolute inset-0 z-0 app-map-grid-bg" />
          )}
          <div
            className={`pointer-events-none absolute left-2 top-2 z-[4] rounded px-2 py-1 text-xs font-medium ${
              mapTheme === "dark" ? "bg-app-surface-2/85 text-app-muted" : "bg-app-surface-2/95 text-app-subtle"
            }`}
          >
            {floorPlanDataUrl ? tr("hw.floorHintUp") : tr("hw.floorHintNone")}
          </div>

          <div
            className="absolute z-[3] overflow-visible touch-none select-none"
            style={{
              left: mapStageBox.w ? mapStageBox.ox + mapPan.x : mapPan.x,
              top: mapStageBox.h ? mapStageBox.oy + mapPan.y : mapPan.y,
              width: mapStageBox.w || "100%",
              height: mapStageBox.h || "100%",
              transform: `scale(${mapZoom})`,
              transformOrigin: "top left",
              containerType: "size",
            }}
          >
            <div ref={mapStageRef} className="relative h-full w-full overflow-visible">
            {floorPlanDataUrl ? (
              <img
                ref={floorImgRef}
                src={floorPlanDataUrl}
                alt={tr("hw.floorAlt")}
                onLoad={() => setMapLayoutTick((t) => t + 1)}
                className="pointer-events-none absolute inset-0 z-0 h-full w-full object-contain"
                style={{ opacity: floorPlanOpacityPct / 100 }}
              />
            ) : null}

            {maxOptionCount > 1
              ? Array.from({ length: maxOptionCount - 1 }, (_, i) => {
                  const leftPct = 10 + ((i + 1) / maxOptionCount) * 80;
                  return (
                    <div
                      key={i}
                      className="pointer-events-none absolute bottom-[clamp(4px,1.2cqi,10px)] top-[clamp(28px,8cqi,44px)] z-[2] w-px bg-app-line-subtle"
                      style={{ left: `${leftPct}%` }}
                    />
                  );
                })
              : null}

            {displayPlacements.map((p) => {
              const a = assocMap.get(p.associationId);
              if (!a) return null;
              const glyph = iconKeyForAssociation(a, materials, categoryDefs);
              const same = placements.filter((x) => x.associationId === p.associationId);
              const ord = same.findIndex((x) => x.id === p.id) + 1;
              const panelOpen = mapFloatPanelId === p.id;
              const pq = placementQty(p);
              const abbrev = (a.mapLabelAbbrev ?? "").trim();
              const productTitle = (abbrev || (a.deviceModel ?? "").trim() || a.hardwareName || "").trim();
              const deviceModelFull = (a.deviceModel ?? "").trim();
              const hardwareNameFull = (a.hardwareName ?? "").trim();
              const specBrief = optionLabelBrief(a, p.optionId);
              const mapTitleMain = [deviceModelFull, hardwareNameFull].filter(Boolean).join(" · ");
              const mapHoverFullTitle =
                [mapTitleMain, specBrief ?? ""].filter(Boolean).join(" — ") || abbrev || "";
              const catStr = associationMapCategory(a, materials, categoryDefs);
              const active = selectedPlacementId === p.id;
              const accent = accentForMap(a.color, mapTheme);
              const chipBg = chipSurfaceForMap(mapTheme);
              const labelC = chipLabelTextForMap(mapTheme);
              const assocTotalQty = placementCountForAssociation(p.associationId, placements);
              const hint = mapMarkerOverlapHints.get(p.id);
              const rightMarginPct = 100 - p.xPct;
              const leftMarginPct = p.xPct;
              const sideOk = Math.max(leftMarginPct, rightMarginPct) >= MAP_LABEL_SIDE_MIN_PCT;
              const neigh = placements.filter((o) => {
                if (o.id === p.id) return false;
                const dx = o.xPct - p.xPct;
                const dy = o.yPct - p.yPct;
                return Math.hypot(dx, dy) < 13;
              }).length;
              const hasMapAbbrev = !!abbrev;
              const showAutoName =
                hint?.showAutoName ??
                mapPinWantsAutoLabel(mapShowName, mapZoom, sideOk, neigh, hasMapAbbrev);
              const showManualName = mapShowName;
              const showTitle = showManualName || showAutoName;
              const useSideName = showTitle && sideOk;
              const showStackedName = showTitle && !sideOk;
              let labelOnRight = hint?.preferRight ?? rightMarginPct >= leftMarginPct;
              const labelMaxPx = hint?.labelMaxPx ?? mapMarker.iconPx * 5;
              const stageWpx = mapStageBox.w;
              if (useSideName && showTitle && stageWpx > 0) {
                const pinXpx = (p.xPct / 100) * stageWpx;
                const extW = mapMarker.gapIcon + labelMaxPx + MAP_LABEL_PILL_EXTRA_W;
                const rightEdgeIfRight = pinXpx + mapMarker.iconPx + extW;
                const leftExtentIfLeft = pinXpx - extW;
                if (labelOnRight && rightEdgeIfRight > stageWpx - MAP_STAGE_EDGE_PAD_PX) {
                  labelOnRight = false;
                }
                if (!labelOnRight && leftExtentIfLeft < MAP_STAGE_EDGE_PAD_PX) {
                  labelOnRight = true;
                }
              }
              const pillBg = mapLabelPillBgForMap(mapTheme);
              const pillBd = mapLabelPillBorderForMap(mapTheme);
              const mapLabelPillPadX = 6;
              const mapLabelPillPadY = 3;
              const renderMapLabelPill = () => (
                <div
                  data-map-label-pill
                  className="pointer-events-none border shadow-sm"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    width: "max-content",
                    maxWidth: labelMaxPx,
                    borderRadius: MAP_CHIP_UI_RADIUS_PX,
                    paddingLeft: mapLabelPillPadX,
                    paddingRight: mapLabelPillPadX,
                    paddingTop: mapLabelPillPadY,
                    paddingBottom: mapLabelPillPadY,
                    fontSize: mapMarker.titleFs,
                    color: labelC,
                    backgroundColor: pillBg,
                    borderColor: pillBd,
                    borderWidth: 1,
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    data-map-label-pill-text
                    className="flex min-w-0 max-w-full items-center gap-1 font-semibold leading-none"
                    style={{ fontSize: mapMarker.titleFs }}
                  >
                    <span data-map-label-pill-title className="min-w-0 flex-1 truncate">
                      {productTitle}
                    </span>
                    {pq > 1 ? (
                      <span className="shrink-0 whitespace-nowrap tabular-nums opacity-90">×{pq}</span>
                    ) : null}
                  </div>
                </div>
              );
              const zLift = mapHoverPlacementId === p.id ? 80 : active ? 25 : 10;
              const glyphProps = {
                id: glyph,
                className: "pointer-events-none shrink-0" as const,
                style: {
                  color: accent,
                  width: mapMarker.iconPx,
                  height: mapMarker.iconPx,
                },
              };
              const iconTile = (
                <div
                  className="flex shrink-0 items-center justify-center"
                  style={{
                    width: mapMarker.iconPx,
                    height: mapMarker.iconPx,
                    borderColor: accent,
                    borderStyle: "solid",
                    borderWidth: mapMarker.borderPx,
                    borderRadius: MAP_CHIP_UI_RADIUS_PX,
                    backgroundColor: chipBg,
                    boxShadow: active
                      ? `0 0 0 ${mapMarker.ringPx}px rgb(var(--app-primary-rgb) / 0.45)`
                      : undefined,
                  }}
                >
                  <HardwareGlyph {...glyphProps} />
                </div>
              );
              return (
                <div
                  key={p.id}
                  data-map-marker-chip
                  onMouseEnter={() => setMapHoverPlacementId(p.id)}
                  onMouseLeave={() => setMapHoverPlacementId(null)}
                  className={`absolute text-left [overflow:visible] ${
                    useSideName ? "max-w-[min(96cqi,88%)]" : "max-w-[min(92cqi,52%)]"
                  }`}
                  style={{
                    left: `${p.xPct}%`,
                    top: `${p.yPct}%`,
                    transform: mapZoom > 0.05 ? `scale(${1 / mapZoom})` : undefined,
                    transformOrigin: "top left",
                    zIndex: zLift,
                  }}
                >
                  <button
                    type="button"
                    title={mapHoverFullTitle || undefined}
                    className="flex min-w-0 cursor-grab flex-col text-left hover:opacity-95 active:cursor-grabbing"
                    onPointerDown={(e) => onChipPointerDown(p.id, e)}
                    style={{
                      margin: 0,
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      boxShadow: "none",
                      gap: mapMarker.colGap,
                    }}
                  >
                    {useSideName ? (
                      <div
                        className="relative shrink-0"
                        style={{ width: mapMarker.iconPx, height: mapMarker.iconPx }}
                      >
                        {!labelOnRight && showTitle ? (
                          <div
                            className="pointer-events-none absolute top-0 flex items-start justify-end"
                            style={{
                              right: `calc(100% + ${mapMarker.gapIcon}px)`,
                              maxWidth: labelMaxPx + MAP_LABEL_PILL_EXTRA_W,
                            }}
                          >
                            {renderMapLabelPill()}
                          </div>
                        ) : null}
                        {iconTile}
                        {labelOnRight && showTitle ? (
                          <div
                            className="pointer-events-none absolute top-0 flex items-start"
                            style={{
                              left: `calc(100% + ${mapMarker.gapIcon}px)`,
                              maxWidth: labelMaxPx + MAP_LABEL_PILL_EXTRA_W,
                            }}
                          >
                            {renderMapLabelPill()}
                          </div>
                        ) : null}
                      </div>
                    ) : showStackedName ? (
                      <div className="flex flex-col items-start" style={{ gap: mapMarker.colGap }}>
                        {iconTile}
                        <div className="min-w-0" style={{ maxWidth: labelMaxPx + MAP_LABEL_PILL_EXTRA_W }}>
                          {renderMapLabelPill()}
                        </div>
                      </div>
                    ) : (
                      iconTile
                    )}
                    {showManualName && panelOpen && catStr ? (
                      <div
                        className="min-w-0 truncate font-normal opacity-80"
                        style={{
                          color: labelC,
                          fontSize: mapMarker.subFs,
                          maxWidth: labelMaxPx,
                        }}
                      >
                        {catStr}
                      </div>
                    ) : null}
                    {mapShowQuantity && panelOpen ? (
                      <div
                        className="opacity-80"
                        style={{
                          color: labelC,
                          fontSize: mapMarker.subFs,
                        }}
                      >
                        {same.length > 1 && pq <= 1
                          ? tr("hw.markerOrdinal", { ord: String(ord), total: String(same.length) })
                          : tr("hw.markerSingle")}
                      </div>
                    ) : null}
                  </button>
                  {mapFloatPanelId === p.id ? (
                    <div
                      data-map-marker-panel
                      className="absolute left-0 top-[calc(100%+6px)] z-30 min-w-[168px] rounded-lg border border-app-line-strong bg-app-surface/95 p-2 shadow-2xl backdrop-blur"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-app-subtle">
                        {tr("hw.markerPanelTitle")}
                      </div>
                      <div className="mt-0.5 text-[11px] text-app-muted">
                        {tr("hw.markerPanelCount", { n: String(assocTotalQty) })}
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          className="rounded border border-app-line-mid px-2 py-1 text-xs text-app-text hover:bg-app-surface-2"
                          onClick={() => addPlacementNear(p.id)}
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          className="rounded border border-app-line-mid px-2 py-1 text-xs text-app-text hover:bg-app-surface-2"
                          onClick={() => removePlacementOne(p.id)}
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          className="rounded border border-app-danger-border px-2 py-1 text-xs text-app-danger-text hover:bg-app-danger-bg"
                          onClick={() => removePlacementAllForAssoc(p.associationId)}
                        >
                          {tr("hw.markerPanelRemoveAll")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            </div>
          </div>
          </div>
          ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-app-line-strong bg-app-panel-bg shadow-inner">
            <div className="shrink-0 border-b border-app-line-subtle px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-app-muted">
              {tr("cps.basket")}
            </div>
            <p className="shrink-0 px-2 py-1 text-[11px] leading-snug text-app-subtle">{tr("hw.listHint")}</p>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2">
              {mapListRows.length === 0 ? (
                <p className="py-8 text-center text-xs text-app-muted">{tr("hw.listEmpty")}</p>
              ) : (
                mapListRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedPlacementId(row.placementId)}
                    className="grid w-full grid-cols-[2rem_minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)] gap-2 rounded-lg border border-app-line-subtle bg-app-surface-2/50 p-2 text-left text-xs transition hover:border-app-line-mid hover:bg-app-surface-2/80"
                  >
                    <div className="flex items-start justify-center pt-0.5">
                      <HardwareGlyph id={row.glyph} className="h-5 w-5 shrink-0 text-app-muted" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-app-text">{row.a.hardwareName}</div>
                      <div className="line-clamp-2 text-[11px] text-app-muted">
                        {(row.a.mapLabelAbbrev ?? "").trim() || (row.a.deviceModel ?? "").trim() || "—"}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-app-subtle">{row.cat}</div>
                    </div>
                    <div className="min-w-0 self-center text-[11px] text-app-muted">
                      <div className="line-clamp-3">{row.optLb || "—"}</div>
                      <div className="mt-1 text-app-subtle">
                        {tr("cps.qty")} · {row.cnt}
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-center gap-0.5 self-center text-right">
                      <span className="text-[10px] uppercase tracking-wide text-app-subtle">{tr("cps.lineTotal")}</span>
                      <span className="font-semibold tabular-nums text-app-text">
                        {fmtCatalog(row.line)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
          )}

          {selectedPlacement && selectedAssoc ? (
          <div className="shrink-0 rounded-lg border border-app-line-subtle bg-app-surface-2/70 p-3 text-xs text-app-muted">
            <div className="text-xs font-medium uppercase tracking-wide text-app-muted">{tr("hw.selected")}</div>
            <div className="mt-1 text-sm text-app-text">{selectedAssoc.hardwareName}</div>
            {selectedAssoc.options.length > 0 && optionLabelBrief(selectedAssoc, selectedPlacement.optionId) ? (
              <div className="mt-0.5 text-xs text-app-muted">
                {tr("hw.specLabel", { label: optionLabelBrief(selectedAssoc, selectedPlacement.optionId) ?? "" })}
              </div>
            ) : null}
            {selectedAssoc.options.length > 0 ? (
              <div className="mt-2">
                <div className="mb-1 text-xs text-app-muted">{tr("hw.pickSpec")}</div>
                <div className="flex flex-wrap gap-1">
                  {selectedAssoc.options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => patchPlacement(selectedPlacement.id, { optionId: opt.id })}
                      className={`rounded border px-2 py-1 text-xs ${
                        selectedPlacement.optionId === opt.id
                          ? "border-app-primary bg-app-primary-soft text-app-tone"
                          : "border-app-line-mid text-app-muted hover:bg-app-surface-2"
                      }`}
                    >
                      {opt.label || "—"}
                      <span className="ml-1 text-app-muted">{optUnitShown(selectedAssoc, opt)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {selectedAssoc.addons.length ? (
              <div className="mt-2 border-t border-app-line-subtle pt-2">
                <div className="mb-1 text-xs text-app-muted">{tr("hw.addons")}</div>
                <div className="flex flex-col gap-1.5">
                  {selectedAssoc.addons.map((ad) => (
                    <label key={ad.id} className="flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 shrink-0 rounded border border-app-line-mid bg-app-surface-2"
                        checked={selectedPlacement.addonIds.includes(ad.id)}
                        onChange={(e) => {
                          const set = new Set(selectedPlacement.addonIds);
                          if (e.target.checked) set.add(ad.id);
                          else set.delete(ad.id);
                          patchPlacement(selectedPlacement.id, { addonIds: [...set] });
                        }}
                      />
                      <span className="flex-1">{ad.label}</span>
                      <span className="text-app-muted">+{fmtCatalog(ad.price)}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        </div>
      </div>

      {mapFilterOpen && mapListRows.length ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="map-filter-dialog-title"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-app-overlay-scrim p-4"
          onClick={() => setMapFilterOpen(false)}
        >
          <div
            className="flex max-h-[min(70vh,520px)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-app-line-strong bg-app-panel-bg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-app-line-subtle px-4 py-3">
              <h4 id="map-filter-dialog-title" className="text-sm font-semibold text-app-text">
                {tr("hw.mapFilter")}
              </h4>
              <button
                type="button"
                onClick={() => setMapFilterOpen(false)}
                className="rounded border border-app-line-mid px-2 py-0.5 text-xs text-app-muted hover:bg-app-surface-2"
                aria-label={tr("hw.cancel")}
              >
                ×
              </button>
            </div>
            <div className="flex shrink-0 gap-2 border-b border-app-line-subtle px-4 py-2">
              <button
                type="button"
                onClick={() => setAllMapFilterVisible(true)}
                className="flex-1 rounded border border-app-line-mid px-2 py-1.5 text-xs text-app-muted hover:bg-app-surface-2"
              >
                {tr("hw.mapFilterAll")}
              </button>
              <button
                type="button"
                onClick={() => setAllMapFilterVisible(false)}
                className="flex-1 rounded border border-app-line-mid px-2 py-1.5 text-xs text-app-muted hover:bg-app-surface-2"
              >
                {tr("hw.mapFilterNone")}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {mapListRows.map((row) => {
                const visible = !mapHiddenAssocIds.has(row.id);
                return (
                  <label
                    key={row.id}
                    className="flex cursor-pointer items-center gap-2 px-4 py-2 text-xs hover:bg-app-surface-2"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 shrink-0 rounded border border-app-line-mid bg-app-surface-2"
                      checked={visible}
                      onChange={(e) => setMapFilterAssocVisible(row.id, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1 truncate text-app-text" title={row.label}>
                      {row.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-app-muted">{row.cnt}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex shrink-0 justify-end border-t border-app-line-subtle px-4 py-3">
              <button
                type="button"
                onClick={() => setMapFilterOpen(false)}
                className="ui-primaryBtn px-4 py-1.5 text-xs"
              >
                {tr("hw.mapFilterDone")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {placeDialog && placeDialogAssoc ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="place-dialog-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-app-overlay-scrim p-4"
          onClick={() => setPlaceDialog(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-app-line-strong bg-app-surface p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div id="place-dialog-title" className="text-sm font-semibold text-app-text">
              {tr("hw.placeOnMap")}
            </div>
            <div className="mt-1 text-xs text-app-muted">{placeDialogAssoc.hardwareName}</div>
            {placeDialogAssoc.options.length ? (
              <div className="mt-3">
                <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-app-muted">{tr("hw.spec")}</div>
                <div className="flex flex-col gap-1.5">
                  {placeDialogAssoc.options.map((opt) => (
                    <label
                      key={opt.id}
                      className="flex cursor-pointer items-start gap-2 rounded-lg border border-app-line-strong bg-app-surface-2/80 px-2 py-2 text-xs"
                    >
                      <input
                        type="radio"
                        name="place-map-opt"
                        className="mt-0.5"
                        checked={placeDialog.optionId === opt.id}
                        onChange={() => setPlaceDialog((d) => (d ? { ...d, optionId: opt.id } : d))}
                      />
                      <span className="flex-1 text-app-text">
                        {opt.label || "—"}
                        <span className="ml-1 text-app-muted">{optUnitShown(placeDialogAssoc, opt)}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {placeDialogAssoc.addons.length ? (
              <div className="mt-3 border-t border-app-line-subtle pt-3">
                <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-app-muted">
                  {tr("hw.addonSection")}
                </div>
                <div className="flex flex-col gap-1.5">
                  {placeDialogAssoc.addons.map((ad) => (
                    <label key={ad.id} className="flex cursor-pointer items-center gap-2 text-xs text-app-text">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 shrink-0 rounded border border-app-line-mid bg-app-surface-2"
                        checked={placeDialog.addonIds.includes(ad.id)}
                        onChange={(e) => {
                          setPlaceDialog((d) => {
                            if (!d) return d;
                            const set = new Set(d.addonIds);
                            if (e.target.checked) set.add(ad.id);
                            else set.delete(ad.id);
                            return { ...d, addonIds: [...set] };
                          });
                        }}
                      />
                      <span className="flex-1">{ad.label}</span>
                      <span className="text-app-muted">+{fmtCatalog(ad.price)}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-app-line-mid px-3 py-2 text-sm text-app-muted hover:bg-app-surface-2"
                onClick={() => setPlaceDialog(null)}
              >
                {tr("hw.cancel")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-app-primary px-4 py-2 text-sm font-medium text-app-on-primary hover:bg-app-primary-hover"
                onClick={confirmPlaceDialog}
              >
                {tr("hw.confirmPlace")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
