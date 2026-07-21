import type { UiLocale } from "../types";

/**
 * 「折扣后金额」展示：金额，若有折扣则加（$xx off）或（n% off）。
 * listTotal 为折扣前标价总价；net 为实付行小计。
 */
export function formatNetAfterDiscountDisplay(
  net: number,
  listTotal: number,
  discountPctForParen: number | null | undefined,
  fmtMoney: (n: number) => string,
  locale?: UiLocale,
): string {
  const base = fmtMoney(net);
  if (Math.abs(net - listTotal) < 0.005) return base;
  const zh = locale === "zh";
  const pctOk =
    discountPctForParen !== null &&
    discountPctForParen !== undefined &&
    typeof discountPctForParen === "number" &&
    Number.isFinite(discountPctForParen) &&
    discountPctForParen > 0 &&
    discountPctForParen < 100;
  if (pctOk) {
    const p = Math.round(discountPctForParen * 100) / 100;
    return zh ? `${base}（${p}% 减）` : `${base} (${p}% off)`;
  }
  const off = Math.max(0, listTotal - net);
  return zh ? `${base}（减 ${fmtMoney(off)}）` : `${base} (${fmtMoney(off)} off)`;
}
