import type { AssociationRow, ErpInventoryLine, ErpSerialItem, ErpStockKind, ErpStockMovement } from "../types";

export function normalizeErpStockKind(raw: unknown): ErpStockKind {
  return raw === "software" || raw === "service" ? raw : "hardware";
}

export function normalizeErpInventoryLine(raw: Partial<ErpInventoryLine> & { id?: string }): ErpInventoryLine {
  const kind = normalizeErpStockKind(raw.kind);
  const catalogRefId = String(raw.catalogRefId ?? "").trim();
  const barcode = String(raw.barcode ?? "").trim();
  const qty = typeof raw.quantityOnHand === "number" && Number.isFinite(raw.quantityOnHand) ? raw.quantityOnHand : 0;
  const reorder =
    typeof raw.reorderPoint === "number" && Number.isFinite(raw.reorderPoint) ? Math.max(0, raw.reorderPoint) : 0;
  const optRaw = (raw as Partial<ErpInventoryLine>).catalogOptionId;
  const catalogOptionId =
    optRaw === null || optRaw === undefined || optRaw === ""
      ? null
      : typeof optRaw === "string"
        ? optRaw.trim() || null
        : null;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
    kind,
    catalogRefId,
    catalogOptionId,
    barcode,
    quantityOnHand: Math.max(0, Math.floor(qty)),
    reorderPoint: reorder,
    binLocation: String(raw.binLocation ?? "").trim(),
    notes: String(raw.notes ?? "").trim(),
    supplierSku: String(raw.supplierSku ?? "").trim(),
    costPrice:
      raw.costPrice !== undefined && raw.costPrice !== null && Number.isFinite(Number(raw.costPrice))
        ? Math.max(0, Number(raw.costPrice))
        : null,
    serialTracking: kind === "hardware" ? raw.serialTracking !== false : false,
    lastInboundAt:
      typeof raw.lastInboundAt === "number" && raw.lastInboundAt > 0 ? raw.lastInboundAt : undefined,
  };
}

export function normalizeErpStockMovement(raw: Partial<ErpStockMovement> & { id?: string }): ErpStockMovement {
  const direction = raw.direction === "out" ? "out" : "in";
  const kind = normalizeErpStockKind(raw.kind);
  const catalogRefId = String(raw.catalogRefId ?? "").trim();
  const qty = typeof raw.qty === "number" && Number.isFinite(raw.qty) ? Math.max(1, Math.floor(raw.qty)) : 1;
  const at = typeof raw.at === "number" && raw.at > 0 ? raw.at : Date.now();
  const movOpt = (raw as Partial<ErpStockMovement>).catalogOptionId;
  const catalogOptionId =
    movOpt === null || movOpt === undefined || movOpt === ""
      ? undefined
      : typeof movOpt === "string"
        ? movOpt.trim() || undefined
        : undefined;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
    at,
    direction,
    kind,
    catalogRefId,
    ...(catalogOptionId ? { catalogOptionId } : {}),
    qty,
    note: typeof raw.note === "string" ? raw.note.trim() || undefined : undefined,
    barcodeSnapshot: typeof raw.barcodeSnapshot === "string" ? raw.barcodeSnapshot.trim() || undefined : undefined,
    serialNumbers: Array.isArray(raw.serialNumbers)
      ? [...new Set(raw.serialNumbers.map((x) => String(x).trim()).filter(Boolean))]
      : undefined,
    outboundOrderId: typeof raw.outboundOrderId === "string" ? raw.outboundOrderId.trim() || undefined : undefined,
  };
}

export function normalizeErpSerialItem(raw: Partial<ErpSerialItem> & { id?: string }): ErpSerialItem | null {
  const serialNumber = String(raw.serialNumber ?? "").trim();
  const catalogRefId = String(raw.catalogRefId ?? "").trim();
  if (!serialNumber || !catalogRefId) return null;
  const option = raw.catalogOptionId;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
    serialNumber,
    catalogRefId,
    catalogOptionId: typeof option === "string" && option.trim() ? option.trim() : null,
    status: raw.status === "dispatched" ? "dispatched" : "in_stock",
    inboundAt: typeof raw.inboundAt === "number" && raw.inboundAt > 0 ? raw.inboundAt : Date.now(),
    outboundAt: typeof raw.outboundAt === "number" && raw.outboundAt > 0 ? raw.outboundAt : undefined,
    outboundOrderId: typeof raw.outboundOrderId === "string" ? raw.outboundOrderId.trim() || undefined : undefined,
    note: typeof raw.note === "string" ? raw.note.trim() || undefined : undefined,
  };
}

export type BarcodeExcept =
  | { kind: ErpStockKind; catalogRefId: string; catalogOptionId: string | null }
  | { lineId: string };

export type BarcodeClash =
  | { type: "inventory"; line: ErpInventoryLine }
  | { type: "option"; associationId: string; optionId: string };

/** 条码是否已被其它库存行或硬件规格占用（排除自身） */
export function findBarcodeClash(
  lines: ErpInventoryLine[],
  barcode: string,
  except: BarcodeExcept,
  associations?: AssociationRow[],
): BarcodeClash | null {
  const b = barcode.trim();
  if (!b) return null;
  const hitLine = lines.find((l) => {
    if (l.barcode.trim() !== b) return false;
    if ("lineId" in except) return l.id !== except.lineId;
    if (l.kind !== except.kind || l.catalogRefId !== except.catalogRefId) return true;
    const lo = l.catalogOptionId ?? null;
    const eo = except.catalogOptionId ?? null;
    return lo !== eo;
  });
  if (hitLine) return { type: "inventory", line: hitLine };
  if (!associations?.length) return null;
  for (const a of associations) {
    for (const o of a.options) {
      const ob = (o.barcode ?? "").trim();
      if (ob !== b) continue;
      if ("lineId" in except) return { type: "option", associationId: a.id, optionId: o.id };
      if (except.kind === "hardware" && except.catalogRefId === a.id && (except.catalogOptionId ?? null) === o.id)
        continue;
      return { type: "option", associationId: a.id, optionId: o.id };
    }
  }
  return null;
}

export type CatalogScanHit =
  | { kind: "hardware"; catalogRefId: string; catalogOptionId: string | null }
  | { kind: "software"; catalogRefId: string }
  | { kind: "service"; catalogRefId: string };

/** 入库扫码：库存行条码（含硬件 option 行）→ 否则硬件目录规格条码 */
export function resolveErpBarcodeScan(
  lines: ErpInventoryLine[],
  associations: AssociationRow[],
  rawCode: string,
): CatalogScanHit | null {
  const code = rawCode.trim();
  if (!code) return null;
  const lh = lines.find((l) => l.barcode.trim() === code);
  if (lh) {
    if (lh.kind === "hardware")
      return { kind: "hardware", catalogRefId: lh.catalogRefId, catalogOptionId: lh.catalogOptionId ?? null };
    if (lh.kind === "software") return { kind: "software", catalogRefId: lh.catalogRefId };
    return { kind: "service", catalogRefId: lh.catalogRefId };
  }
  for (const a of associations) {
    for (const o of a.options) {
      if ((o.barcode ?? "").trim() === code)
        return { kind: "hardware", catalogRefId: a.id, catalogOptionId: o.id };
    }
  }
  return null;
}
