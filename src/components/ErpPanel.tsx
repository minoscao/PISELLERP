import { useT } from "../i18n/useT";
import { useQuoteStore } from "../store/quoteStore";
import type { ErpInvSubTab } from "../types";
import { ErpInboundPanel } from "./erp/ErpInboundPanel";
import { ErpProductCatalogPanel } from "./erp/ErpProductCatalogPanel";
import { UiPageShell } from "./UiPageShell";

const INV_TABS: { id: ErpInvSubTab; labelKey: string }[] = [
  { id: "catalog", labelKey: "erp.subCatalog" },
  { id: "inbound", labelKey: "erp.subInbound" },
];

export function ErpPanel() {
  const t = useT();
  const invSub = useQuoteStore((s) => s.erpInvSubTab);
  const setInvSub = useQuoteStore((s) => s.setErpInvSubTab);

  return (
    <UiPageShell
      fillStage
      headAlign="center"
      kicker={t("erp.shellKicker")}
      title={t("tab.erp")}
      beforeStage={
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
      }
    >
      {invSub === "inbound" ? (
        <ErpInboundPanel />
      ) : (
        <ErpProductCatalogPanel />
      )}
    </UiPageShell>
  );
}
