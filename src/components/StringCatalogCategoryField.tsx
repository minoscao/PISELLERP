import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../i18n/useT";

function mergedCategoryOptions(
  presets: readonly string[],
  catalogStrings: readonly string[],
  normalize: (raw: string) => string,
): string[] {
  const presetCanon: string[] = [];
  const presetKeys = new Set<string>();
  for (const p of presets) {
    const n = normalize(p);
    if (!n || presetKeys.has(n)) continue;
    presetKeys.add(n);
    presetCanon.push(n);
  }
  const extras = new Set<string>();
  for (const c of catalogStrings) {
    const n = normalize(c);
    if (n && !presetKeys.has(n)) extras.add(n);
  }
  const rest = [...extras].sort((a, b) => a.localeCompare(b));
  return [...presetCanon, ...rest];
}

export type StringCatalogCategoryFieldProps = {
  label: string;
  value: string;
  onChange: (canonical: string) => void;
  presets: readonly string[];
  /** Distinct category strings from the catalog (plus current draft if needed). */
  catalogStrings: readonly string[];
  normalize: (raw: string) => string;
  formatOption: (canonical: string) => string;
  hint?: string;
};

export function StringCatalogCategoryField({
  label,
  value,
  onChange,
  presets,
  catalogStrings,
  normalize,
  formatOption,
  hint,
}: StringCatalogCategoryFieldProps) {
  const t = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

  const canonicalValue = useMemo(() => normalize(value), [value, normalize]);
  const hasSelection = Boolean(canonicalValue);

  const allOptions = useMemo(
    () => mergedCategoryOptions(presets, catalogStrings, normalize),
    [presets, catalogStrings, normalize],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter((o) => {
      const disp = formatOption(o).toLowerCase();
      return o.toLowerCase().includes(q) || disp.includes(q);
    });
  }, [allOptions, query, formatOption]);

  const fmt = useCallback((o: string) => formatOption(o), [formatOption]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const applyPick = (opt: string) => {
    onChange(normalize(opt));
    setMenuOpen(false);
    setQuery("");
  };

  const openMenu = () => {
    setQuery("");
    setMenuOpen(true);
  };

  const tryCreate = () => {
    const raw = query.trim();
    if (!raw) return;
    onChange(normalize(raw));
    setMenuOpen(false);
    setQuery("");
  };

  const normalizedQuery = normalize(query.trim());
  const createMatchesNew =
    normalizedQuery.length > 0 &&
    !allOptions.some((o) => o.toLowerCase() === normalizedQuery.toLowerCase());

  return (
    <div ref={wrapRef} className="flex flex-col gap-1 text-xs text-app-muted">
      <span>{label}</span>
      {hasSelection ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-app-line-strong bg-app-surface-2/60 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm text-app-text">{fmt(canonicalValue)}</span>
          <button type="button" className="shrink-0 text-xs text-app-tone hover:underline" onClick={openMenu}>
            {t("cat.change")}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMenuOpen(true);
            }}
            onFocus={() => setMenuOpen(true)}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-app-line-strong bg-app-surface-2 px-3 py-2 text-sm text-app-text"
            placeholder={t("cps.searchPh")}
          />
          <button
            type="button"
            onClick={tryCreate}
            disabled={!query.trim()}
            className="shrink-0 rounded-lg border border-app-success-border bg-app-success-bg px-2.5 py-2 text-xs font-medium text-app-success-text hover:brightness-110 disabled:opacity-40"
          >
            {t("cat.create")}
          </button>
        </div>
      )}

      {menuOpen ? (
        <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-app-line-strong bg-app-surface py-1 shadow-inner">
          {hasSelection ? (
            <div className="border-b border-app-line-subtle px-2 py-1.5">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("cat.filterCategories")}
                className="w-full rounded border border-app-line-mid bg-app-surface-2 px-2 py-1.5 text-xs text-app-text"
              />
            </div>
          ) : null}
          {createMatchesNew ? (
            <button
              type="button"
              onClick={tryCreate}
              className="flex w-full px-3 py-2 text-left text-sm text-app-tone hover:bg-app-surface-2"
            >
              {t("cat.create")}: {normalizedQuery}
            </button>
          ) : null}
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-app-muted">{t("cps.noMatch")}</div>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => applyPick(opt)}
                className="flex w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-surface-2"
              >
                {fmt(opt)}
              </button>
            ))
          )}
        </div>
      ) : null}

      {hint ? <span className="text-[10px] text-app-subtle">{hint}</span> : null}
    </div>
  );
}
