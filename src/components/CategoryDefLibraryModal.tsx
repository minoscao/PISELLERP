import { useCallback, useEffect, useMemo, useState, type MouseEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { HardwareGlyph, HARDWARE_ICON_IDS, HARDWARE_ICON_LABELS } from "../icons/hardwareGlyphs";
import { useQuoteStore } from "../store/quoteStore";
import type { MaterialCategoryDef } from "../types";
import { categoryOptionText } from "../utils/categoryDisplay";
import { UNCATEGORIZED_CATEGORY_NAME, isBrandOnlyMaterialCategory } from "../constants/materialCategories";
import { useT } from "../i18n/useT";

/** Prefer pointer hit target; avoids rect-only misses inside scroll areas. */
const categoryLibraryCollision: CollisionDetection = (args) => {
  const fromPointer = pointerWithin(args);
  if (fromPointer.length) return fromPointer;
  return closestCorners(args);
};

function normIconKey(k: string): string {
  return (HARDWARE_ICON_IDS as readonly string[]).includes(k) ? k : "device";
}

function IconPickerLayer({
  open,
  onClose,
  currentIcon,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  currentIcon: string;
  onPick: (id: string) => void;
}) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-app-overlay-scrim/80 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={t("rel.erpIconPickerIcons")}
        className="max-h-[min(360px,55vh)] w-full max-w-sm overflow-y-auto rounded-xl border border-app-line-strong bg-app-surface p-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 text-xs font-medium text-app-muted">{t("rel.erpIconPickerIcons")}</div>
        <div className="grid grid-cols-5 gap-1">
          {HARDWARE_ICON_IDS.map((id) => (
            <button
              key={id}
              type="button"
              title={HARDWARE_ICON_LABELS[id as keyof typeof HARDWARE_ICON_LABELS] ?? id}
              onClick={() => {
                onPick(id);
                onClose();
              }}
              className={
                normIconKey(currentIcon) === id
                  ? "rounded border border-app-primary bg-app-primary-soft p-1"
                  : "rounded border border-app-line-mid p-1 hover:bg-app-surface-2"
              }
            >
              <HardwareGlyph id={id} className="h-5 w-5 text-app-muted" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SortableCategoryRow({
  d,
  onPatchEn,
  onPatchIcon,
  onRenameZh,
  iconPickerOpen,
  onOpenIconPicker,
  onCloseIconPicker,
  skuCount,
  onRequestDelete,
}: {
  d: MaterialCategoryDef;
  onPatchEn: (name: string, en: string) => void;
  onPatchIcon: (name: string, icon: string) => void;
  onRenameZh: (oldName: string, newName: string) => void;
  iconPickerOpen: boolean;
  onOpenIconPicker: () => void;
  onCloseIconPicker: () => void;
  skuCount: number;
  onRequestDelete: () => void;
}) {
  const t = useT();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: d.name,
    transition: { duration: 280, easing: "ease" },
  });
  const [zhName, setZhName] = useState(d.name);
  useEffect(() => {
    setZhName(d.name);
  }, [d.name]);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const stopSortable = useCallback((e: PointerEvent | MouseEvent) => {
    e.stopPropagation();
  }, []);
  const mergedRef = useCallback(
    (el: HTMLLIElement | null) => {
      setNodeRef(el);
      setActivatorNodeRef(el);
    },
    [setNodeRef, setActivatorNodeRef],
  );
  return (
    <li
      ref={mergedRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab rounded-lg border border-app-line-subtle bg-app-surface-2/30 p-2 active:cursor-grabbing ${
        isDragging ? "relative z-[80] shadow-lg ring-1 ring-app-primary/35" : ""
      }`}
    >
      <div className="min-w-0">
          <span className="text-[10px] font-medium uppercase tracking-wide text-app-muted">{t("cat.libRenameKey")}</span>
          <input
            value={zhName}
            disabled={d.name === UNCATEGORIZED_CATEGORY_NAME}
            onChange={(e) => setZhName(e.target.value)}
            onPointerDown={stopSortable}
            onMouseDown={stopSortable}
            onBlur={() => {
              const next = zhName.trim();
              if (next && next !== d.name) onRenameZh(d.name, next);
            }}
            className="mt-0.5 w-full rounded border border-app-line-strong bg-app-surface-2 px-2 py-1 text-xs text-app-text disabled:opacity-50"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onPointerDown={stopSortable}
              onMouseDown={stopSortable}
              onClick={() => (iconPickerOpen ? onCloseIconPicker() : onOpenIconPicker())}
              className="flex items-center gap-1.5 rounded border border-app-line-mid bg-app-surface-2/50 px-2 py-1 text-xs text-app-text hover:bg-app-surface-2"
              aria-expanded={iconPickerOpen}
              aria-haspopup="dialog"
            >
              <HardwareGlyph id={normIconKey(d.iconKey)} className="h-4 w-4 shrink-0 text-app-muted" />
              <span>{t("rel.erpIconPickerIcons")}</span>
            </button>
            <div className="min-w-0 text-xs font-medium text-app-text">{categoryOptionText(d)}</div>
          </div>
          <input
            value={d.nameEn ?? ""}
            onChange={(e) => onPatchEn(d.name, e.target.value)}
            onPointerDown={stopSortable}
            onMouseDown={stopSortable}
            aria-label={t("cat.libNameEnField")}
            className="mt-1 w-full rounded border border-app-line-strong bg-app-surface-2 px-2 py-1 text-xs text-app-text"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] text-app-muted">
              {skuCount > 0 ? t("cat.libSkuCount", { n: skuCount }) : t("cat.libNoSkus")}
            </span>
            <button
              type="button"
              onPointerDown={stopSortable}
              onMouseDown={stopSortable}
              onClick={onRequestDelete}
              className="rounded border border-app-danger-border/80 px-2 py-1 text-[10px] font-medium text-app-danger-text hover:bg-app-danger-bg"
            >
              {t("cat.libDeleteBtn")}
            </button>
          </div>
          <IconPickerLayer
            open={iconPickerOpen}
            onClose={onCloseIconPicker}
            currentIcon={d.iconKey ?? "device"}
            onPick={(id) => onPatchIcon(d.name, id)}
          />
      </div>
    </li>
  );
}

export function CategoryDefLibraryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const categoryDefs = useQuoteStore((s) => s.categoryDefs);
  const associations = useQuoteStore((s) => s.associations);
  const reorderCategoryDefs = useQuoteStore((s) => s.reorderCategoryDefs);
  const patchCategoryDef = useQuoteStore((s) => s.patchCategoryDef);
  const setCategoryIcon = useQuoteStore((s) => s.setCategoryIcon);
  const renameCategoryDef = useQuoteStore((s) => s.renameCategoryDef);
  const removeCategory = useQuoteStore((s) => s.removeCategory);

  const { sortable, unc } = useMemo(() => {
    const u = categoryDefs.find((d) => d.name === UNCATEGORIZED_CATEGORY_NAME);
    const rest = categoryDefs.filter(
      (d) => d.name !== UNCATEGORIZED_CATEGORY_NAME && !isBrandOnlyMaterialCategory(d.name),
    );
    return { sortable: rest, unc: u };
  }, [categoryDefs]);

  const ids = useMemo(() => sortable.map((d) => d.name), [sortable]);

  const [iconMenuFor, setIconMenuFor] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!open) {
      setIconMenuFor(null);
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-app-overlay-scrim/90 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex h-[min(92vh,920px)] w-[min(96vw,1440px)] max-h-[92vh] max-w-[96vw] flex-col overflow-hidden rounded-xl border border-app-line-strong bg-app-surface p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-app-text">{t("cat.libTitle")}</h4>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-app-line-mid px-2 py-1 text-xs text-app-muted hover:bg-app-surface-2"
          >
            {t("cat.libClose")}
          </button>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
          <DndContext
            sensors={sensors}
            collisionDetection={categoryLibraryCollision}
            measuring={{
              droppable: { strategy: MeasuringStrategy.Always },
            }}
            onDragStart={() => {
              setIconMenuFor(null);
            }}
            onDragEnd={({ active, over }) => {
              if (!over || active.id === over.id) return;
              const a = String(active.id);
              const b = String(over.id);
              const oi = ids.indexOf(a);
              const ni = ids.indexOf(b);
              if (oi < 0 || ni < 0) return;
              const moved = arrayMove([...ids], oi, ni);
              reorderCategoryDefs(moved);
            }}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2">
                {sortable.map((d) => (
                  <SortableCategoryRow
                    key={d.name}
                    d={d}
                    onPatchEn={(name, v) => patchCategoryDef(name, { nameEn: v })}
                    onPatchIcon={(name, icon) => setCategoryIcon(name, icon)}
                    onRenameZh={(oldName, newName) => renameCategoryDef(oldName, newName)}
                    iconPickerOpen={iconMenuFor === d.name}
                    onOpenIconPicker={() => setIconMenuFor(d.name)}
                    onCloseIconPicker={() => setIconMenuFor((cur) => (cur === d.name ? null : cur))}
                    skuCount={associations.filter((a) => a.hardwareName === d.name).length}
                    onRequestDelete={() => {
                      const n = associations.filter((a) => a.hardwareName === d.name).length;
                      if (
                        !window.confirm(
                          t("cat.libDeleteConfirm", {
                            name: categoryOptionText(d),
                            n,
                          }),
                        )
                      )
                        return;
                      removeCategory(d.name);
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>

        {unc ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-app-line-subtle/80 bg-app-surface-2/25 p-2">
            <HardwareGlyph id={normIconKey(unc.iconKey)} className="h-4 w-4" />
            <span className="text-xs text-app-text">{categoryOptionText(unc)}</span>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
