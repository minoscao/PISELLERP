import type { QuoteTableRowKey } from "../types";

function keyStr(k: QuoteTableRowKey): string {
  return `${k.kind}:${k.id}`;
}

export function mergeQuoteTableOrder(
  prev: QuoteTableRowKey[] | null | undefined,
  defaultOrder: QuoteTableRowKey[],
): QuoteTableRowKey[] {
  const valid = new Set(defaultOrder.map(keyStr));
  const out: QuoteTableRowKey[] = [];
  const seen = new Set<string>();
  if (prev) {
    for (const k of prev) {
      const s = keyStr(k);
      if (valid.has(s) && !seen.has(s)) {
        out.push(k);
        seen.add(s);
      }
    }
  }
  for (const k of defaultOrder) {
    const s = keyStr(k);
    if (!seen.has(s)) {
      out.push(k);
      seen.add(s);
    }
  }
  return out;
}

export function parseQuoteTableOrder(raw: unknown): QuoteTableRowKey[] | null {
  if (!Array.isArray(raw)) return null;
  const out: QuoteTableRowKey[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const kind = o.kind;
    const id = typeof o.id === "string" ? o.id : "";
    if (!id) continue;
    if (kind === "hw" || kind === "sw" || kind === "sv") out.push({ kind, id });
  }
  if (!out.length) return null;
  return out;
}
