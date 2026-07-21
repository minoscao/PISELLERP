import { useEffect } from "react";
import { useT } from "../i18n/useT";
import { useQuoteStore } from "../store/quoteStore";
import { MaterialsPanel } from "./MaterialsPanel";
import { QuoteTemplateBuilderShell } from "./QuoteTemplateBuilderShell";
import { UiPageShell } from "./UiPageShell";

export function EnterpriseResourcePanel() {
  const t = useT();
  const activeTab = useQuoteStore((s) => s.activeTab);
  const sub = useQuoteStore((s) => s.resourceLibrarySubTab);
  const setSub = useQuoteStore((s) => s.setResourceLibrarySubTab);
  const openErp = useQuoteStore((s) => s.openErpInventoryCatalog);
  const enterpriseResourceMainTab = useQuoteStore((s) => s.enterpriseResourceMainTab);
  const setEnterpriseResourceMainTab = useQuoteStore((s) => s.setEnterpriseResourceMainTab);

  /** Tab 1 仅保留素材库：旧状态若停在硬件/软件/服务，自动回到市场资料 */
  useEffect(() => {
    if (activeTab !== "enterpriseResources") return;
    if (sub === "hardware" || sub === "software" || sub === "services") {
      setSub("brandMaterials");
    }
  }, [activeTab, sub, setSub]);

  return (
    <UiPageShell
      fillStage
      kicker={t("er.shellKicker")}
      title={t("tab.enterprise")}
      headActions={
        <>
          <span className="ui-iconBtn" aria-hidden>
            ‹
          </span>
          <span className="ui-iconBtn" aria-hidden>
            ★
          </span>
          <span className="ui-iconBtn" aria-hidden>
            ···
          </span>
        </>
      }
      beforeStage={
        <div className="flex flex-col gap-2 border-b border-app-line-subtle pb-2">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setEnterpriseResourceMainTab("mediaLibrary")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                enterpriseResourceMainTab === "mediaLibrary"
                  ? "bg-app-tone text-white"
                  : "border border-app-line-mid bg-app-surface-2/80 text-app-text hover:bg-app-surface-2"
              }`}
            >
              {t("er.mainTabMedia")}
            </button>
            <button
              type="button"
              onClick={() => setEnterpriseResourceMainTab("templateBuilder")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                enterpriseResourceMainTab === "templateBuilder"
                  ? "bg-app-tone text-white"
                  : "border border-app-line-mid bg-app-surface-2/80 text-app-text hover:bg-app-surface-2"
              }`}
            >
              {t("er.mainTabTemplate")}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => openErp(null)}
              className="shrink-0 rounded-full border border-app-line-mid bg-app-surface-2/80 px-3 py-1.5 text-xs font-medium text-app-text hover:bg-app-surface-2"
            >
              {t("er.openErpProductCatalog")}
            </button>
          </div>
        </div>
      }
    >
      {enterpriseResourceMainTab === "mediaLibrary" ? <MaterialsPanel /> : <QuoteTemplateBuilderShell />}
    </UiPageShell>
  );
}
