import { useMemo } from "react";
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
import { HardwareGlyph } from "../icons/hardwareGlyphs";
import type { MaterialFolderNavRow } from "./MaterialFolderNav";
import { folderNavNormIcon } from "./MaterialFolderNav";

const hwFolderCollision: CollisionDetection = (args) => {
  const pw = pointerWithin(args);
  if (pw.length) return pw;
  return closestCorners(args);
};

function SortableHardwarePrimaryRow({ primary, r }: { primary: string; r: MaterialFolderNavRow }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: primary,
    transition: { duration: 280, easing: "ease" },
  });
  const pad = r.indent === 1 ? "ml-2 border-l-2 border-app-line-subtle/50 pl-2" : "";
  const sz = r.dense ? "text-[11px]" : "text-[12px]";
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <li className="list-none touch-none">
      <button
        type="button"
        ref={(el) => {
          setNodeRef(el);
          setActivatorNodeRef(el);
        }}
        style={style}
        {...attributes}
        {...listeners}
        onClick={r.onClick}
        className={`ui-folderBtn ${sz} w-full select-none${r.selected ? " ui-folderBtn--on" : ""} ${pad} cursor-grab active:cursor-grabbing ${
          isDragging ? "relative z-[80] shadow-lg ring-1 ring-app-primary/35" : ""
        }`}
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
    </li>
  );
}

/** Hardware ERP / 市场资料侧栏：一级主类排序，与分类库相同的 @dnd-kit 位移与指针碰撞。 */
export function HardwarePrimariesSortable({
  primaryIds,
  rowByPrimary,
  onReorder,
}: {
  primaryIds: string[];
  rowByPrimary: Map<string, MaterialFolderNavRow>;
  onReorder: (next: string[]) => void;
}) {
  const ids = useMemo(() => [...primaryIds], [primaryIds]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (ids.length === 0) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={hwFolderCollision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return;
        const a = String(active.id);
        const b = String(over.id);
        const oi = ids.indexOf(a);
        const ni = ids.indexOf(b);
        if (oi < 0 || ni < 0) return;
        onReorder(arrayMove([...ids], oi, ni));
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="flex list-none flex-col gap-0.5 p-0">
          {ids.map((p) => {
            const r = rowByPrimary.get(p);
            if (!r) return null;
            return <SortableHardwarePrimaryRow key={p} primary={p} r={r} />;
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
