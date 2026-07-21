import { useT } from "../../i18n/useT";
import { useQuoteStore } from "../../store/quoteStore";

export function ErpCatalogSearchToolbar() {
  const t = useT();
  const erpCatalogSearchQuery = useQuoteStore((s) => s.erpCatalogSearchQuery);
  const setErpCatalogSearchQuery = useQuoteStore((s) => s.setErpCatalogSearchQuery);

  return (
    <div className="shrink-0 border-b border-app-line-subtle bg-app-panel-bg p-2">
      <input
        type="search"
        value={erpCatalogSearchQuery}
        onChange={(e) => setErpCatalogSearchQuery(e.target.value)}
        placeholder={t("erp.catalogSearchPh")}
        className="w-full rounded-lg border border-app-line-mid bg-app-surface-1 px-2 py-1.5 text-sm text-app-text outline-none placeholder:text-app-muted focus:border-app-line-strong"
        aria-label={t("erp.catalogSearchPh")}
      />
    </div>
  );
}
