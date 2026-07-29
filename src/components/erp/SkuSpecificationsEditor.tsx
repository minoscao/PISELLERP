import { useRef, useState, type PointerEvent } from "react";
import type { AssociationRow, SkuClass } from "../../types";
import { inferSkuClass, SKU_CLASS_LABEL } from "../../utils/skuSpecifications";

type SkuSpecificationsEditorProps = {
  value: AssociationRow;
  onChange: (patch: Partial<AssociationRow>) => void;
  compact?: boolean;
};

type DragAxis = "length" | "width";

const CLASS_OPTIONS: SkuClass[] = ["main_device", "accessory", "consumable"];

function numberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function rounded(value: number) {
  return Math.max(5, Math.round(value / 5) * 5);
}

function NumberField({ label, value, suffix, onChange }: { label: string; value: number | null | undefined; suffix: string; onChange: (value: number | null) => void }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] text-app-muted">
      <span>{label}</span>
      <span className="flex min-w-0 items-center rounded-md border border-app-line-strong bg-app-surface-2 focus-within:border-app-primary">
        <input
          type="number"
          min="0"
          value={value ?? ""}
          onChange={(event) => onChange(numberOrNull(event.target.value))}
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-app-text outline-none"
        />
        <span className="pr-2 text-[10px] text-app-subtle">{suffix}</span>
      </span>
    </label>
  );
}

/** Reusable SKU dimensions and specification editor. The two ruler lines are directly draggable. */
export function SkuSpecificationsEditor({ value, onChange, compact = false }: SkuSpecificationsEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<DragAxis | null>(null);
  const skuClass = value.skuClass ?? inferSkuClass(value);
  const isDevice = skuClass !== "consumable";
  const lengthCm = value.lengthCm ?? (skuClass === "main_device" ? 300 : 100);
  const widthCm = value.widthCm ?? (skuClass === "main_device" ? 300 : 100);

  const changeClass = (next: SkuClass) => {
    onChange({
      skuClass: next,
      ...(next === "main_device"
        ? { lengthCm: value.lengthCm ?? 300, widthCm: value.widthCm ?? 300 }
        : {}),
    });
  };

  const beginDrag = (axis: DragAxis, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(axis);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const relative = dragging === "length" ? (event.clientX - rect.left) / rect.width : (event.clientY - rect.top) / rect.height;
    const next = rounded(Math.min(600, Math.max(5, relative * 600)));
    onChange(dragging === "length" ? { lengthCm: next } : { widthCm: next });
  };

  const lengthPct = Math.min(88, Math.max(34, (lengthCm / 600) * 88));
  const widthPct = Math.min(78, Math.max(30, (widthCm / 600) * 78));

  return (
    <section className={`rounded-lg border border-app-line-subtle bg-app-surface-2/35 ${compact ? "p-2" : "p-3"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-app-text">SKU type & specifications</div>
          <div className="mt-0.5 text-[10px] text-app-subtle">Stands, mounts and brackets belong in assistive equipment.</div>
        </div>
        <select
          value={skuClass}
          onChange={(event) => changeClass(event.target.value as SkuClass)}
          className="rounded-md border border-app-line-strong bg-app-surface px-2 py-1.5 text-xs text-app-text"
          aria-label="SKU type"
        >
          {CLASS_OPTIONS.map((kind) => <option key={kind} value={kind}>{SKU_CLASS_LABEL[kind]}</option>)}
        </select>
      </div>

      {isDevice ? (
        <>
          <div
            ref={stageRef}
            className="relative mt-3 h-32 overflow-hidden rounded-md border border-app-line-strong bg-app-surface"
            onPointerMove={moveDrag}
            onPointerUp={() => setDragging(null)}
            onPointerCancel={() => setDragging(null)}
          >
            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(var(--app-line-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--app-line-subtle) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
            <div
              className="absolute left-[10%] top-[22%] border-2 border-app-primary/80 bg-app-primary/15 transition-[width,height] duration-100"
              style={{ width: `${lengthPct}%`, height: `${widthPct}%` }}
            />
            <button
              type="button"
              onPointerDown={(event) => beginDrag("length", event)}
              className="absolute left-[10%] top-[14%] h-5 cursor-ew-resize border-b-2 border-app-primary text-[10px] font-semibold text-app-primary"
              style={{ width: `${lengthPct}%` }}
              aria-label="Drag to set length"
            >
              <span className="absolute left-1/2 -translate-x-1/2 -translate-y-4 whitespace-nowrap rounded bg-app-surface px-1.5 py-0.5">↔ {lengthCm} cm</span>
            </button>
            <button
              type="button"
              onPointerDown={(event) => beginDrag("width", event)}
              className="absolute left-[6%] top-[22%] w-5 cursor-ns-resize border-r-2 border-app-primary text-[10px] font-semibold text-app-primary"
              style={{ height: `${widthPct}%` }}
              aria-label="Drag to set width"
            >
              <span className="absolute left-0 top-1/2 -translate-x-8 -translate-y-1/2 -rotate-90 whitespace-nowrap rounded bg-app-surface px-1.5 py-0.5">↕ {widthCm} cm</span>
            </button>
            <div className="absolute bottom-2 right-2 rounded bg-app-surface/90 px-1.5 py-0.5 text-[10px] text-app-subtle">Drag either ruler line</div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <NumberField label="Length" value={lengthCm} suffix="cm" onChange={(next) => onChange({ lengthCm: next })} />
            <NumberField label="Width" value={widthCm} suffix="cm" onChange={(next) => onChange({ widthCm: next })} />
            <NumberField label="Height" value={value.heightCm} suffix="cm" onChange={(next) => onChange({ heightCm: next })} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <NumberField label="Weight" value={value.weightKg} suffix="kg" onChange={(next) => onChange({ weightKg: next })} />
            <NumberField label="Power" value={value.powerWatts} suffix="W" onChange={(next) => onChange({ powerWatts: next })} />
          </div>
        </>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-app-line-strong px-3 py-2 text-xs text-app-muted">
          Consumables do not require an equipment footprint or power specifications.
        </div>
      )}
    </section>
  );
}
