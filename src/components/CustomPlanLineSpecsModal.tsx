import { useEffect } from "react";
import type { HardwareAddon, HardwareOption } from "../types";
import { useT } from "../i18n/useT";

export type CustomPlanLineSpecsModalProps = {
  open: boolean;
  title: string;
  options: HardwareOption[];
  selectedOptionId: string | null;
  onPickOption: (id: string) => void;
  addons: HardwareAddon[];
  addonQtyById: Record<string, number>;
  onAddonQtyChange: (addonId: string, qty: number) => void;
  onClose: () => void;
};

export function CustomPlanLineSpecsModal({
  open,
  title,
  options,
  selectedOptionId,
  onPickOption,
  addons,
  addonQtyById,
  onAddonQtyChange,
  onClose,
}: CustomPlanLineSpecsModalProps) {
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
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-2 sm:items-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cps-spec-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[min(85vh,28rem)] w-full max-w-md flex-col rounded-xl border border-app-line-strong bg-app-surface shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-app-line-subtle px-3 py-2">
          <h2 id="cps-spec-modal-title" className="text-sm font-semibold text-app-text">
            {t("cps.configure")} · {title || "—"}
          </h2>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-2">
          {options.length > 0 ? (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-app-muted">
                {t("cps.modalSpecs")}
              </div>
              <div className="flex flex-col gap-1">
                {options.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-app-line-mid/80 px-2 py-1.5 hover:bg-app-surface-2"
                  >
                    <input
                      type="radio"
                      className="h-3.5 w-3.5 shrink-0 accent-app-primary"
                      name="cps-line-spec-option"
                      checked={selectedOptionId === opt.id}
                      onChange={() => onPickOption(opt.id)}
                    />
                    <span className="min-w-0 flex-1 text-xs text-app-text">{opt.label || "—"}</span>
                    <span className="shrink-0 text-xs tabular-nums text-app-muted">¥{opt.optionPrice.toFixed(0)}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {addons.length > 0 ? (
            <div className={options.length ? "border-t border-app-line-subtle pt-2" : ""}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-app-muted">
                {t("cps.modalAddons")}
              </div>
              <div className="flex flex-col gap-1.5">
                {addons.map((ad) => {
                  const q = Math.max(0, Math.floor(addonQtyById[ad.id] ?? 0));
                  return (
                    <div
                      key={ad.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-app-line-subtle/80 px-2 py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-app-text">{ad.label}</div>
                        <div className="text-[10px] tabular-nums text-app-muted">+¥{ad.price.toFixed(0)}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-app-line-mid bg-app-surface-2 text-xs text-app-text hover:bg-app-surface"
                          aria-label={`${ad.label} −1`}
                          onClick={() => onAddonQtyChange(ad.id, q - 1)}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={q}
                          onChange={(e) =>
                            onAddonQtyChange(ad.id, Math.max(0, Math.floor(Number(e.target.value)) || 0))
                          }
                          className="h-7 w-10 rounded border border-app-line-mid bg-app-surface-2 px-0.5 text-center text-[11px] text-app-text tabular-nums"
                        />
                        <button
                          type="button"
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-app-line-mid bg-app-surface-2 text-xs text-app-text hover:bg-app-surface"
                          aria-label={`${ad.label} +1`}
                          onClick={() => onAddonQtyChange(ad.id, q + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
        <div className="border-t border-app-line-subtle px-3 py-2">
          <button
            type="button"
            className="w-full rounded-full border border-app-line-mid bg-app-surface-2 py-1.5 text-xs font-medium text-app-text hover:bg-app-surface"
            onClick={onClose}
          >
            {t("cps.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
