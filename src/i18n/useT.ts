import { useCallback } from "react";
import { useQuoteStore } from "../store/quoteStore";
import type { UiLocale } from "../types";
import { translate as translateRaw } from "./bundle";

export function useT() {
  const locale = useQuoteStore((s) => s.uiLocale) as UiLocale;
  return useCallback(
    (id: string, vars?: Record<string, string | number>) => translateRaw(locale, id, vars),
    [locale],
  );
}
