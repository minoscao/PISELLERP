import { useCallback, useEffect, useMemo, useState } from "react";
import { useT } from "../i18n/useT";
import { useQuoteStore } from "../store/quoteStore";
import type { QuoteTemplateDocumentRole, SavedQuoteTemplate } from "../types";
import { defaultQuoteTemplateBlocks } from "../utils/quoteTemplateModel";
import { QuoteTemplatePreview } from "./QuoteTemplatePreview";

function roleOf(t: SavedQuoteTemplate): QuoteTemplateDocumentRole {
  const r = t.documentRole;
  return r === "invoice" || r === "other" ? r : "quote";
}

const ROLE_ORDER: QuoteTemplateDocumentRole[] = ["quote", "invoice", "other"];

const ROLE_LABEL: Record<QuoteTemplateDocumentRole, string> = {
  quote: "er.tplRoleQuote",
  invoice: "er.tplRoleInvoice",
  other: "er.tplRoleOther",
};

type Props = { onEnterEditor: (templateId: string) => void };

export function QuoteTemplateGalleryPanel({ onEnterEditor }: Props) {
  const t = useT();
  const quoteTemplates = useQuoteStore((s) => s.quoteTemplates);
  const addQuoteTemplate = useQuoteStore((s) => s.addQuoteTemplate);

  const sorted = useMemo(
    () => [...quoteTemplates].sort((a, b) => b.updatedAt - a.updatedAt),
    [quoteTemplates],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<QuoteTemplateDocumentRole>("quote");

  useEffect(() => {
    if (!sorted.length) {
      setSelectedId(null);
      return;
    }
    if (selectedId && sorted.some((x) => x.id === selectedId)) return;
    setSelectedId(sorted[0]!.id);
  }, [sorted, selectedId]);

  const selected = sorted.find((x) => x.id === selectedId) ?? null;
  const starterPreviewBlocks = useMemo(() => defaultQuoteTemplateBlocks(), []);

  const byRole = useCallback(
    (role: QuoteTemplateDocumentRole) => sorted.filter((x) => roleOf(x) === role),
    [sorted],
  );

  const handleCreate = () => {
    const id = addQuoteTemplate(newName.trim() || undefined, newRole);
    setAddOpen(false);
    setNewName("");
    setNewRole("quote");
    onEnterEditor(id);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-4">
      <aside className="flex max-h-[70vh] min-h-[280px] flex-col rounded-xl border border-app-line-subtle bg-app-surface-2/30 lg:max-h-none lg:min-h-0 lg:w-[min(100%,20rem)] lg:shrink-0">
        <div className="flex items-center justify-between gap-2 border-b border-app-line-subtle px-3 py-2">
          <span className="text-xs font-semibold text-app-text">{t("er.tplGalleryTitle")}</span>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="shrink-0 rounded-md bg-app-tone px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90"
          >
            {t("er.tplAddTemplate")}
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-2">
          {ROLE_ORDER.map((role) => {
            const list = byRole(role);
            return (
              <div key={role}>
                <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-app-text-muted">
                  {t(ROLE_LABEL[role])}
                </div>
                {list.length ? (
                  <ul className="space-y-1">
                    {list.map((tpl) => {
                      const active = tpl.id === selectedId;
                      return (
                        <li key={tpl.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(tpl.id)}
                            className={`w-full rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                              active
                                ? "border-app-tone bg-app-tone/15 text-app-text"
                                : "border-app-line-mid bg-app-surface/50 text-app-text hover:bg-app-surface-2"
                            }`}
                          >
                            <div className="truncate font-medium">{tpl.name}</div>
                            <div className="mt-0.5 text-[10px] text-app-text-muted">
                              {new Date(tpl.updatedAt).toLocaleString()}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const id = addQuoteTemplate(undefined, role);
                      onEnterEditor(id);
                    }}
                    className="w-full rounded-lg border border-dashed border-app-line-mid bg-app-surface/40 px-2.5 py-2 text-left text-[11px] text-app-text-muted hover:bg-app-surface-2"
                  >
                    + {t("er.tplCreateUnderType")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 rounded-xl border border-app-line-subtle bg-app-panel-bg/40 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-app-text">{t("er.previewTitle")}</h3>
            <p className="mt-0.5 text-[11px] text-app-text-muted">{t("er.tplGalleryHint")}</p>
          </div>
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onEnterEditor(selected.id)}
            className="rounded-md bg-app-tone px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {t("er.tplOpenEditor")}
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto">
          {selected ? (
            <QuoteTemplatePreview blocks={selected.blocks} />
          ) : (
            <div className="w-full space-y-3">
              <p className="text-center text-sm text-app-text-muted">{t("er.tplGalleryEmpty")}</p>
              <QuoteTemplatePreview blocks={starterPreviewBlocks} />
            </div>
          )}
        </div>
      </main>

      {addOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={() => setAddOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-app-line-mid bg-app-surface p-4 shadow-xl"
            role="dialog"
            aria-modal
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-semibold text-app-text">{t("er.tplAddModalTitle")}</h4>
            <label className="mt-3 flex flex-col gap-1 text-[11px] font-medium text-app-text-muted">
              {t("er.templateName")}
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="rounded-md border border-app-line-mid px-2 py-1.5 text-sm"
                placeholder={t("er.templateName")}
              />
            </label>
            <label className="mt-2 flex flex-col gap-1 text-[11px] font-medium text-app-text-muted">
              {t("er.tplDocType")}
              <select
                className="rounded-md border border-app-line-mid px-2 py-1.5 text-sm"
                value={newRole}
                onChange={(e) => setNewRole((e.target.value as QuoteTemplateDocumentRole) || "quote")}
              >
                <option value="quote">{t("er.tplRoleQuote")}</option>
                <option value="invoice">{t("er.tplRoleInvoice")}</option>
                <option value="other">{t("er.tplRoleOther")}</option>
              </select>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-md border border-app-line-mid px-3 py-1.5 text-xs text-app-text-muted hover:bg-app-surface-2"
              >
                {t("er.tplAddCancel")}
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="rounded-md bg-app-tone px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                {t("er.tplAddConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
