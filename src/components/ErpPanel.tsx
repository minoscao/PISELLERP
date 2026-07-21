import { useT } from "../i18n/useT";
import { useQuoteStore } from "../store/quoteStore";
import type { ErpInvSubTab, ErpModuleTab } from "../types";
import { ErpInboundPanel } from "./erp/ErpInboundPanel";
import { ErpProductCatalogPanel } from "./erp/ErpProductCatalogPanel";
import { UiPageShell } from "./UiPageShell";

const ERP_MAIN: { id: ErpModuleTab; labelKey: string }[] = [
  { id: "customer", labelKey: "erp.modCustomer" },
  { id: "inventory", labelKey: "erp.modInventory" },
  { id: "staff", labelKey: "erp.modStaff" },
];

const INV_TABS: { id: ErpInvSubTab; labelKey: string }[] = [
  { id: "inbound", labelKey: "erp.subInbound" },
  { id: "catalog", labelKey: "erp.subCatalog" },
];

export function ErpPanel() {
  const t = useT();
  const top = useQuoteStore((s) => s.erpTopModule);
  const setTop = useQuoteStore((s) => s.setErpTopModule);
  const invSub = useQuoteStore((s) => s.erpInvSubTab);
  const setInvSub = useQuoteStore((s) => s.setErpInvSubTab);

  return (
    <UiPageShell
      fillStage
      headAlign="center"
      kicker={t("erp.shellKicker")}
      title={t("tab.erp")}
      headActions={
        <nav className="ui-tabs ui-tabs--headModule ui-erpHeadModules" aria-label={t("erp.topModulesNavAria")}>
          {ERP_MAIN.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setTop(row.id)}
              className={`ui-tab${top === row.id ? " ui-tab--active" : ""}`}
            >
              {t(row.labelKey)}
            </button>
          ))}
        </nav>
      }
      beforeStage={
        top === "inventory" ? (
          <nav className="ui-tabs ui-tabs--dense min-w-0" aria-label={t("erp.modInventory")}>
            {INV_TABS.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setInvSub(row.id)}
                className={`ui-tab${invSub === row.id ? " ui-tab--active" : ""}`}
              >
                {t(row.labelKey)}
              </button>
            ))}
          </nav>
        ) : null
      }
    >
      {top === "customer" || top === "staff" ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-app-line-strong bg-app-surface-2/25 p-10 text-center text-sm text-app-muted">
          {t("erp.comingSoon")}
        </div>
      ) : invSub === "inbound" ? (
        <ErpInboundPanel />
      ) : (
        <ErpProductCatalogPanel />
      )}
    </UiPageShell>
  );
}
