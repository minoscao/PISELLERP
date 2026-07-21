import { useEffect, useState } from "react";
import { AppPrimaryNav } from "./components/AppPrimaryNav";
import { EnterpriseResourcePanel } from "./components/EnterpriseResourcePanel";
import { CustomPlanPanel } from "./components/CustomPlanPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { ErpPanel } from "./components/ErpPanel";
import { ThemeSync } from "./components/ThemeSync";
import { AuthGate } from "./components/AuthGate";
import { useT } from "./i18n/useT";
import { useQuoteStore } from "./store/quoteStore";

function usePersistHydrated() {
  const [ok, setOk] = useState(() => useQuoteStore.persist.hasHydrated());
  useEffect(() => {
    if (useQuoteStore.persist.hasHydrated()) setOk(true);
    return useQuoteStore.persist.onFinishHydration(() => {
      setOk(true);
    });
  }, []);
  return ok;
}

export default function App() {
  const t = useT();
  const hydrated = usePersistHydrated();
  const activeTab = useQuoteStore((s) => s.activeTab);

  if (!hydrated) {
    return (
      <div className="ui-app flex min-h-0 flex-1 flex-col items-center justify-center bg-app-surface text-sm text-app-muted">
        <ThemeSync />
        <span aria-busy="true">…</span>
      </div>
    );
  }

  return (
    <AuthGate>
    <div className="ui-app flex h-full min-h-0 flex-row">
      <ThemeSync />
      <AppPrimaryNav />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {activeTab !== "customPlan" ? (
          <header className="app-shell-header sticky top-0 z-20 shrink-0 border-b border-app-line-subtle px-4 py-2.5 sm:px-4">
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold tracking-tight text-app-text">{t("app.title")}</h1>
            </div>
          </header>
        ) : null}

        <main className="app-shell-main min-h-0 flex-1 overflow-hidden">
          {activeTab === "enterpriseResources" && <EnterpriseResourcePanel />}
          {activeTab === "customPlan" && <CustomPlanPanel />}
          {activeTab === "erp" && <ErpPanel />}
          {activeTab === "settings" && <SettingsPanel />}
        </main>
      </div>
    </div>
    </AuthGate>
  );
}
