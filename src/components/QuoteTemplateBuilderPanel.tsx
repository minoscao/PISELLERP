import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useT } from "../i18n/useT";
import { useQuoteStore } from "../store/quoteStore";
import type {
  QuoteTemplateBlock,
  QuoteTemplateBlockKind,
  QuoteTemplateDocumentRole,
  QuoteTemplateTableColumn,
  SavedQuoteTemplate,
} from "../types";
import { QuoteTemplatePreview } from "./QuoteTemplatePreview";
import {
  createQuoteTemplateBlock,
  isQuoteTemplateBlockKind,
  normalizeSavedQuoteTemplate,
} from "../utils/quoteTemplateModel";

const KIND_LABEL_KEY: Record<QuoteTemplateBlockKind, string> = {
  "co.logo": "er.block.co.logo",
  "co.name": "er.block.co.name",
  "co.tagline": "er.block.co.tagline",
  "co.contact": "er.block.co.contact",
  "q.title": "er.block.q.title",
  "q.table": "er.block.q.table",
  "q.totals": "er.block.q.totals",
  "c.text": "er.block.c.text",
  "c.image": "er.block.c.image",
  "c.spacer": "er.block.c.spacer",
  "c.rule": "er.block.c.rule",
};

const TEXT_STYLE_KINDS = new Set<QuoteTemplateBlockKind>([
  "co.name",
  "co.tagline",
  "co.contact",
  "q.title",
  "q.table",
  "q.totals",
  "c.text",
]);

const ALL_TABLE_COLS: QuoteTemplateTableColumn[] = ["model", "qty", "price", "notes"];

const COL_LABEL: Record<QuoteTemplateTableColumn, string> = {
  model: "er.col.model",
  qty: "er.col.qty",
  price: "er.col.price",
  notes: "er.col.notes",
};

const DT_KIND = "application/x-quote-block-kind";
const DT_INDEX = "application/x-quote-block-index";

function cloneTemplate(t: SavedQuoteTemplate): SavedQuoteTemplate {
  try {
    return structuredClone(t);
  } catch {
    return JSON.parse(JSON.stringify(t)) as SavedQuoteTemplate;
  }
}

function moveBlock(blocks: QuoteTemplateBlock[], from: number, to: number): QuoteTemplateBlock[] {
  if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) return blocks;
  const next = [...blocks];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

function insertBlockAt(blocks: QuoteTemplateBlock[], index: number, block: QuoteTemplateBlock): QuoteTemplateBlock[] {
  const next = [...blocks];
  const i = Math.max(0, Math.min(index, next.length));
  next.splice(i, 0, block);
  return next;
}

function patchBlock(blocks: QuoteTemplateBlock[], id: string, patch: Partial<QuoteTemplateBlock>): QuoteTemplateBlock[] {
  return blocks.map((b) => {
    if (b.id !== id) return b;
    const next: QuoteTemplateBlock = { ...b, ...patch };
    if (patch.style !== undefined) {
      next.style = patch.style === undefined ? b.style : { ...b.style, ...patch.style };
    }
    return next;
  });
}

export type QuoteTemplateBuilderPanelProps = {
  /** 从模板库进入时锁定要编辑的模板 id */
  entryTemplateId?: string | null;
  onBackToGallery?: () => void;
};

function PaletteDraggable({
  kind,
  label,
  onDragStart,
}: {
  kind: QuoteTemplateBlockKind;
  label: string;
  onDragStart: (e: DragEvent, kind: QuoteTemplateBlockKind) => void;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => onDragStart(e, kind)}
      className="w-full cursor-grab rounded-md border border-app-line-mid bg-app-surface-2/60 px-2 py-1.5 text-left text-xs font-medium text-app-text hover:bg-app-surface-2 active:cursor-grabbing"
    >
      {label}
    </button>
  );
}

export function QuoteTemplateBuilderPanel(props?: QuoteTemplateBuilderPanelProps) {
  const { entryTemplateId = null, onBackToGallery } = props ?? {};
  const t = useT();
  const quoteTemplates = useQuoteStore((s) => s.quoteTemplates);
  const addQuoteTemplate = useQuoteStore((s) => s.addQuoteTemplate);
  const updateQuoteTemplate = useQuoteStore((s) => s.updateQuoteTemplate);
  const removeQuoteTemplate = useQuoteStore((s) => s.removeQuoteTemplate);
  const materials = useQuoteStore((s) => s.materials);

  const imageMaterials = useMemo(
    () => materials.filter((m) => typeof m.dataUrl === "string" && m.dataUrl.length > 0),
    [materials],
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SavedQuoteTemplate | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const loadedEntryRef = useRef<string | null>(null);

  useEffect(() => {
    if (!quoteTemplates.length) {
      setActiveId(null);
      setDraft(null);
      setSelectedBlockId(null);
      loadedEntryRef.current = null;
      return;
    }

    if (entryTemplateId) {
      if (loadedEntryRef.current !== entryTemplateId) {
        loadedEntryRef.current = entryTemplateId;
        const tpl = quoteTemplates.find((x) => x.id === entryTemplateId);
        if (tpl) {
          setActiveId(entryTemplateId);
          setDraft(cloneTemplate(tpl));
          setSelectedBlockId(null);
        }
      }
      return;
    }

    loadedEntryRef.current = null;
    if (activeId && quoteTemplates.some((x) => x.id === activeId)) return;
    const first = quoteTemplates[0];
    setActiveId(first.id);
    setDraft(cloneTemplate(first));
    setSelectedBlockId(null);
  }, [quoteTemplates, activeId, entryTemplateId]);

  const onPaletteDragStart = useCallback((e: DragEvent, kind: QuoteTemplateBlockKind) => {
    e.dataTransfer.setData(DT_KIND, kind);
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const commitDraft = useCallback(() => {
    if (!draft) return false;
    const normalized = normalizeSavedQuoteTemplate(draft);
    if (!normalized) return false;
    normalized.name = normalized.name.trim() || "New quote template";
    updateQuoteTemplate(normalized);
    return true;
  }, [draft, updateQuoteTemplate]);

  const handleSelectTemplate = useCallback(
    (id: string) => {
      const tpl = quoteTemplates.find((x) => x.id === id);
      setActiveId(id);
      setDraft(tpl ? cloneTemplate(tpl) : null);
      setSelectedBlockId(null);
    },
    [quoteTemplates],
  );

  const handleNew = useCallback(() => {
    const role: QuoteTemplateDocumentRole = draft?.documentRole === "invoice" || draft?.documentRole === "other"
      ? draft.documentRole
      : "quote";
    const id = addQuoteTemplate(undefined, role);
    const created = useQuoteStore.getState().quoteTemplates.find((x) => x.id === id);
    if (created) {
      setActiveId(id);
      setDraft(cloneTemplate(created));
      setSelectedBlockId(null);
    }
  }, [addQuoteTemplate, draft?.documentRole]);

  const handleSave = useCallback(() => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setSaveError("Template name is required");
      return;
    }
    try {
      const ok = commitDraft();
      if (!ok) {
        setSaveError("Unable to save template");
        return;
      }
      setSaveError(null);
      setLastSavedAt(Date.now());
    } catch {
      setSaveError("Save failed. Please try again.");
    }
  }, [draft, commitDraft]);

  const handleDeleteTemplate = useCallback(() => {
    if (!activeId) return;
    const wasEntry = entryTemplateId === activeId;
    removeQuoteTemplate(activeId);
    setSelectedBlockId(null);
    if (wasEntry && onBackToGallery) onBackToGallery();
  }, [activeId, entryTemplateId, onBackToGallery, removeQuoteTemplate]);

  const selectedBlock = draft?.blocks.find((b) => b.id === selectedBlockId) ?? null;

  const updateDraftBlocks = useCallback((blocks: QuoteTemplateBlock[]) => {
    setDraft((d) => (d ? { ...d, blocks } : null));
  }, []);

  const handleCanvasDrop = useCallback(
    (e: DragEvent, insertIndex: number | null) => {
      e.preventDefault();
      const kindRaw = e.dataTransfer.getData(DT_KIND);
      const fromRaw = e.dataTransfer.getData(DT_INDEX);
      if (!draft) return;

      if (isQuoteTemplateBlockKind(kindRaw)) {
        const nb = createQuoteTemplateBlock(kindRaw);
        const idx = insertIndex === null ? draft.blocks.length : insertIndex;
        updateDraftBlocks(insertBlockAt(draft.blocks, idx, nb));
        setSelectedBlockId(nb.id);
        return;
      }

      const from = parseInt(fromRaw, 10);
      if (!Number.isNaN(from) && from >= 0 && from < draft.blocks.length) {
        const to = insertIndex === null ? draft.blocks.length - 1 : Math.min(insertIndex, draft.blocks.length - 1);
        if (from !== to) updateDraftBlocks(moveBlock(draft.blocks, from, to));
      }
    },
    [draft, updateDraftBlocks],
  );

  const allowDrop = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(DT_KIND) ? "copy" : "move";
  };

  const setBlockPatch = useCallback(
    (id: string, patch: Partial<QuoteTemplateBlock>) => {
      if (!draft) return;
      updateDraftBlocks(patchBlock(draft.blocks, id, patch));
    },
    [draft, updateDraftBlocks],
  );

  const toggleColumn = useCallback(
    (id: string, col: QuoteTemplateTableColumn) => {
      if (!draft) return;
      const b = draft.blocks.find((x) => x.id === id);
      if (!b || b.kind !== "q.table") return;
      const cur = b.tableColumns?.length ? [...b.tableColumns] : [...ALL_TABLE_COLS];
      const has = cur.includes(col);
      const next = has ? cur.filter((c) => c !== col) : [...cur, col];
      const ordered = ALL_TABLE_COLS.filter((c) => next.includes(c));
      if (!ordered.length) return;
      setBlockPatch(id, { tableColumns: ordered });
    },
    [draft, setBlockPatch],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2 border-b border-app-line-subtle pb-3">
        {onBackToGallery ? (
          <button
            type="button"
            onClick={onBackToGallery}
            className="rounded-md border border-app-line-mid px-3 py-1.5 text-xs font-medium text-app-text hover:bg-app-surface-2"
          >
            {t("er.tplBackList")}
          </button>
        ) : null}
        <label className="flex min-w-[12rem] flex-col gap-0.5 text-[11px] font-medium text-app-text-muted">
          {t("er.templateSelect")}
          <select
            className="rounded-md border border-app-line-mid bg-app-surface px-2 py-1.5 text-sm text-app-text"
            value={activeId ?? ""}
            onChange={(e) => handleSelectTemplate(e.target.value)}
            disabled={!quoteTemplates.length}
          >
            {quoteTemplates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleNew}
          className="rounded-md border border-app-tone/40 bg-app-tone/10 px-3 py-1.5 text-xs font-semibold text-app-tone hover:bg-app-tone/15"
        >
          {t("er.templateNew")}
        </button>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-0.5 text-[11px] font-medium text-app-text-muted">
          {t("er.templateName")}
          <input
            type="text"
            className="rounded-md border border-app-line-mid bg-app-surface px-2 py-1.5 text-sm text-app-text"
            value={draft?.name ?? ""}
            disabled={!draft}
            onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : null))}
          />
        </label>
        <label className="flex min-w-[8.5rem] flex-col gap-0.5 text-[11px] font-medium text-app-text-muted">
          {t("er.tplDocType")}
          <select
            className="rounded-md border border-app-line-mid bg-app-surface px-2 py-1.5 text-sm text-app-text"
            disabled={!draft}
            value={draft?.documentRole ?? "quote"}
            onChange={(e) => {
              const v = e.target.value as QuoteTemplateDocumentRole;
              const role: QuoteTemplateDocumentRole =
                v === "invoice" || v === "other" ? v : "quote";
              setDraft((d) => (d ? { ...d, documentRole: role } : null));
            }}
          >
            <option value="quote">{t("er.tplRoleQuote")}</option>
            <option value="invoice">{t("er.tplRoleInvoice")}</option>
            <option value="other">{t("er.tplRoleOther")}</option>
          </select>
        </label>
        <button
          type="button"
          onClick={handleSave}
          disabled={!draft || !draft.name.trim()}
          className="rounded-md bg-app-tone px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          {t("er.templateSave")}
        </button>
        <button
          type="button"
          onClick={handleDeleteTemplate}
          disabled={!activeId}
          className="rounded-md border border-app-line-mid px-3 py-1.5 text-xs text-app-text-muted hover:bg-app-surface-2 disabled:opacity-40"
        >
          {t("er.templateDelete")}
        </button>
        {saveError ? (
          <span className="text-xs text-red-400">{saveError}</span>
        ) : lastSavedAt ? (
          <span className="text-xs text-app-text-muted">Saved {new Date(lastSavedAt).toLocaleTimeString()}</span>
        ) : null}
      </div>

      {!draft ? (
        <div className="rounded-lg border border-dashed border-app-line-mid bg-app-surface-2/40 p-8 text-center text-sm text-app-text-muted">
          {t("er.templateToolbar")}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleNew}
              className="rounded-md bg-app-tone px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
            >
              {t("er.templateNew")}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid min-h-[420px] flex-1 grid-cols-1 gap-3 lg:grid-cols-[11rem_minmax(0,1fr)_15rem_minmax(22rem,1.7fr)]">
          <div className="flex min-h-0 flex-col gap-2 rounded-lg border border-app-line-subtle bg-app-surface-2/30 p-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-app-text-muted">{t("er.paletteTitle")}</div>
            <div className="text-[10px] font-medium text-app-text-muted">{t("er.paletteCo")}</div>
            <div className="flex flex-col gap-1">
              {(["co.logo", "co.name", "co.tagline", "co.contact"] as const).map((kind) => (
                <PaletteDraggable key={kind} kind={kind} label={t(KIND_LABEL_KEY[kind])} onDragStart={onPaletteDragStart} />
              ))}
            </div>
            <div className="text-[10px] font-medium text-app-text-muted">{t("er.paletteQuote")}</div>
            <div className="flex flex-col gap-1">
              {(["q.title", "q.table", "q.totals"] as const).map((kind) => (
                <PaletteDraggable key={kind} kind={kind} label={t(KIND_LABEL_KEY[kind])} onDragStart={onPaletteDragStart} />
              ))}
            </div>
            <div className="text-[10px] font-medium text-app-text-muted">{t("er.paletteCustom")}</div>
            <div className="flex flex-col gap-1">
              {(["c.text", "c.image", "c.spacer", "c.rule"] as const).map((kind) => (
                <PaletteDraggable key={kind} kind={kind} label={t(KIND_LABEL_KEY[kind])} onDragStart={onPaletteDragStart} />
              ))}
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-col gap-2 rounded-lg border border-app-line-subtle bg-app-surface/40 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-app-text">{t("er.canvasTitle")}</span>
              <span className="text-[10px] text-app-text-muted">{t("er.canvasDropHint")}</span>
            </div>
            <div
              className="min-h-[200px] flex-1 space-y-1 overflow-y-auto rounded-md border border-dashed border-app-line-mid/80 bg-app-surface p-2"
              onDragOver={allowDrop}
              onDrop={(e) => handleCanvasDrop(e, null)}
            >
              {draft.blocks.map((b, ix) => {
                const active = b.id === selectedBlockId;
                return (
                  <div
                    key={b.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DT_INDEX, String(ix));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={allowDrop}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleCanvasDrop(e, ix);
                    }}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedBlockId(b.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedBlockId(b.id);
                      }
                    }}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                      active ? "border-app-tone bg-app-tone/10" : "border-app-line-mid bg-app-surface-2/50 hover:bg-app-surface-2"
                    }`}
                  >
                    <span className="shrink-0 text-app-text-muted opacity-60">⋮⋮</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{t(KIND_LABEL_KEY[b.kind])}</span>
                    <span className="flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        className="rounded border border-app-line-mid px-1 text-[10px] hover:bg-app-surface"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (ix <= 0) return;
                          updateDraftBlocks(moveBlock(draft.blocks, ix, ix - 1));
                        }}
                      >
                        {t("er.moveUp")}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-app-line-mid px-1 text-[10px] hover:bg-app-surface"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (ix >= draft.blocks.length - 1) return;
                          updateDraftBlocks(moveBlock(draft.blocks, ix, ix + 1));
                        }}
                      >
                        {t("er.moveDown")}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-app-line-mid px-1 text-[10px] text-red-600 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateDraftBlocks(draft.blocks.filter((x) => x.id !== b.id));
                          setSelectedBlockId((sid) => (sid === b.id ? null : sid));
                        }}
                      >
                        {t("er.removeBlock")}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2 rounded-lg border border-app-line-subtle bg-app-surface-2/30 p-2">
            <div className="text-[11px] font-semibold text-app-text">{t("er.inspectorTitle")}</div>
            {!selectedBlock ? (
              <p className="text-xs text-app-text-muted">{t("er.canvasDropHint")}</p>
            ) : (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto text-xs">
                <div className="text-app-text-muted">
                  {t(KIND_LABEL_KEY[selectedBlock.kind])} · <span className="font-mono text-[10px] opacity-70">{selectedBlock.id.slice(0, 8)}</span>
                </div>
                {TEXT_STYLE_KINDS.has(selectedBlock.kind) && (
                  <>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-app-text-muted">Color</span>
                      <input
                        type="color"
                        className="h-8 w-full cursor-pointer rounded border border-app-line-mid"
                        value={selectedBlock.style?.color?.startsWith("#") ? selectedBlock.style.color : "#334155"}
                        onChange={(e) => setBlockPatch(selectedBlock.id, { style: { ...selectedBlock.style, color: e.target.value } })}
                      />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-app-text-muted">Font size (px)</span>
                      <input
                        type="number"
                        min={8}
                        max={48}
                        className="rounded border border-app-line-mid px-2 py-1"
                        value={selectedBlock.style?.fontSizePx ?? 12}
                        onChange={(e) =>
                          setBlockPatch(selectedBlock.id, {
                            style: { ...selectedBlock.style, fontSizePx: Math.min(48, Math.max(8, Number(e.target.value) || 12)) },
                          })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-app-text-muted">Weight</span>
                      <select
                        className="rounded border border-app-line-mid px-2 py-1"
                        value={selectedBlock.style?.fontWeight ?? "400"}
                        onChange={(e) =>
                          setBlockPatch(selectedBlock.id, {
                            style: {
                              ...selectedBlock.style,
                              fontWeight: e.target.value as "400" | "600" | "700",
                            },
                          })
                        }
                      >
                        <option value="400">400</option>
                        <option value="600">600</option>
                        <option value="700">700</option>
                      </select>
                    </label>
                  </>
                )}
                {selectedBlock.kind !== "c.spacer" && selectedBlock.kind !== "c.rule" && (
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-app-text-muted">Align</span>
                    <select
                      className="rounded border border-app-line-mid px-2 py-1"
                      value={selectedBlock.style?.textAlign ?? "left"}
                      onChange={(e) =>
                        setBlockPatch(selectedBlock.id, {
                          style: {
                            ...selectedBlock.style,
                            textAlign: e.target.value as NonNullable<QuoteTemplateBlock["style"]>["textAlign"],
                          },
                        })
                      }
                    >
                      <option value="left">left</option>
                      <option value="center">center</option>
                      <option value="right">right</option>
                    </select>
                  </label>
                )}

                {selectedBlock.kind === "c.text" && (
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-app-text-muted">Text</span>
                    <textarea
                      rows={4}
                      className="rounded border border-app-line-mid px-2 py-1 font-sans"
                      value={selectedBlock.text ?? ""}
                      onChange={(e) => setBlockPatch(selectedBlock.id, { text: e.target.value })}
                    />
                  </label>
                )}

                {(selectedBlock.kind === "co.logo" || selectedBlock.kind === "c.image") && (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-app-text-muted">{t("er.imageWidthPct")}</span>
                      <input
                        type="range"
                        min={5}
                        max={100}
                        value={Math.round(
                          (selectedBlock.style?.imageWidthFrac ??
                            (selectedBlock.kind === "co.logo" ? 0.24 : 1)) * 100,
                        )}
                        onChange={(e) =>
                          setBlockPatch(selectedBlock.id, {
                            style: {
                              ...selectedBlock.style,
                              imageWidthFrac: Math.min(1, Math.max(0.05, Number(e.target.value) / 100)),
                            },
                          })
                        }
                      />
                      <span className="text-[10px] text-app-text-muted">
                        {Math.round(
                          (selectedBlock.style?.imageWidthFrac ??
                            (selectedBlock.kind === "co.logo" ? 0.24 : 1)) * 100,
                        )}
                        %
                      </span>
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-app-text-muted">{t("er.imageMaxHeightMm")}</span>
                      <input
                        type="number"
                        min={8}
                        max={250}
                        placeholder="—"
                        className="rounded border border-app-line-mid px-2 py-1"
                        value={
                          selectedBlock.style?.imageMaxHeightMm != null && selectedBlock.style.imageMaxHeightMm > 0
                            ? selectedBlock.style.imageMaxHeightMm
                            : ""
                        }
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          if (raw === "") {
                            setBlockPatch(selectedBlock.id, {
                              style: { ...selectedBlock.style, imageMaxHeightMm: undefined },
                            });
                            return;
                          }
                          const n = Number(raw);
                          if (!Number.isFinite(n)) return;
                          setBlockPatch(selectedBlock.id, {
                            style: {
                              ...selectedBlock.style,
                              imageMaxHeightMm: Math.min(250, Math.max(8, n)),
                            },
                          });
                        }}
                      />
                    </label>
                  </>
                )}

                {selectedBlock.kind === "c.image" && (
                  <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-app-text-muted">{t("er.imageUpload")}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="text-[11px]"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            const data = typeof reader.result === "string" ? reader.result : null;
                            setBlockPatch(selectedBlock.id, { imageDataUrl: data });
                          };
                          reader.readAsDataURL(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="rounded border border-app-line-mid px-2 py-1 text-[11px] hover:bg-app-surface"
                      onClick={() => setBlockPatch(selectedBlock.id, { imageDataUrl: null })}
                    >
                      {t("er.imageClearUpload")}
                    </button>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-app-text-muted">{t("er.pickMaterial")}</span>
                      <select
                        className="rounded border border-app-line-mid px-2 py-1"
                        value={selectedBlock.materialId ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBlockPatch(selectedBlock.id, { materialId: v === "" ? null : v });
                        }}
                      >
                        <option value="">{t("er.pickMaterial")}</option>
                        {imageMaterials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.fileName || m.id}
                          </option>
                        ))}
                      </select>
                      {!imageMaterials.length && <p className="text-[10px] text-app-text-muted">{t("er.noMaterialsImg")}</p>}
                    </label>
                  </div>
                )}

                {selectedBlock.kind === "c.spacer" && (
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-app-text-muted">{t("er.spacerHeightMm")}</span>
                    <input
                      type="number"
                      min={1}
                      max={80}
                      step={0.5}
                      className="rounded border border-app-line-mid px-2 py-1"
                      value={selectedBlock.spacerHeightMm ?? 8}
                      onChange={(e) =>
                        setBlockPatch(selectedBlock.id, {
                          spacerHeightMm: Math.min(80, Math.max(1, Number(e.target.value) || 8)),
                        })
                      }
                    />
                  </label>
                )}

                {selectedBlock.kind === "c.rule" && (
                  <>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-app-text-muted">{t("er.ruleThicknessMm")}</span>
                      <input
                        type="number"
                        min={0.05}
                        max={2}
                        step={0.05}
                        className="rounded border border-app-line-mid px-2 py-1"
                        value={selectedBlock.ruleThicknessMm ?? 0.25}
                        onChange={(e) =>
                          setBlockPatch(selectedBlock.id, {
                            ruleThicknessMm: Math.min(2, Math.max(0.05, Number(e.target.value) || 0.25)),
                          })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-app-text-muted">{t("er.ruleColor")}</span>
                      <input
                        type="color"
                        className="h-8 w-full cursor-pointer rounded border border-app-line-mid"
                        value={selectedBlock.ruleColor?.startsWith("#") ? selectedBlock.ruleColor : "#94a3b8"}
                        onChange={(e) => setBlockPatch(selectedBlock.id, { ruleColor: e.target.value })}
                      />
                    </label>
                  </>
                )}

                {selectedBlock.kind === "q.table" && (
                  <>
                    <div className="text-[11px] font-medium text-app-text-muted">Columns</div>
                    <div className="flex flex-col gap-1">
                      {ALL_TABLE_COLS.map((col) => {
                        const activeCols = selectedBlock.tableColumns?.length ? selectedBlock.tableColumns : ALL_TABLE_COLS;
                        return (
                          <label key={col} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={activeCols.includes(col)}
                              onChange={() => toggleColumn(selectedBlock.id, col)}
                            />
                            {t(COL_LABEL[col])}
                          </label>
                        );
                      })}
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedBlock.tableShowGst !== false}
                        onChange={(e) => setBlockPatch(selectedBlock.id, { tableShowGst: e.target.checked })}
                      />
                      {t("er.tableShowGst")}
                    </label>
                  </>
                )}

                {selectedBlock.kind === "q.totals" && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedBlock.tableShowGst !== false}
                      onChange={(e) => setBlockPatch(selectedBlock.id, { tableShowGst: e.target.checked })}
                    />
                    {t("er.tableShowGst")}
                  </label>
                )}
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-col gap-2 rounded-lg border border-app-line-subtle bg-app-surface-2/20 p-2">
            <div className="text-[11px] font-semibold text-app-text">{t("er.previewTitle")}</div>
            <div className="min-h-0 flex-1 overflow-auto">
              <QuoteTemplatePreview blocks={draft.blocks} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
