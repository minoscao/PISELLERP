import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { useQuoteStore } from "./store/quoteStore";
import { applyDocumentTheme } from "./theme/applyDocumentTheme";
import { bootThemeOrDefault } from "./theme/themeBootCache";
import { readQuotePersistStateFromLocalStorage } from "./utils/quotePersistLocalStorageFallback";

applyDocumentTheme(bootThemeOrDefault());
document.documentElement.dataset.mapTheme = useQuoteStore.getState().mapTheme;

useQuoteStore.persist.onFinishHydration(() => {
  const s = useQuoteStore.getState();
  applyDocumentTheme(s.uiThemeBundle);
  document.documentElement.dataset.mapTheme = s.mapTheme;
  queueMicrotask(async () => {
    const st = useQuoteStore.getState();
    st.ensureBundledHardwareCatalogSynced();
    st.recategorizeUncategorizedHardware();
    const synced = await st.syncPersistFromProjectFileIfRicher();
    if (!synced.ok) {
      st.reconcileCustomPlanWorkspaceAfterHydrate();
    }
    const ls = readQuotePersistStateFromLocalStorage();
    const lsAssCount = Array.isArray(ls?.associations) ? ls.associations.length : 0;
    const currentAssCount = useQuoteStore.getState().associations.length;
    if (lsAssCount > currentAssCount) {
      useQuoteStore.getState().restoreFullHardwareCatalogFromLocalStorageBackup();
    }
  });
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
