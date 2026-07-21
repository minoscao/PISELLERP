import { useMemo, useState } from "react";
import { useQuoteStore } from "../store/quoteStore";
import { defaultCustomPlanName } from "../utils/customPlanSnapshot";

type Props = {
  onOpenPlan: (id: string) => void;
};

function formatTime(value: number | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

type SortMode = "updatedDesc" | "updatedAsc" | "nameAsc" | "pinsDesc";

export function CustomPlanListPanel({ onOpenPlan }: Props) {
  const uiLocale = useQuoteStore((s) => s.uiLocale);
  const savedCustomPlans = useQuoteStore((s) => s.savedCustomPlans);
  const createCustomPlan = useQuoteStore((s) => s.createCustomPlan);
  const setActiveTab = useQuoteStore((s) => s.setActiveTab);
  const setEnterpriseResourceMainTab = useQuoteStore((s) => s.setEnterpriseResourceMainTab);
  const setMaterialsLibraryTab = useQuoteStore((s) => s.setMaterialsLibraryTab);
  const [search, setSearch] = useState("");
  const [previewSize, setPreviewSize] = useState(300);
  const [sortMode, setSortMode] = useState<SortMode>("updatedDesc");

  const plans = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? savedCustomPlans.filter((p) => p.name.toLowerCase().includes(q))
      : savedCustomPlans;
    return [...filtered].sort((a, b) => {
      if (sortMode === "updatedAsc") return (a.updatedAt ?? 0) - (b.updatedAt ?? 0);
      if (sortMode === "nameAsc") return a.name.localeCompare(b.name);
      if (sortMode === "pinsDesc") return b.data.placements.length - a.data.placements.length;
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    });
  }, [savedCustomPlans, search, sortMode]);

  const onCreate = () => {
    const locale = uiLocale === "zh" ? "zh" : "en";
    const id = createCustomPlan(defaultCustomPlanName(savedCustomPlans, locale));
    onOpenPlan(id);
  };

  const openProductEditor = () => {
    setEnterpriseResourceMainTab("mediaLibrary");
    setMaterialsLibraryTab("product");
    setActiveTab("enterpriseResources");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-app-surface">
      <div className="shrink-0 border-b border-app-line-subtle px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-app-panel-border bg-app-panel-bg px-5 py-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-app-muted">Welcome</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-app-text">PISELL ERP</h2>
            <p className="mt-2 max-w-[520px] text-sm leading-6 text-app-muted">
              Open a saved plan, edit products, or continue stock work from one workspace.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openProductEditor}
              className="rounded-lg border border-app-line-strong px-3 py-2 text-sm font-medium text-app-text transition hover:bg-app-surface-2 active:scale-[0.98]"
            >
              Edit product
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("erp")}
              className="rounded-lg border border-app-line-mid px-3 py-2 text-sm text-app-muted transition hover:bg-app-surface-2 hover:text-app-text active:scale-[0.98]"
            >
              Stock
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className="rounded-lg border border-app-line-mid px-3 py-2 text-sm text-app-muted transition hover:bg-app-surface-2 hover:text-app-text active:scale-[0.98]"
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-app-text">Plans</h3>
            <p className="mt-1 text-xs text-app-muted">{savedCustomPlans.length} saved plans</p>
          </div>
          <button type="button" onClick={onCreate} className="ui-primaryBtn shrink-0 px-3 py-2 text-sm">
            New plan
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-app-panel-border bg-app-panel-bg px-3 py-3">
          <label className="min-w-[220px] flex-1 text-xs text-app-muted">
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plans"
              className="mt-1 w-full rounded-lg border border-app-line-mid bg-app-surface px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary"
            />
          </label>
          <label className="min-w-[180px] text-xs text-app-muted">
            Sort
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="mt-1 w-full rounded-lg border border-app-line-mid bg-app-surface px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary"
            >
              <option value="updatedDesc">Latest update</option>
              <option value="updatedAsc">Oldest update</option>
              <option value="nameAsc">Name A-Z</option>
              <option value="pinsDesc">Most pins</option>
            </select>
          </label>
          <label className="min-w-[220px] text-xs text-app-muted">
            Preview size
            <input
              type="range"
              min={220}
              max={440}
              step={20}
              value={previewSize}
              onChange={(e) => setPreviewSize(Number(e.target.value))}
              className="mt-3 w-full accent-app-primary"
            />
          </label>
        </div>

        {plans.length ? (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${previewSize}px, 1fr))` }}>
            {plans.map((plan) => {
              const data = plan.data;
              const floor = data.floorPlanDataUrl || "";
              const placementCount = data.placements.length;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => onOpenPlan(plan.id)}
                  className="group flex min-h-[220px] flex-col overflow-hidden rounded-lg border border-app-panel-border bg-app-panel-bg text-left transition hover:-translate-y-0.5 hover:border-app-primary/70 hover:shadow-lg active:translate-y-0"
                >
                  <div className="relative overflow-hidden border-b border-app-line-subtle bg-app-surface-2" style={{ height: Math.round(previewSize * 0.42) }}>
                    {floor ? (
                      <img
                        src={floor}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-app-subtle">No map</div>
                    )}
                    <span className="absolute bottom-2 left-2 rounded bg-app-panel-bg/90 px-2 py-1 text-[11px] font-medium text-app-text shadow">
                      {placementCount} pins
                    </span>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
                    <div className="truncate text-sm font-semibold text-app-text">{plan.name}</div>
                    <div className="text-xs text-app-muted">{formatTime(plan.updatedAt)}</div>
                    <div className="mt-auto text-xs font-medium text-app-primary">Open</div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-app-line-mid bg-app-panel-bg text-center">
            <div className="text-sm font-semibold text-app-text">No plans yet</div>
            <button type="button" onClick={onCreate} className="ui-primaryBtn mt-3 px-3 py-2 text-sm">
              New plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
