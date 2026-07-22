import type { ComponentType, DragEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useT } from "../i18n/useT";
import { useQuoteStore } from "../store/quoteStore";
import type { QuoteTab } from "../types";

const NAV_COLLAPSED_LS = "marketing-primary-nav-collapsed";
const NAV_ORDER_LS = "marketing-primary-nav-order";

type PrimaryNavId = Extract<QuoteTab, "crm" | "erp" | "enterpriseResources" | "customPlan">;

const DEFAULT_PRIMARY_ORDER: PrimaryNavId[] = ["customPlan", "crm", "enterpriseResources", "erp"];

type NavIcon = ComponentType<{ className?: string }>;

type NavDef = {
  id: QuoteTab;
  titleKey: string;
  subKey: string;
  Icon: NavIcon;
};

/** 媒体库：画框 + 图 + 高光点（非「房屋」） */
function IconMediaLibrary({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.25" y="5" width="17.5" height="14" rx="2" />
      <path d="M7.5 16.5 10.5 12l2.8 2.8L17 10" />
      <circle cx="9" cy="9.5" r="1.35" strokeWidth="1.4" />
    </svg>
  );
}

/** 定制方案：规划板 / 蓝图草图（外框 + 标题条 + 虚线草图区 + 构造斜线） */
function IconCustomPlan({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="4" width="17" height="16" rx="1.75" />
      <path d="M3.5 7.75h17" />
      <rect x="6.25" y="9.75" width="11.5" height="8.75" rx="0.65" strokeDasharray="2.15 2.35" />
      <path d="M7.25 18.25 17.75 10.25" strokeDasharray="3 2.25" />
      <path d="M8 12h2.75M13.25 12H16" opacity="0.92" />
      <path d="M12 14.25v3.25" opacity="0.92" />
    </svg>
  );
}

/** ERP：货架 / 分栏库存感 */
function IconErp({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="5" width="7.5" height="15" rx="1" />
      <rect x="13" y="8" width="7.5" height="12" rx="1" />
      <path d="M5.5 9.5h3.5M5.5 12.5h3.5M5.5 15.5h3" />
      <path d="M15 11h4M15 14h4M15 17h3" />
    </svg>
  );
}

function IconCrm({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M6.4 16c.7-1.5 1.65-2.25 2.85-2.25S11.4 14.5 12.1 16" />
      <path d="M14 9h3.5M14 12h4M14 15h3" />
    </svg>
  );
}

/** 设置：六齿齿轮 + 中心毂（非放射状「太阳」） */
function IconSettings({ className }: { className?: string }) {
  const teeth = [0, 60, 120, 180, 240, 300] as const;
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden>
      <circle cx="12" cy="12" r="3.35" />
      {teeth.map((deg) => (
        <rect
          key={deg}
          x="10.85"
          y="0.9"
          width="2.3"
          height="7.85"
          rx="0.55"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </svg>
  );
}

function IconRailExpand({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 6l6 6-6 6M11 6l6 6-6 6" />
    </svg>
  );
}

function IconRailCollapse({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6l-6 6 6 6M13 6l-6 6 6 6" />
    </svg>
  );
}

const NAV_DEFS: Record<PrimaryNavId, NavDef> = {
  crm: { id: "crm", titleKey: "nav.item.crm.title", subKey: "nav.item.crm.sub", Icon: IconCrm },
  erp: { id: "erp", titleKey: "nav.item.erp.title", subKey: "nav.item.erp.sub", Icon: IconErp },
  enterpriseResources: {
    id: "enterpriseResources",
    titleKey: "nav.item.media.title",
    subKey: "nav.item.media.sub",
    Icon: IconMediaLibrary,
  },
  customPlan: {
    id: "customPlan",
    titleKey: "nav.item.customPlan.title",
    subKey: "nav.item.customPlan.sub",
    Icon: IconCustomPlan,
  },
};

const SETTINGS_ITEM: NavDef = {
  id: "settings",
  titleKey: "nav.item.settings.title",
  subKey: "nav.item.settings.sub",
  Icon: IconSettings,
};

function normalizePrimaryOrder(raw: unknown): PrimaryNavId[] | null {
  if (!Array.isArray(raw) || raw.length !== DEFAULT_PRIMARY_ORDER.length) return null;
  const allowed = new Set<PrimaryNavId>(DEFAULT_PRIMARY_ORDER);
  const seen = new Set<PrimaryNavId>();
  const out: PrimaryNavId[] = [];
  for (const x of raw) {
    if (typeof x !== "string" || !allowed.has(x as PrimaryNavId)) return null;
    const id = x as PrimaryNavId;
    if (seen.has(id)) return null;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function readPrimaryOrderFromLs(): PrimaryNavId[] {
  if (typeof window === "undefined") return [...DEFAULT_PRIMARY_ORDER];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(NAV_ORDER_LS) || "null") as unknown;
    const norm = normalizePrimaryOrder(parsed);
    return norm ?? [...DEFAULT_PRIMARY_ORDER];
  } catch {
    return [...DEFAULT_PRIMARY_ORDER];
  }
}

function reorderPrimary(order: PrimaryNavId[], from: PrimaryNavId, to: PrimaryNavId): PrimaryNavId[] {
  if (from === to) return order;
  const next = order.filter((x) => x !== from);
  const ti = next.indexOf(to);
  if (ti < 0) return order;
  return [...next.slice(0, ti), from, ...next.slice(ti)];
}

export function AppPrimaryNav() {
  const t = useT();
  const activeTab = useQuoteStore((s) => s.activeTab);
  const setActiveTab = useQuoteStore((s) => s.setActiveTab);

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(NAV_COLLAPSED_LS) === "1";
  });

  const [primaryOrder, setPrimaryOrder] = useState<PrimaryNavId[]>(() => readPrimaryOrderFromLs());
  const [dragSourceId, setDragSourceId] = useState<PrimaryNavId | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(NAV_COLLAPSED_LS, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    try {
      window.localStorage.setItem(NAV_ORDER_LS, JSON.stringify(primaryOrder));
    } catch {
      /* ignore */
    }
  }, [primaryOrder]);

  const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), []);

  const onPrimaryDragStart = useCallback((id: PrimaryNavId) => (e: DragEvent) => {
    setDragSourceId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const onPrimaryDragEnd = useCallback(() => setDragSourceId(null), []);

  const onPrimaryDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onPrimaryDrop = useCallback(
    (targetId: PrimaryNavId) => (e: DragEvent) => {
      e.preventDefault();
      const from = e.dataTransfer.getData("text/plain") as PrimaryNavId;
      if (!(DEFAULT_PRIMARY_ORDER as readonly string[]).includes(from) || from === targetId) return;
      setPrimaryOrder((prev) => reorderPrimary(prev, from, targetId));
      setDragSourceId(null);
    },
    [],
  );

  const renderSettingsItem = () => {
    const item = SETTINGS_ITEM;
    const active = activeTab === item.id;
    const Icon = item.Icon;
    const label = t(item.titleKey);
    const sub = t(item.subKey);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => setActiveTab(item.id)}
        title={collapsed ? `${label}${sub ? ` — ${sub}` : ""}` : undefined}
        aria-current={active ? "page" : undefined}
        className={`group flex w-full items-center gap-2.5 rounded-xl border text-left transition duration-150 ${
          collapsed ? "justify-center px-0 py-2.5" : "px-2.5 py-2.5"
        } ${
          active
            ? "border-app-primary/70 bg-[color-mix(in_srgb,var(--app-primary-soft)_88%,transparent)] text-app-text shadow-[inset_0_0_0_1px_rgb(var(--app-primary-rgb)/0.28)]"
            : "border-app-line-subtle/50 bg-[rgb(var(--app-surface-2-rgb)/0.22)] text-app-muted hover:border-app-line-mid hover:bg-[rgb(var(--app-surface-2-rgb)/0.5)] hover:text-app-text"
        }`}
      >
        <span
          className={`flex shrink-0 items-center justify-center rounded-lg border ${
            collapsed ? "h-10 w-10" : "h-10 w-10"
          } ${
            active
              ? "border-app-primary/55 bg-[color-mix(in_srgb,var(--app-primary-soft)_70%,transparent)] text-app-primary"
              : "border-app-line-subtle/80 bg-[rgb(var(--app-surface-2-rgb)/0.35)] text-app-text group-hover:border-app-line-mid group-hover:bg-[rgb(var(--app-surface-2-rgb)/0.55)]"
          }`}
        >
          <Icon className="h-[22px] w-[22px]" />
        </span>
        {!collapsed ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold leading-tight text-app-text">{label}</span>
            <span className="mt-0.5 block text-xs leading-snug text-app-muted line-clamp-2">{sub}</span>
          </span>
        ) : null}
      </button>
    );
  };

  const renderPrimaryRow = (navId: PrimaryNavId) => {
    const item = NAV_DEFS[navId];
    const active = activeTab === item.id;
    const Icon = item.Icon;
    const label = t(item.titleKey);
    const sub = t(item.subKey);
    const dragging = dragSourceId === navId;

    const shellBase =
      "overflow-hidden rounded-xl border transition-[border-color,background-color,box-shadow,opacity] duration-150 ease-out";
    const shellActive =
      "border-app-primary/70 bg-[color-mix(in_srgb,var(--app-primary-soft)_88%,transparent)] shadow-[inset_0_0_0_1px_rgb(var(--app-primary-rgb)/0.28)]";
    const shellIdle =
      "border-app-line-subtle/55 bg-[rgb(var(--app-surface-2-rgb)/0.2)] hover:border-app-line-mid hover:bg-[rgb(var(--app-surface-2-rgb)/0.52)] hover:shadow-sm";
    const shellDragging = dragging ? "opacity-55 ring-1 ring-app-primary/35" : "";

    return (
      <button
        key={navId}
        type="button"
        draggable
        onDragStart={onPrimaryDragStart(navId)}
        onDragEnd={onPrimaryDragEnd}
        onDragOver={onPrimaryDragOver}
        onDrop={onPrimaryDrop(navId)}
        onClick={() => setActiveTab(item.id)}
        title={collapsed ? `${label}${sub ? ` — ${sub}` : ""}` : `${label} — ${t("nav.reorderHint")}`}
        aria-current={active ? "page" : undefined}
        className={`${shellBase} ${active ? shellActive : shellIdle} ${shellDragging} group cursor-grab text-left active:cursor-grabbing ${
          collapsed ? "flex flex-col items-center gap-1 px-0 py-2" : "flex flex-row items-center gap-2.5 px-2 py-2.5"
        }`}
      >
        <span
          className={`flex shrink-0 items-center justify-center rounded-lg border ${
            collapsed ? "h-10 w-10" : "h-10 w-10"
          } ${
            active
              ? "border-app-primary/55 bg-[color-mix(in_srgb,var(--app-primary-soft)_72%,transparent)] text-app-primary"
              : "border-app-line-subtle/80 bg-[rgb(var(--app-surface-2-rgb)/0.32)] text-app-text group-hover:border-app-line-mid group-hover:bg-[rgb(var(--app-surface-2-rgb)/0.58)]"
          }`}
        >
          <Icon className="h-[22px] w-[22px]" />
        </span>
        {!collapsed ? (
          <span className="min-w-0 flex-1 py-0.5">
            <span className="block truncate text-sm font-semibold leading-tight text-app-text">{label}</span>
            <span className="mt-0.5 block text-xs leading-snug text-app-muted line-clamp-2">{sub}</span>
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <aside
      className={`app-primary-nav flex shrink-0 flex-col border-r border-app-line-subtle transition-[width] duration-200 ease-out ${
        collapsed ? "w-[4.5rem]" : "w-[15.25rem]"
      }`}
      aria-label={t("nav.rail.aria")}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-2 pb-2 pt-3">
        {!collapsed ? (
          <p className="px-1 text-[10px] font-medium uppercase tracking-wide text-app-muted/75">{t("nav.primaryGroup")}</p>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain">
          {primaryOrder.map(renderPrimaryRow)}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-1 border-t border-app-line-subtle px-2 py-2">
        {!collapsed ? (
          <p className="px-1 text-[10px] font-medium uppercase tracking-wide text-app-muted/75">{t("nav.bottomGroup")}</p>
        ) : null}
        {renderSettingsItem()}
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? t("nav.rail.expand") : undefined}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-app-line-subtle/40 bg-[rgb(var(--app-surface-2-rgb)/0.18)] py-2 text-app-muted transition hover:border-app-line-mid hover:bg-[rgb(var(--app-surface-2-rgb)/0.45)] hover:text-app-text"
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("nav.rail.expand") : t("nav.rail.collapse")}
        >
          {collapsed ? (
            <IconRailExpand className="h-5 w-5" />
          ) : (
            <>
              <IconRailCollapse className="h-5 w-5 shrink-0" />
              <span className="min-w-0 truncate text-xs font-medium">{t("nav.rail.collapse")}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
