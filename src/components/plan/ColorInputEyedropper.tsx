import { useCallback, useState } from "react";

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

function hasEyeDropper(): boolean {
  return typeof window !== "undefined" && "EyeDropper" in window;
}

type ColorInputEyedropperProps = {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  /** 吸色按钮文案 */
  pickLabel: string;
  /** i18n: browser unsupported */
  unsupportedHint: string;
  className?: string;
};

export function ColorInputEyedropper({
  label,
  value,
  onChange,
  pickLabel,
  unsupportedHint,
  className,
}: ColorInputEyedropperProps) {
  const [busy, setBusy] = useState(false);

  const pick = useCallback(async () => {
    if (!hasEyeDropper()) {
      window.alert(unsupportedHint);
      return;
    }
    setBusy(true);
    try {
      const Ctor = (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper;
      const ed = new Ctor();
      const r = await ed.open();
      if (r?.sRGBHex) onChange(r.sRGBHex);
    } catch {
      /* user cancelled */
    } finally {
      setBusy(false);
    }
  }, [onChange, unsupportedHint]);

  return (
    <label className={className ?? "flex flex-col gap-0.5"}>
      <span className="flex items-center justify-between gap-1">
        <span>{label}</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void pick()}
          className="shrink-0 rounded border border-app-line-mid px-1.5 py-0.5 text-[10px] font-medium text-app-tone hover:bg-app-surface-2 disabled:opacity-40"
          title={unsupportedHint}
        >
          {busy ? "…" : pickLabel}
        </button>
      </span>
      <div className="flex items-center gap-1">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 min-w-0 flex-1 cursor-pointer rounded border border-app-line-mid bg-app-surface-2"
        />
      </div>
    </label>
  );
}
