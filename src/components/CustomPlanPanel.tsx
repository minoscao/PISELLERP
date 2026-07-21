import { useEffect, useState } from "react";
import { useT } from "../i18n/useT";
import { useQuoteStore } from "../store/quoteStore";
import type { CustomPlanTab } from "../types";
import { snapshotToWorkspacePatch } from "../utils/customPlanSnapshot";
import { CustomPlanListPanel } from "./CustomPlanListPanel";
import { HardwareLayoutPanel } from "./HardwareLayoutPanel";
import { QuotePanel } from "./QuotePanel";
import { UiPageShell } from "./UiPageShell";

const MAIN: { id: CustomPlanTab; labelKey: string }[] = [
  { id: "select", labelKey: "cp.select" },
  { id: "quote", labelKey: "cp.quote" },
];
type CatalogMode = "hardware" | "software" | "services";

export function CustomPlanPanel() {
  const t = useT();
  const [mode, setMode] = useState<"list" | "editor">("list");
  const tab = useQuoteStore((s) => s.customPlanTab);
  const setTab = useQuoteStore((s) => s.setCustomPlanTab);
  const activeCustomPlanId = useQuoteStore((s) => s.activeCustomPlanId);
  const savedCustomPlans = useQuoteStore((s) => s.savedCustomPlans);
  const saveCustomPlan = useQuoteStore((s) => s.saveCustomPlan);
  const loadCustomPlan = useQuoteStore((s) => s.loadCustomPlan);
  const renameCustomPlan = useQuoteStore((s) => s.renameCustomPlan);
  const activePlan = savedCustomPlans.find((p) => p.id === activeCustomPlanId) ?? null;
  const [nameDraft, setNameDraft] = useState(activePlan?.name ?? "");
  const [catalogMode, setCatalogMode] = useState<CatalogMode>("hardware");

  useEffect(() => {
    setNameDraft(activePlan?.name ?? "");
  }, [activePlan?.id, activePlan?.name]);

  const openPlan = (id: string) => {
    loadCustomPlan(id);
    setTab("select");
    setMode("editor");
  };

  const savePlan = () => {
    const trimmed = nameDraft.trim();
    if (activeCustomPlanId && trimmed && trimmed !== activePlan?.name) {
      renameCustomPlan(activeCustomPlanId, trimmed);
    }
    saveCustomPlan(trimmed || undefined);
  };

  const saveAndReturn = () => {
    savePlan();
    setMode("list");
  };

  const resetPlan = () => {
    if (!activePlan) return;
    useQuoteStore.setState({
      ...snapshotToWorkspacePatch(activePlan.data),
      activeCustomPlanId: activePlan.id,
    });
    if (typeof document !== "undefined") {
      document.documentElement.dataset.mapTheme = activePlan.data.mapTheme;
    }
    setNameDraft(activePlan.name);
  };

  if (mode === "list") {
    return <CustomPlanListPanel onOpenPlan={openPlan} />;
  }

  const planToolbar = (
    <div className="ui-planHeaderControls">
      <div className="ui-planSecondaryActions">
        <button type="button" onClick={saveAndReturn} className="ui-planGhostBtn">
          Plans
        </button>
        <input
          type="text"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          className="ui-planNameInput"
          aria-label={t("cp.schemeName")}
        />
        <button type="button" onClick={savePlan} className="ui-primaryBtn px-4 py-2 text-sm">
          {t("cp.schemeSave")}
        </button>
        <button
          type="button"
          onClick={resetPlan}
          disabled={!activeCustomPlanId}
          className="ui-planGhostBtn"
        >
          Reset
        </button>
      </div>

      <nav className="ui-planPrimarySwitch" role="group" aria-label={t("cp.workflowNav")}>
        {MAIN.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setTab(row.id)}
            className={`ui-planPrimarySwitchBtn${tab === row.id ? " ui-planPrimarySwitchBtn--on" : ""}`}
          >
            {t(row.labelKey)}
          </button>
        ))}
      </nav>
    </div>
  );

  return (
    <UiPageShell
      fillStage
      compact
      hideHead
      beforeStage={<div className="ui-customPlan-toolbar">{planToolbar}</div>}
    >
      {tab === "select" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">
            <HardwareLayoutPanel
              catalogMode={catalogMode}
              onCatalogModeChange={setCatalogMode}
            />
          </div>
        </div>
      ) : null}

      {tab === "quote" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <QuotePanel />
        </div>
      ) : null}
    </UiPageShell>
  );
}
