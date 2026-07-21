import { useCallback, useEffect, useState, type DragEvent, type ReactNode } from "react";
import { HardwarePrimariesSortable } from "./HardwarePrimariesSortable";
import { HardwareGlyph, HARDWARE_ICON_IDS } from "../icons/hardwareGlyphs";
import type { AssociationRow, ErpHardwareNavSortMode, MaterialCategoryDef, MaterialPage } from "../types";
import { categoryPrimaryFromLabel, hardwareNavPrimaryLabel } from "../utils/erpCatalogCategories";
import { categoryOptionText } from "../utils/categoryDisplay";
import { countProductMaterialsForHardwareDef } from "../utils/erpProductMaterialFilter";
import { hardwareCategoryUsageCount } from "../utils/categoryUsageCounts";

export function folderNavNormIcon(k: string | null | undefined): string {
  const x = k ?? "device";
  return (HARDWARE_ICON_IDS as readonly string[]).includes(x) ? x : "device";
}

export type MaterialFolderNavRow = {
  id: string;
  label: string;
  count?: number;
  iconKey?: string | null;
  indent?: 0 | 1;
  dense?: boolean;
  selected: boolean;
  onClick: () => void;
  /** label = 不可点说明行 */
  action?: "button" | "label";
  draggable?: boolean;
  onDragStart?: (e: DragEvent<HTMLButtonElement>) => void;
  onDragOver?: (e: DragEvent<HTMLButtonElement>) => void;
  onDrop?: (e: DragEvent<HTMLButtonElement>) => void;
};

export type MaterialFolderNavGroup = {
  id: string;
  title?: string | null;
  defaultOpen?: boolean;
  rows: MaterialFolderNavRow[];
  /** 硬件一级主类 id 顺序（与 `rows` 中 `*:p:*` 行对应）；非空且提供 `onHardwarePrimariesReorder` 时用 dnd-kit 排序 */
  hardwareSortablePrimaries?: string[] | null;
  onHardwarePrimariesReorder?: (next: string[]) => void;
};

type MaterialFolderNavProps = {
  groups: MaterialFolderNavGroup[];
  topSlot?: ReactNode;
  footer?: ReactNode;
  className?: string;
  expandedByGroupId?: Record<string, boolean> | null;
  onExpandedChange?: (groupId: string, nextOpen: boolean) => void;
  /** When the parent is the scroll container (e.g. category picker), avoid nested overflow so wheel scroll works. */
  disableInnerScroll?: boolean;
};

function Row({ r }: { r: MaterialFolderNavRow }) {
  const pad = r.indent === 1 ? "ml-2 border-l-2 border-app-line-subtle/50 pl-2" : "";
  const sz = r.dense ? "text-[11px]" : "text-[12px]";
  if (r.action === "label") {
    return <div className={`px-2 py-1 text-[11px] text-app-subtle ${pad}`}>{r.label}</div>;
  }
  return (
    <button
      type="button"
      onClick={r.onClick}
      draggable={r.draggable === true}
      onDragStart={r.onDragStart}
      onDragOver={r.onDragOver}
      onDrop={r.onDrop}
      className={`ui-folderBtn ${sz}${r.selected ? " ui-folderBtn--on" : ""} ${pad}`}
    >
      {r.iconKey != null ? (
        <HardwareGlyph id={folderNavNormIcon(r.iconKey)} className="h-4 w-4 shrink-0 text-app-muted" />
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate text-left text-app-text">{r.label}</span>
      {r.count != null ? (
        <span className="shrink-0 tabular-nums text-[11px] text-app-muted">{r.count}</span>
      ) : null}
    </button>
  );
}

function buildPrimaryRowMap(rows: MaterialFolderNavRow[]): Map<string, MaterialFolderNavRow> {
  const m = new Map<string, MaterialFolderNavRow>();
  for (const r of rows) {
    const parts = r.id.split(":p:");
    if (parts.length === 2 && (r.indent ?? 0) === 0 && r.action !== "label") {
      m.set(parts[1]!, r);
    }
  }
  return m;
}

function renderGroupRows(g: MaterialFolderNavGroup) {
  const sortIds = g.hardwareSortablePrimaries;
  const onReorder = g.onHardwarePrimariesReorder;
  const rows = g.rows;
  if (!sortIds?.length || !onReorder) {
    return rows.map((r) => <Row key={r.id} r={r} />);
  }
  const rowMap = buildPrimaryRowMap(rows);
  const out: ReactNode[] = [];
  let pastSortable = false;
  for (const r of rows) {
    const parts = r.id.split(":p:");
    const isPrimary = parts.length === 2 && (r.indent ?? 0) === 0 && r.action !== "label";
    if (!pastSortable) {
      if (isPrimary) {
        out.push(
          <HardwarePrimariesSortable
            key={`${g.id}-hw-sort`}
            primaryIds={sortIds}
            rowByPrimary={rowMap}
            onReorder={onReorder}
          />,
        );
        pastSortable = true;
        continue;
      }
      out.push(<Row key={r.id} r={r} />);
      continue;
    }
    if (isPrimary) continue;
    out.push(<Row key={r.id} r={r} />);
  }
  return out;
}

function groupTitleEn(group: MaterialCategoryDef[]): string {
  if (group.length === 0) return "";
  const withEn = group.find((x) => x.nameEn?.trim());
  if (withEn?.nameEn) {
    const s = withEn.nameEn.trim();
    const j = s.indexOf(" · ");
    if (j > 0) return s.slice(0, j).trim();
  }
  return categoryPrimaryFromLabel(group[0]!.name);
}

export type CategoryDefsPickerOptions = {
  sortMode?: ErpHardwareNavSortMode;
  /** ERP 产品库：与左侧目录相同的素材计数口径 */
  erpNavMaterialsInTab?: MaterialPage[] | null;
  /** 完整分类库顺序（manual 模式下组内顺序） */
  allCategoryDefs?: MaterialCategoryDef[] | null;
  /** 与左侧硬件主类顺序一致（通常由 `listHardwareNavPrimaries` + sortMode 得到） */
  orderedHardwarePrimaries?: string[] | null;
};

function primaryRankInDefs(primary: string, defs: MaterialCategoryDef[]): number {
  let minI = 1e9;
  for (let i = 0; i < defs.length; i++) {
    if (categoryPrimaryFromLabel(defs[i]!.name) !== primary) continue;
    minI = Math.min(minI, i);
  }
  return minI;
}

/** 硬件分类下拉：与 ERP/Media 同一 `MaterialFolderNav` 数据结构 */
export function categoryDefsToPickerGroups(
  defs: MaterialCategoryDef[],
  selectedName: string | null,
  onPick: (d: MaterialCategoryDef) => void,
  materials: MaterialPage[],
  associations: AssociationRow[],
  options?: CategoryDefsPickerOptions | null,
): MaterialFolderNavGroup[] {
  const sortMode = options?.sortMode ?? "manual";
  const allDefs = options?.allCategoryDefs ?? defs;
  const orderIndex = (d: MaterialCategoryDef) => allDefs.findIndex((x) => x.name === d.name);

  const m = new Map<string, MaterialCategoryDef[]>();
  for (const d of defs) {
    const k = categoryPrimaryFromLabel(d.name);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(d);
  }
  for (const arr of m.values()) {
    if (sortMode === "az") {
      arr.sort((a, b) =>
        categoryOptionText(a).localeCompare(categoryOptionText(b), "en", { sensitivity: "base" }),
      );
    } else {
      arr.sort((a, b) => {
        const ia = orderIndex(a);
        const ib = orderIndex(b);
        return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
    }
  }

  const keysWithDefs = [...m.keys()];
  const ord = options?.orderedHardwarePrimaries?.filter((p) => keysWithDefs.includes(p)) ?? [];
  const rest = keysWithDefs.filter((p) => !ord.includes(p));
  if (rest.length) {
    if (sortMode === "az") {
      rest.sort((a, b) =>
        hardwareNavPrimaryLabel(a, allDefs).localeCompare(hardwareNavPrimaryLabel(b, allDefs), "en", {
          sensitivity: "base",
        }),
      );
    } else {
      rest.sort((a, b) => primaryRankInDefs(a, allDefs) - primaryRankInDefs(b, allDefs) || a.localeCompare(b));
    }
  }
  const primaryOrder = ord.length || options?.orderedHardwarePrimaries?.length ? [...ord, ...rest] : null;

  const sortedEntries = primaryOrder
    ? primaryOrder.map((pk) => [pk, m.get(pk)!] as const).filter(([, items]) => items?.length)
    : [...m.entries()].sort((a, b) =>
        groupTitleEn(a[1]).localeCompare(groupTitleEn(b[1]), "en", { sensitivity: "base" }),
      );

  const countRow = (d: MaterialCategoryDef) =>
    options?.erpNavMaterialsInTab
      ? countProductMaterialsForHardwareDef(options.erpNavMaterialsInTab, d)
      : hardwareCategoryUsageCount(d, materials, associations);

  return sortedEntries.map(([gk, items]) => ({
    id: `pick:${gk}`,
    title: groupTitleEn(items),
    rows: items.map((d) => ({
      id: d.name,
      label: categoryOptionText(d),
      count: countRow(d),
      iconKey: d.iconKey,
      selected: (selectedName ?? "").trim() === d.name,
      onClick: () => onPick(d),
    })),
  }));
}

export function MaterialFolderNav({
  groups,
  topSlot,
  footer,
  className = "",
  expandedByGroupId = null,
  onExpandedChange,
  disableInnerScroll = false,
}: MaterialFolderNavProps) {
  const controlled = expandedByGroupId != null;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(() => {
    const m = new Map<string, boolean>();
    for (const g of groups) m.set(g.id, g.defaultOpen !== false);
    return m;
  });

  const isOpen = useCallback(
    (id: string, def: boolean) => {
      if (controlled) return expandedByGroupId![id] !== false;
      return uncontrolledOpen.get(id) ?? def;
    },
    [controlled, expandedByGroupId, uncontrolledOpen],
  );

  const toggle = useCallback(
    (id: string, def: boolean) => {
      const cur = isOpen(id, def);
      const next = !cur;
      if (controlled) onExpandedChange?.(id, next);
      else setUncontrolledOpen((prev) => new Map(prev).set(id, next));
    },
    [controlled, isOpen, onExpandedChange],
  );

  useEffect(() => {
    if (controlled) return;
    setUncontrolledOpen((prev) => {
      let changed = false;
      const n = new Map(prev);
      for (const g of groups) {
        if (!n.has(g.id)) {
          n.set(g.id, g.defaultOpen !== false);
          changed = true;
        }
      }
      return changed ? n : prev;
    });
  }, [groups, controlled]);

  return (
    <div
      className={`flex min-h-0 w-full min-w-0 flex-col ${disableInnerScroll ? "" : "flex-1"} ${className}`}
    >
      {topSlot ? <div className="shrink-0">{topSlot}</div> : null}
      <div
        className={`relative z-0 min-h-0 space-y-0 p-0.5 [overflow-anchor:none] ${
          disableInnerScroll
            ? "overflow-visible"
            : "min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
        }`}
      >
        {groups.map((g) => {
          const hasTitle = g.title != null && String(g.title).trim() !== "";
          const open = isOpen(g.id, g.defaultOpen !== false);
          const inner = <div className="flex flex-col gap-0.5">{renderGroupRows(g)}</div>;
          if (!hasTitle) {
            return (
              <div key={g.id} className="flex flex-col gap-0.5">
                {renderGroupRows(g)}
              </div>
            );
          }
          return (
            <div
              key={g.id}
              className="mb-1.5 rounded-xl border border-app-line-subtle/60 bg-app-panel-bg/80 p-1 shadow-sm backdrop-blur-sm last:mb-0"
            >
              <div className="mb-0.5 flex items-center justify-between gap-1 px-0.5 pt-0.5">
                <span className="pl-1 text-[10px] font-bold uppercase leading-none tracking-wide text-app-muted">
                  {g.title}
                </span>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggle(g.id, g.defaultOpen !== false)}
                  className="ui-toolBtn flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-app-line-subtle/80 text-sm font-semibold text-app-muted"
                >
                  {open ? "−" : "+"}
                </button>
              </div>
              {open ? inner : null}
            </div>
          );
        })}
      </div>
      {footer}
    </div>
  );
}
