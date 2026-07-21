import { useEffect, useState } from "react";
import { translate } from "../i18n/bundle";
import { useQuoteStore } from "../store/quoteStore";
import { applyDocumentTheme } from "../theme/applyDocumentTheme";

export function ThemeSync() {
  const mapTheme = useQuoteStore((s) => s.mapTheme);
  const uiLocale = useQuoteStore((s) => s.uiLocale);
  const uiThemeBundle = useQuoteStore((s) => s.uiThemeBundle);
  const [persistReady, setPersistReady] = useState(() => useQuoteStore.persist.hasHydrated());

  useEffect(() => {
    if (persistReady) return undefined;
    return useQuoteStore.persist.onFinishHydration(() => {
      setPersistReady(true);
    });
  }, [persistReady]);

  useEffect(() => {
    if (!persistReady) return;
    applyDocumentTheme(uiThemeBundle);
  }, [persistReady, uiThemeBundle]);

  useEffect(() => {
    document.documentElement.dataset.mapTheme = mapTheme;
  }, [mapTheme]);

  useEffect(() => {
    if (!persistReady) return;
    document.documentElement.lang = uiLocale === "zh" ? "zh-CN" : "en";
    document.title = translate(uiLocale, "app.title");
  }, [persistReady, uiLocale]);

  return null;
}
