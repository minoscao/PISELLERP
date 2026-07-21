import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useT } from "../i18n/useT";

function clipboardFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  const out: File[] = [];
  const seen = new Set<string>();
  const push = (f: File) => {
    const k = `${f.name}:${f.size}:${f.type}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(f);
  };
  if (data.files?.length) {
    for (const f of Array.from(data.files)) {
      push(f);
    }
  }
  if (data.items?.length) {
    for (const item of Array.from(data.items)) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) push(f);
      }
    }
  }
  return out;
}

function isPreviewableImage(f: File): boolean {
  if (f.type && f.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(f.name);
}

function previewLabel(files: File[]): string {
  if (files.length === 0) return "";
  if (files.length === 1) return files[0]!.name;
  return `${files.length} files selected`;
}

function parseAcceptSpec(accept: string): { mimes: Set<string>; exts: Set<string> } {
  const mimes = new Set<string>();
  const exts = new Set<string>();
  for (const raw of accept.split(",")) {
    const token = raw.trim().toLowerCase();
    if (!token) continue;
    if (token.startsWith(".")) {
      exts.add(token);
      continue;
    }
    mimes.add(token);
  }
  return { mimes, exts };
}

function fileExtLower(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  if (i < 0) return "";
  return fileName.slice(i).toLowerCase();
}

function matchesAccept(file: File, accept: string): boolean {
  const spec = parseAcceptSpec(accept);
  if (spec.mimes.size === 0 && spec.exts.size === 0) return true;
  const mime = (file.type || "").toLowerCase();
  const ext = fileExtLower(file.name);
  if (ext && spec.exts.has(ext)) return true;
  if (mime && spec.mimes.has(mime)) return true;
  if (mime) {
    for (const m of spec.mimes) {
      if (m.endsWith("/*") && mime.startsWith(m.slice(0, -1))) return true;
    }
  }
  return false;
}

export type PhotoUploadModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  accept: string;
  multiple?: boolean;
  busy?: boolean;
  /** Show “Create with AI” (disabled until wired). */
  showAiOption?: boolean;
  /** When false, hide paste area (e.g. theme/logo still benefit from upload-only modal). */
  showPaste?: boolean;
  onConfirmFiles: (files: File[]) => void | Promise<void>;
};

export function PhotoUploadModal({
  open,
  onClose,
  title,
  description,
  accept,
  multiple = false,
  busy = false,
  showAiOption = true,
  showPaste = true,
  onConfirmFiles,
}: PhotoUploadModalProps) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const pasteRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const acceptedHint = accept
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .map((x) => {
      if (x === "image/jpeg" || x === ".jpg" || x === ".jpeg") return "JPG";
      if (x === "image/png" || x === ".png") return "PNG";
      if (x === "application/pdf" || x === ".pdf") return "PDF";
      return x.toUpperCase();
    })
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(" / ");

  const clearPicked = useCallback(() => {
    setPicked([]);
    setPreviewUrls((prev) => {
      prev.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      });
      return [];
    });
  }, []);

  useEffect(() => {
    if (open) return;
    setLocalErr(null);
    clearPicked();
  }, [open, clearPicked]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => pasteRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  const setFilesPending = useCallback((files: File[]) => {
    if (!files.length) return;
    const allowed = files.filter((f) => matchesAccept(f, accept));
    if (!allowed.length) {
      setLocalErr(acceptedHint ? `Only supports ${acceptedHint}` : t("photo.fail"));
      return;
    }
    setLocalErr(null);
    setPreviewUrls((prev) => {
      prev.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      });
      return allowed.map((f) => URL.createObjectURL(f));
    });
    setPicked(allowed);
  }, [accept, acceptedHint, t]);

  const runFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setLocalErr(null);
      try {
        await onConfirmFiles(files);
        onClose();
      } catch (e) {
        setLocalErr(e instanceof Error ? e.message : t("photo.fail"));
      }
    },
    [onConfirmFiles, onClose, t],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-app-overlay-scrim p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border border-app-line-strong bg-app-surface p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id={titleId} className="text-sm font-semibold text-app-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-app-line-mid px-2 py-1 text-xs text-app-muted hover:bg-app-surface-2"
          >
            {t("photo.cancel")}
          </button>
        </div>
        {description ? <p className="mt-2 text-xs text-app-muted">{description}</p> : null}
        {acceptedHint ? <p className="mt-1 text-[11px] text-app-subtle">Supports: {acceptedHint}</p> : null}

        <input
          ref={fileRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            const list = e.target.files;
            const files = list ? Array.from(list) : [];
            // Copy files first: clearing input can clear FileList in some browsers.
            if (fileRef.current) fileRef.current.value = "";
            if (!files.length) return;
            setFilesPending(files);
          }}
        />

        <div className="mt-4 flex flex-col gap-2">
          <div className="flex min-h-[3.25rem] items-stretch overflow-hidden rounded-xl border border-app-line-mid bg-app-surface-2/50">
            {picked.length === 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-app-text transition hover:bg-app-surface-2 disabled:opacity-50"
              >
                {t("photo.uploadComputer")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left transition hover:bg-app-surface-2/80 disabled:opacity-50"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-app-line-subtle bg-app-text/10">
                    {isPreviewableImage(picked[0]!) && previewUrls[0] ? (
                      <img
                        src={previewUrls[0]}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-app-muted">
                        PDF
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-app-text" title={previewLabel(picked)}>
                      {previewLabel(picked)}
                    </div>
                  </div>
                  <span className="shrink-0 pr-1 text-xs text-app-tone">{t("photo.changeFile")}</span>
                </button>
                <div className="w-px shrink-0 self-stretch bg-app-line-subtle" aria-hidden />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runFiles(picked)}
                  className="shrink-0 rounded-r-[11px] px-4 py-2 text-sm font-semibold text-app-on-primary bg-app-primary hover:bg-app-primary-hover disabled:opacity-50"
                >
                  {busy ? t("photo.importing") : t("photo.confirm")}
                </button>
              </>
            )}
          </div>

          {showPaste ? (
            <div className="rounded-lg border border-app-line-subtle bg-app-surface-2/40 p-2">
              <div className="text-xs font-medium text-app-muted">{t("photo.pasteTitle")}</div>
              <p className="mt-0.5 text-[11px] text-app-subtle">{t("photo.pasteHint")}</p>
              <div
                ref={pasteRef}
                tabIndex={0}
                onPaste={(e) => {
                  const files = clipboardFiles(e.clipboardData);
                  if (!files.length) {
                    e.preventDefault();
                    setLocalErr(t("photo.clipboardNoImage"));
                    return;
                  }
                  e.preventDefault();
                  setFilesPending(multiple ? files : files.slice(0, 1));
                }}
                className="mt-2 min-h-[3rem] rounded-md border border-dashed border-app-line-mid bg-app-panel-bg px-2 py-3 text-center text-xs text-app-muted outline-none ring-app-primary/40 focus:ring-2"
              >
                {t("photo.pasteZone")}
              </div>
            </div>
          ) : null}

          {showAiOption ? (
            <button
              type="button"
              disabled
              title={t("photo.aiSoon")}
              className="rounded-lg border border-app-line-subtle bg-app-surface-2/30 px-3 py-2 text-left text-sm text-app-muted opacity-60"
            >
              {t("photo.ai")}
              <span className="ml-2 text-[11px] font-normal">({t("photo.aiSoon")})</span>
            </button>
          ) : null}
        </div>

        {localErr ? (
          <p className="mt-3 text-xs text-app-danger-text" role="alert">
            {localErr}
          </p>
        ) : null}
        {busy && picked.length === 0 ? <p className="mt-2 text-xs text-app-muted">{t("photo.importing")}</p> : null}
      </div>
    </div>
  );
}
