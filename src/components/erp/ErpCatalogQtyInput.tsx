import { useEffect, useState } from "react";
import { useT } from "../../i18n/useT";
import { useQuoteStore } from "../../store/quoteStore";
import type { ErpStockKind } from "../../types";

/**
 * 产品库目录表内联：库存数量（无独立库存子表时合并到主表）
 */
export function ErpCatalogQtyInput({
  kind,
  catalogRefId,
  catalogOptionId = null,
}: {
  kind: ErpStockKind;
  catalogRefId: string;
  catalogOptionId?: string | null;
}) {
  const tr = useT();
  const opt = catalogOptionId ?? null;
  const line = useQuoteStore((s) =>
    s.erpInventoryLines.find(
      (l) => l.kind === kind && l.catalogRefId === catalogRefId && (l.catalogOptionId ?? null) === opt,
    ),
  );
  const ensureErpInventoryRow = useQuoteStore((s) => s.ensureErpInventoryRow);
  const patchErpInventoryLine = useQuoteStore((s) => s.patchErpInventoryLine);
  const [qty, setQty] = useState(line?.quantityOnHand ?? 0);

  useEffect(() => {
    setQty(line?.quantityOnHand ?? 0);
  }, [line?.id, line?.quantityOnHand, catalogRefId, opt, kind]);

  const commit = (next: number) => {
    const v = Math.max(0, Math.floor(next));
    if (line) {
      patchErpInventoryLine(line.id, { quantityOnHand: v });
      return;
    }
    const id = ensureErpInventoryRow(
      kind,
      catalogRefId,
      kind === "hardware" ? opt : undefined,
    );
    if (id) patchErpInventoryLine(id, { quantityOnHand: v });
  };

  return (
    <input
      type="number"
      min={0}
      title={tr("erp.colStock")}
      className="w-16 max-w-full rounded border border-app-line-mid bg-app-surface-2 px-1.5 py-0.5 text-right text-xs tabular-nums"
      value={qty}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setQty(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
      onBlur={() => commit(qty)}
      onKeyDown={(e) => e.stopPropagation()}
    />
  );
}
