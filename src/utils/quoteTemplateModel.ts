import type {
  QuoteTemplateBlock,
  QuoteTemplateBlockKind,
  QuoteTemplateDocumentRole,
  QuoteTemplateTableColumn,
  SavedQuoteTemplate,
} from "../types";

const BLOCK_KINDS: QuoteTemplateBlockKind[] = [
  "co.logo",
  "co.name",
  "co.tagline",
  "co.contact",
  "q.title",
  "q.table",
  "q.totals",
  "c.text",
  "c.image",
  "c.spacer",
  "c.rule",
];

export function isQuoteTemplateBlockKind(x: unknown): x is QuoteTemplateBlockKind {
  return typeof x === "string" && (BLOCK_KINDS as string[]).includes(x);
}

export function normalizeQuoteTemplateBlock(raw: unknown): QuoteTemplateBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id ? o.id : crypto.randomUUID();
  const kind = o.kind;
  if (!isQuoteTemplateBlockKind(kind)) return null;
  const style = o.style && typeof o.style === "object" ? (o.style as QuoteTemplateBlock["style"]) : undefined;
  const tableShowGst = o.tableShowGst === true || o.tableShowGst === false ? o.tableShowGst : undefined;
  const tc = o.tableColumns;
  const allowed: QuoteTemplateTableColumn[] = ["model", "qty", "price", "notes"];
  const tableColumns = Array.isArray(tc)
    ? (tc.filter((c): c is QuoteTemplateTableColumn => allowed.includes(c as QuoteTemplateTableColumn)) as
        | QuoteTemplateTableColumn[]
        | undefined)
    : undefined;
  const text = typeof o.text === "string" ? o.text : undefined;
  const materialId =
    o.materialId === null || o.materialId === undefined
      ? null
      : typeof o.materialId === "string"
        ? o.materialId
        : null;
  const imageDataUrl: string | null | undefined =
    o.imageDataUrl === null
      ? null
      : typeof o.imageDataUrl === "string"
        ? o.imageDataUrl
        : undefined;
  const spacerHeightMm =
    typeof o.spacerHeightMm === "number" && Number.isFinite(o.spacerHeightMm) ? o.spacerHeightMm : undefined;
  const ruleThicknessMm =
    typeof o.ruleThicknessMm === "number" && Number.isFinite(o.ruleThicknessMm) ? o.ruleThicknessMm : undefined;
  const ruleColor = typeof o.ruleColor === "string" ? o.ruleColor : undefined;
  return {
    id,
    kind,
    style,
    tableShowGst,
    tableColumns,
    text,
    materialId,
    imageDataUrl,
    spacerHeightMm,
    ruleThicknessMm,
    ruleColor,
  };
}

export function normalizeSavedQuoteTemplate(raw: unknown): SavedQuoteTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id ? o.id : crypto.randomUUID();
  const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : "Untitled";
  const createdAt = typeof o.createdAt === "number" && Number.isFinite(o.createdAt) ? o.createdAt : Date.now();
  const updatedAt = typeof o.updatedAt === "number" && Number.isFinite(o.updatedAt) ? o.updatedAt : createdAt;
  const blocksRaw = o.blocks;
  const blocks: QuoteTemplateBlock[] = [];
  if (Array.isArray(blocksRaw)) {
    for (const b of blocksRaw) {
      const n = normalizeQuoteTemplateBlock(b);
      if (n) blocks.push(n);
    }
  }
  const dr = o.documentRole;
  const documentRole: QuoteTemplateDocumentRole | undefined =
    dr === "quote" || dr === "invoice" || dr === "other" ? dr : undefined;
  return { id, name, documentRole, createdAt, updatedAt, blocks };
}

/** 从组件面板新建一块时的默认样式与字段 */
export function createQuoteTemplateBlock(kind: QuoteTemplateBlockKind): QuoteTemplateBlock {
  const id = crypto.randomUUID();
  switch (kind) {
    case "co.logo":
      return {
        id,
        kind,
        style: { textAlign: "left", fontSizePx: 12, imageWidthFrac: 0.24, imageMaxHeightMm: 22 },
      };
    case "co.name":
      return { id, kind, style: { fontWeight: "700", fontSizePx: 18, color: "#1e293b", textAlign: "left" } };
    case "co.tagline":
      return { id, kind, style: { fontSizePx: 13, color: "#64748b", textAlign: "left" } };
    case "co.contact":
      return { id, kind, style: { fontSizePx: 11, color: "#475569", textAlign: "left" } };
    case "q.title":
      return { id, kind, style: { fontWeight: "600", fontSizePx: 16, color: "#334155", textAlign: "left" } };
    case "q.table":
      return {
        id,
        kind,
        style: { fontSizePx: 11, color: "#0f172a" },
        tableShowGst: true,
        tableColumns: ["model", "qty", "price", "notes"],
      };
    case "q.totals":
      return { id, kind, style: { fontSizePx: 12, color: "#0f172a", textAlign: "right" } };
    case "c.text":
      return {
        id,
        kind,
        text: "Custom text",
        style: { fontSizePx: 12, color: "#64748b", textAlign: "left" },
      };
    case "c.image":
      return {
        id,
        kind,
        materialId: null,
        imageDataUrl: null,
        style: { textAlign: "center", imageWidthFrac: 1, imageMaxHeightMm: undefined },
      };
    case "c.spacer":
      return { id, kind, spacerHeightMm: 8 };
    case "c.rule":
      return { id, kind, ruleThicknessMm: 0.25, ruleColor: "#94a3b8" };
  }
}

export function defaultQuoteTemplateBlocks(): QuoteTemplateBlock[] {
  return [
    {
      id: crypto.randomUUID(),
      kind: "co.logo",
      style: { textAlign: "left", fontSizePx: 12 },
    },
    {
      id: crypto.randomUUID(),
      kind: "co.name",
      style: { fontWeight: "700", fontSizePx: 18, color: "#1e293b", textAlign: "left" },
    },
    {
      id: crypto.randomUUID(),
      kind: "q.title",
      style: { fontWeight: "600", fontSizePx: 16, color: "#334155", textAlign: "left" },
    },
    {
      id: crypto.randomUUID(),
      kind: "q.table",
      style: { fontSizePx: 11, color: "#0f172a" },
      tableShowGst: true,
      tableColumns: ["model", "qty", "price", "notes"],
    },
    {
      id: crypto.randomUUID(),
      kind: "q.totals",
      style: { fontSizePx: 12, color: "#0f172a", textAlign: "right" },
    },
  ];
}
