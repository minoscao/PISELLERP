import type { DragEvent, ReactNode } from "react";
import { useT } from "../i18n/useT";

const DND_TYPE = "application/x-marketing-cart-line";

const TRASH_BTN =
  "inline-flex h-11 w-11 min-h-[2.75rem] min-w-[2.75rem] max-h-[2.75rem] max-w-[2.75rem] shrink-0 items-center justify-center rounded-lg border border-app-danger-border text-app-danger-text hover:bg-app-danger-bg";

function IconGrip() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-app-muted" aria-hidden>
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
    </svg>
  );
}

export type BasketAddonRow = {
  id: string;
  label: string;
  unitPrice: number;
  quantity: number;
  onQuantityChange: (n: number) => void;
};

export type CustomPlanBasketLineProps = {
  lineId: string;
  title: string;
  note: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  onQuantityChange: (n: number) => void;
  onRemove: () => void;
  onReorder: (draggedLineId: string, targetLineId: string) => void;
  specsSummary: ReactNode;
  specsConfigurable?: boolean;
  onConfigureSpecs?: () => void;
  /** 分行展示的 Add-on，每项自带数量（与中部规格区分开） */
  addonRows?: BasketAddonRow[];
};

export function CustomPlanBasketLine({
  lineId,
  title,
  note,
  unitPrice,
  quantity,
  lineTotal,
  onQuantityChange,
  onRemove,
  onReorder,
  specsSummary,
  specsConfigurable,
  onConfigureSpecs,
  addonRows,
}: CustomPlanBasketLineProps) {
  const t = useT();
  const q = Math.max(1, Math.floor(quantity) || 1);

  const acceptDrag = (e: DragEvent) => {
    const types = [...e.dataTransfer.types];
    if (!types.includes(DND_TYPE) && !types.includes("text/plain")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  return (
    <div
      className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-app-line-subtle bg-app-surface-2/50 p-1.5 text-xs sm:grid sm:grid-cols-[2rem_minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)_2.75rem] sm:items-start sm:gap-x-2 sm:gap-y-0 sm:p-2"
      onDragOver={acceptDrag}
      onDrop={(e) => {
        e.preventDefault();
        let dragged = e.dataTransfer.getData(DND_TYPE);
        if (!dragged) {
          const plain = e.dataTransfer.getData("text/plain");
          if (plain.startsWith("marketing-cart-line:")) dragged = plain.slice("marketing-cart-line:".length);
        }
        if (dragged && dragged !== lineId) onReorder(dragged, lineId);
      }}
    >
      <div className="flex min-w-0 gap-2 sm:contents">
        <div
          className="mt-0.5 flex shrink-0 cursor-grab touch-none flex-col justify-center self-start rounded border border-transparent px-0.5 py-1 text-app-muted hover:border-app-line-mid hover:bg-app-surface-2 active:cursor-grabbing sm:mt-1"
          draggable
          title={t("cps.dragReorder")}
          onDragStart={(e) => {
            e.dataTransfer.setData(DND_TYPE, lineId);
            e.dataTransfer.setData("text/plain", `marketing-cart-line:${lineId}`);
            e.dataTransfer.effectAllowed = "move";
          }}
          role="button"
          tabIndex={0}
          aria-label={t("cps.dragReorder")}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
          }}
        >
          <IconGrip />
        </div>
        <div className="min-w-0 flex-1 sm:min-w-0">
          <div className="truncate font-medium text-app-text">{title || "—"}</div>
          {note.trim() ? (
            <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-app-muted">{note.trim()}</div>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 space-y-1 sm:min-w-0">
        {specsConfigurable && onConfigureSpecs ? (
          <button
            type="button"
            onClick={onConfigureSpecs}
            className="w-full rounded-md border border-app-line-mid/90 bg-app-surface-2/50 px-2 py-1.5 text-left transition hover:border-app-line-strong hover:bg-app-surface-2/90"
          >
            <div className="line-clamp-3 text-[12px] leading-snug text-app-text">{specsSummary}</div>
            <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-wide text-app-tone">{t("cps.configure")}</span>
          </button>
        ) : (
          <div className="line-clamp-3 rounded-lg border border-transparent px-0.5 py-2 text-[13px] leading-snug text-app-subtle">
            {specsSummary}
          </div>
        )}
        {addonRows?.length ? (
          <div className="flex flex-col gap-1 pt-0.5">
            {addonRows.map((row) => {
              const aq = Math.max(0, Math.floor(row.quantity) || 0);
              return (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-app-line-subtle/90 bg-app-surface/40 px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium leading-snug text-app-text">{row.label || "—"}</div>
                    <div className="text-[10px] tabular-nums text-app-muted">+¥{row.unitPrice.toFixed(2)}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-app-line-mid bg-app-surface-2 text-[11px] text-app-text hover:bg-app-surface"
                      aria-label={`${row.label} −1`}
                      onClick={() => row.onQuantityChange(aq - 1)}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={aq}
                      onChange={(e) => row.onQuantityChange(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
                      className="h-6 w-9 rounded border border-app-line-mid bg-app-surface-2 px-0.5 text-center text-[11px] text-app-text tabular-nums"
                    />
                    <button
                      type="button"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-app-line-mid bg-app-surface-2 text-[11px] text-app-text hover:bg-app-surface"
                      aria-label={`${row.label} +1`}
                      onClick={() => row.onQuantityChange(aq + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 items-start justify-between gap-3 sm:contents">
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-3 gap-y-1 sm:min-w-0 sm:flex-nowrap sm:justify-end">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-app-muted">{t("cps.unitPrice")}</span>
            <span className="tabular-nums text-app-text">¥{unitPrice.toFixed(2)}</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-app-muted">{t("cps.qty")}</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-app-line-mid bg-app-surface-2 text-app-text hover:bg-app-surface"
                aria-label={`${t("cps.qty")} −1`}
                onClick={() => onQuantityChange(q - 1)}
              >
                −
              </button>
              <input
                type="number"
                min={1}
                step={1}
                value={q}
                onChange={(e) => onQuantityChange(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
                className="h-7 w-11 rounded border border-app-line-mid bg-app-surface-2 px-1 text-center text-xs text-app-text tabular-nums"
              />
              <button
                type="button"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-app-line-mid bg-app-surface-2 text-app-text hover:bg-app-surface"
                aria-label={`${t("cps.qty")} +1`}
                onClick={() => onQuantityChange(q + 1)}
              >
                +
              </button>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-app-muted">{t("cps.lineTotal")}</span>
            <span className="tabular-nums font-semibold text-app-text">¥{lineTotal.toFixed(2)}</span>
          </div>
        </div>
        <button type="button" className={`${TRASH_BTN} sm:justify-self-end`} onClick={onRemove} aria-label={t("cps.remove")} title={t("cps.remove")}>
          <IconTrash />
        </button>
      </div>
    </div>
  );
}
