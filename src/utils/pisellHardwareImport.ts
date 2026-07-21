import ExcelJS from "exceljs";
import { UNCATEGORIZED_CATEGORY_NAME } from "../constants/materialCategories";
import type { AssociationRow, ErpInventoryLine, HardwareOption, MaterialCategoryDef, MaterialPage, PriceBand } from "../types";
import { DEFAULT_MAP_COLOR } from "../theme/mapColorPresets";
import { normalizeErpInventoryLine } from "./erpInventory";
import { createMaterialPageFromImageBuffer } from "./createMaterialFromImageBuffer";
import { normalizeAssociationRow } from "./hardwareOptionsAddons";
import { parseWarrantyMonthsAfterShip } from "./priceTriple";

export type PisellImportResult = {
  categoriesEnsured: string[];
  materialsAdded: number;
  associationsAdded: number;
  erpLinesAdded: number;
  rowCount: number;
};

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && v && "richText" in v) {
    const rt = v as { richText?: { text: string }[] };
    return (rt.richText ?? []).map((t) => t.text).join("");
  }
  if (typeof v === "object" && v && "result" in v) return String((v as { result?: unknown }).result ?? "");
  if (typeof v === "object" && v && "text" in v) return String((v as { text?: unknown }).text ?? "");
  return "";
}

/** Excel hyperlink cell → readable URL (avoids `Link: [object Object]`). */
function cellHyperlinkOrText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v).trim();
  if (typeof v === "object" && v && "hyperlink" in v) {
    const h = v as { hyperlink?: string; text?: string };
    const url = typeof h.hyperlink === "string" ? h.hyperlink.trim() : "";
    const tx = typeof h.text === "string" ? h.text.trim() : "";
    if (tx && url) return `${tx} ${url}`.trim();
    return url || tx;
  }
  return cellText(v).trim();
}

function cellNum(v: ExcelJS.CellValue): number | null {
  const t = cellText(v).replace(/[$,]/g, "").trim();
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

const WIFI_OPT = /\bWIFI\s*\+\s*\d+\s*G\b/i;

const COLOR_TAIL =
  /\s+(silver|space\s*gr(a|e)y|graphite|gold|rose\s*gold|starlight|midnight|black|white|green|blue|purple|pink|red|grey|gray|product\s*red)\s*$/i;

type ParsedRow = {
  excelRow: number;
  item: string;
  price: number | null;
  vip: number | null;
  vvip: number | null;
  warranty: string;
  link: string;
};

function normalizeItem(s: string): string {
  return s.replace(/\r\n/g, " ").replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}

function stripTrailingColors(s: string): string {
  let t = s.trim();
  for (let i = 0; i < 4; i++) {
    const u = t.replace(COLOR_TAIL, "").trim();
    if (u === t) break;
    t = u;
  }
  return t;
}

/** Same SKU: WIFI+… or trailing NN G; colors stripped first so memory+color rows collapse. */
function baseGroupKey(itemNorm: string): string {
  const stripped = stripTrailingColors(itemNorm);
  const mWifi = stripped.match(WIFI_OPT);
  if (mWifi && mWifi.index != null && mWifi.index > 0) {
    return stripped.slice(0, mWifi.index).trim().toLowerCase();
  }
  const mG = stripped.match(/^(.+?)\s+(\d+\s*G)\s*$/i);
  if (mG?.[1]) return mG[1].trim().toLowerCase();
  return `__single:${stripped.toLowerCase()}`;
}

function optionLabelFromItem(itemNorm: string, baseKey: string): string {
  const stripped = stripTrailingColors(itemNorm);
  const mWifi = stripped.match(WIFI_OPT);
  if (mWifi && mWifi.index != null) return stripped.slice(mWifi.index).trim() || "Option";
  const mG = stripped.match(/^(.+?)\s+(\d+\s*G)\s*$/i);
  if (mG?.[2]) {
    const g = mG[2].trim();
    const colorRest = itemNorm.slice(stripped.length).trim();
    return colorRest ? `${g} · ${colorRest}` : g;
  }
  const base = baseKey.startsWith("__single:") ? "" : baseKey;
  if (base) {
    const ix = stripped.toLowerCase().indexOf(base.toLowerCase());
    if (ix >= 0) {
      const rest = stripped.slice(ix + base.length).trim().replace(/^[\s—–-]+/, "");
      if (rest) return rest;
    }
  }
  return "Option";
}

function titleCaseBase(key: string): string {
  const raw = key.startsWith("__single:") ? key.slice("__single:".length) : key;
  return raw
    .split(/\s+/)
    .map((s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ""))
    .join(" ")
    .trim();
}

function pickDef(defs: MaterialCategoryDef[], zhNeedle: string, enNeedle?: string): string | null {
  const enL = enNeedle?.toLowerCase();
  return (
    defs.find((d) => d.name.includes(zhNeedle))?.name ??
    (enL ? defs.find((d) => (d.nameEn ?? "").toLowerCase().includes(enL))?.name : undefined) ??
    null
  );
}

/**
 * Network gear from model name / marketing text.
 * Order is strict: do **not** use `pickDef(..., "WiFi")` first — category name「WiFi AP」would match
 * for unrelated products that only contain the English word "network".
 */
function inferNetworkCategory(item: string, defs: MaterialCategoryDef[]): string | null {
  const low = item.toLowerCase();

  // Passive / cabling / small link parts → 辅材（通用线缆）；无则 IoT 兜底（not Wi-Fi AP）
  if (
    /\b(cat[567e]?|rj-?45|patch\s*(cord|lead|cable)|ethernet\s*cable|fiber\s*(patch|optic)|光模块|光纤|跳线|网线)\b/i.test(
      low,
    ) ||
    /\bcable\b.*\b(cat|rj)\b|\bcable\b.*\b\d+(\.\d+)?\s*m\b|\b\d+(\.\d+)?\s*m\b.*\bcable\b/i.test(low)
  ) {
    return pickDef(defs, "辅材", "cable") ?? pickDef(defs, "IoT", "iot") ?? pickDef(defs, "其他", "other");
  }

  // PoE injectors / splitters (e.g. RG-POE-AT15)
  if (/\brg-poe-/i.test(low) || /\bpoe\b.*\b(inject|splitter|adapter|at\d|af\d)\b/i.test(low)) {
    return pickDef(defs, "辅材", "cable") ?? pickDef(defs, "IoT", "iot") ?? pickDef(defs, "其他", "other");
  }

  // Managed / unmanaged switches (keyword + Reyee / Ruijie switch SKUs)
  if (
    /\bswitch\b/i.test(low) ||
    /\brg-es\d+/i.test(low) ||
    /\brg-nbs\d+/i.test(low) ||
    /千兆交换|二层交换|三层交换|poe\s*switch|管理型交换/i.test(low)
  ) {
    return pickDef(defs, "交换", "switch") ?? pickDef(defs, "Switch", "switch");
  }

  // Cellular CPE / 4G·5G routers (before plain "wireless router")
  if (
    /\b(4g|5g|lte(-a)?)\b/i.test(low) ||
    /\b(sim\b|nano[-\s]?sim|双卡|物联网卡)\b/i.test(low) ||
    /\b(n300|cat[4-9]|cat1[02])\b.*\b(4g|5g|lte|router|cpe)\b/i.test(low) ||
    /\b(4g|5g|lte)\b.*\b(router|modem|cpe|gateway)\b/i.test(low)
  ) {
    return pickDef(defs, "4G", "gateway") ?? pickDef(defs, "网关", "gateway");
  }

  // Wired routers / edge gateways (EW / EG families, explicit "router")
  if (
    /\brouter\b/i.test(low) ||
    /\brg-ew\d+/i.test(low) ||
    /\brg-eg\d+/i.test(low) ||
    /无线路由|家用路由|企业路由|网关路由/i.test(low)
  ) {
    return pickDef(defs, "路由", "router") ?? pickDef(defs, "Router", "router");
  }

  // Wi-Fi access points (hardware AP / ceiling AP / Wi-Fi 6/7 AX…)
  if (
    /\b(access\s*point|\bap\b)\b/i.test(low) ||
    /\brg-ap\d+/i.test(low) ||
    /\b(wi-?fi|wifi)\s*(6|7|6e)?\b.*\b(ax|be)\d/i.test(low) ||
    (/\b802\.11[abgnacbe]{1,4}\b/i.test(low) && !/\bswitch\b/i.test(low)) ||
    (/\bmesh\b/i.test(low) && !/\bswitch\b/i.test(low) && !/\brouter\b/i.test(low) && !/\brg-eg/i.test(low))
  ) {
    return pickDef(defs, "WiFi", "wi-fi") ?? pickDef(defs, "AP", "wi-fi");
  }

  // Ambiguous "wireless" (marketing) without switch keyword
  if (/\bwireless\b/i.test(low) && !/\bswitch\b/i.test(low)) {
    if (/\b(4g|5g|lte)\b/i.test(low)) {
      return pickDef(defs, "4G", "gateway") ?? pickDef(defs, "网关", "gateway");
    }
    if (/\brouter\b/i.test(low) || /\brg-ew/i.test(low) || /\brg-eg/i.test(low)) {
      return pickDef(defs, "路由", "router") ?? pickDef(defs, "Router", "router");
    }
    if (/\brg-ap|\baccess\s*point\b/i.test(low)) {
      return pickDef(defs, "WiFi", "wi-fi") ?? pickDef(defs, "AP", "wi-fi");
    }
    // USB Wi‑Fi dongle / client NIC
    if (/dongle|usb\s*adapter|接收器|无线网卡|client\s*adapter/i.test(low)) {
      return pickDef(defs, "辅材", "cable") ?? pickDef(defs, "IoT", "iot") ?? pickDef(defs, "其他", "other");
    }
    if (/\brg-/i.test(low)) {
      return pickDef(defs, "WiFi", "wi-fi") ?? pickDef(defs, "路由", "router");
    }
  }

  // Bare English "network" (e.g. "Ethernet network cable") — never Wi‑Fi AP
  if (/\bnetwork\b/i.test(low)) {
    return pickDef(defs, "辅材", "cable") ?? pickDef(defs, "IoT", "iot") ?? pickDef(defs, "其他", "other");
  }

  // Residual wi‑fi keyword (e.g. cloud-managed AP copy) without switch
  if ((/\bwi-?fi\b/i.test(low) || /\bwifi\b/i.test(low)) && !/\bswitch\b/i.test(low)) {
    return pickDef(defs, "WiFi", "wi-fi") ?? pickDef(defs, "AP", "wi-fi");
  }

  return null;
}

/** POS / printer / payment / scale / accessory SKUs common in AU retail catalogs (SENOR, Epson TM, NEXA, etc.). */
function inferRetailHardwareCategory(item: string, defs: MaterialCategoryDef[]): string | null {
  const low = item.toLowerCase();

  if (/\beftpos\b/i.test(low) || /\bpago\b/i.test(low) || /\b(pin\s*pad|pinpad|ingenico|verifone|pax\s*im)\b/i.test(low)) {
    return pickDef(defs, "刷卡", "card") ?? pickDef(defs, "支付", "payment");
  }

  if (
    /\b(cash\s*draw|drawer|钱箱)\b/i.test(low) ||
    /\bdrw\b/i.test(low) ||
    /\bnexa\s*cb\d{2,4}\b/i.test(low)
  ) {
    return pickDef(defs, "支付", "payment");
  }

  if (
    /\bzebra\b.*\bds\d/i.test(low) ||
    /\b(honeywell|datalogic)\b.*\b(scanner|imager)\b/i.test(low) ||
    /\b(barcode|2d)\s*(scanner|imager)\b/i.test(low) ||
    /\bqr\s*scanner\b/i.test(low) ||
    (/\b(ds\d{3,5})\b/i.test(low) && /\b(cordless|handheld|scanner|imager|1d|2d)\b/i.test(low))
  ) {
    return pickDef(defs, "扫码", "scan") ?? pickDef(defs, "刷卡", "card");
  }

  if (/\bepson\b.*\btm[-\s]?/i.test(low) || /\b(star\s*tsp|citizen\s*ct-|bixolon)\b/i.test(low) || /\bthermal\s*receipt\b/i.test(low)) {
    return pickDef(defs, "小票", "receipt") ?? pickDef(defs, "打印", "print");
  }

  if (
    /\b(gprinter|佳博)\b/i.test(low) ||
    /\bgp[-\s]*d[-\s]?\d{3,4}[a-z]*/i.test(low) ||
    /\bgp[-\s]*1824/i.test(low) ||
    /\blabel\s*printer\b/i.test(low) ||
    (/\bgp\b/i.test(low) && /\b(usb|ethernet|bluetooth)\b/i.test(low) && !/\bpos\s*stand\b/i.test(low))
  ) {
    return pickDef(defs, "标签", "label") ?? pickDef(defs, "打印", "print");
  }

  if (/\bsenor\b/i.test(low) || /\bmiki\b/i.test(low) || /\bsenki\b/i.test(low)) {
    if (/freestand|freestandin|立式|floor\s*stand/i.test(low)) {
      return pickDef(defs, "立式", "freestanding") ?? pickDef(defs, "POS", "POS");
    }
    return pickDef(defs, "POS", "POS");
  }

  if (/\bk\d{3}\b/i.test(low) && (/\brk\d{4,6}\b/i.test(low) || /\d{3,4}\s*[*×x]\s*1080/i.test(low) || /\b1080p\b/i.test(low))) {
    return pickDef(defs, "菜单", "menu") ?? pickDef(defs, "宣传", "promo");
  }

  if (/\bcas\b/i.test(low) && /\b(pd|ad|scale|weigh|kg|serial|usb|串口|秤)\b/i.test(low)) {
    return pickDef(defs, "称重", "weighing") ?? pickDef(defs, "电子秤", "scale");
  }

  if (/\busr[-_]tcp232\b/i.test(low) || /\bserial\s*(rs)?232\b.*\b(ethernet|tcp|ip|network)\b/i.test(low)) {
    return pickDef(defs, "辅材", "cable") ?? pickDef(defs, "收银配件", "POS") ?? pickDef(defs, "IoT", "iot");
  }

  if (
    /\bpos\s*stand\b/i.test(low) ||
    /\bdual\s*pos\s*stand\b/i.test(low) ||
    /\bbosstab\b/i.test(low) ||
    /\b(y9|s9|proper)\b.*\bstand\b/i.test(low) ||
    (/\b(mounting|bracket)\b/i.test(low) && /\b(nexa|pos|tablet)\b/i.test(low))
  ) {
    return pickDef(defs, "收银配件", "POS") ?? pickDef(defs, "支架", "mount");
  }

  return null;
}

/** Infer shelf category from product title; only returns names that exist in defs. */
export function inferHardwareCategoryFromItem(item: string, defs: MaterialCategoryDef[]): string {
  const low = item.toLowerCase();

  const tryOrdered: (() => string | null)[] = [
    () => (/\bads\b/i.test(low) ? pickDef(defs, "ADS", "ADS") : null),
    () => inferRetailHardwareCategory(item, defs),
    () =>
      /\b(色带|碳带|热敏纸|收银纸|吊牌纸|标签纸卷|蜡基|树脂基|色带架)\b/i.test(low) &&
      !/\b(打印机|printer|条码机|标签机|imager)\b/i.test(low)
        ? pickDef(defs, "耗材", "consum") ?? pickDef(defs, "运营耗材", "consum")
        : null,
    () =>
      /\b(ribbon|thermal\s*roll|paper\s*roll)\b/i.test(low) && !/\b(label\s*printer|条码机|标签机)\b/i.test(low)
        ? pickDef(defs, "耗材", "consum") ?? pickDef(defs, "运营耗材", "consum")
        : null,
    () =>
      /\b(label|thermal\s*label|lprs|direct\s*thermal|ribbon)\b/i.test(low)
        ? pickDef(defs, "标签打印", "label")
        : null,
    () => (/\b(receipt|小票)\b/i.test(low) ? pickDef(defs, "小票", "receipt") : null),
    () =>
      /\b(sunmi|android\s*pos|pos\s*terminal|checkout\s*register|self[-\s]?service\s*terminal)\b/i.test(low)
        ? pickDef(defs, "POS", "POS")
        : null,
    () =>
      /\b(ipad|galaxy\s*tab|surface)\b/i.test(low) && /\b(pos|wifi|cellular|g)\b/i.test(low)
        ? pickDef(defs, "POS", "POS")
        : null,
    () => (/\bipad|tablet\b/i.test(low) ? pickDef(defs, "POS", "POS") : null),
    () =>
      /\b(kitchen|kds|customer\s*display|2nd\s*display|叫号|厨房)\b/i.test(low)
        ? pickDef(defs, "厨房", "kitchen") ?? pickDef(defs, "叫号", "queue")
        : null,
    // Commercial displays / AIO with size or resolution (avoid dumping into network/Wi‑Fi)
    () =>
      /\b(digital\s*signage|广告机|商显|会议平板|教学一体机|卧式查询机)\b/i.test(low) ||
      (/\d{1,2}(\.\d+)?\s*["\u201d\u2033″]/i.test(low) &&
        /\b(1920|1080p|2160|4k|2k|触摸|touch|android|一体机|液晶|分辨率)\b/i.test(low))
        ? pickDef(defs, "宣传", "promo") ?? pickDef(defs, "菜单", "menu") ?? pickDef(defs, "ADS", "ADS")
        : null,
    () =>
      /\b(menu|display|monitor|screen|宣传|菜单)\b/i.test(low)
        ? pickDef(defs, "菜单", "menu") ?? pickDef(defs, "宣传", "promo")
        : null,
    () => (/\bprinter|print\b/i.test(low) ? pickDef(defs, "打印", "print") : null),
    () => inferNetworkCategory(item, defs),
    () =>
      /\b(camera|nvr|dvr|录像)\b/i.test(low) ? pickDef(defs, "摄像头", "camera") ?? pickDef(defs, "录像", "nvr") : null,
    () =>
      /\b(scan|barcode|qr|扫码)\b/i.test(low)
        ? pickDef(defs, "扫码", "scan") ?? pickDef(defs, "刷卡", "card")
        : null,
    () =>
      /\b(cable|adapter|adaptor|charger|power|type[-\s]?c|usb\s*hub|socket|outlet|power\s*strip|extension\s*cord)\b/i.test(
        low,
      ) || /插座|排插|插板|插线板|延长线|电源线|充电器|转换头|适配器|线缆/i.test(item)
        ? pickDef(defs, "辅材", "cable") ?? pickDef(defs, "收银配件", "POS") ?? pickDef(defs, "其他", "other")
        : null,
    () => (/\b(cash\s*draw|drawer|钱箱)\b/i.test(low) ? pickDef(defs, "支付", "payment") : null),
  ];

  for (const fn of tryOrdered) {
    const hit = fn();
    if (hit) return hit;
  }
  return UNCATEGORIZED_CATEGORY_NAME;
}

function rowPriceBand(r: ParsedRow): PriceBand {
  const regular = Math.max(0, r.price ?? 0);
  const vip = r.vip != null && Number.isFinite(r.vip) ? Math.max(0, r.vip) : regular;
  const vvip = r.vvip != null && Number.isFinite(r.vvip) ? Math.max(0, r.vvip) : vip;
  return { regular, vip, vvip };
}

function toArrayBuffer(data: unknown): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  if (data instanceof Uint8Array) {
    const u = data;
    const out = new Uint8Array(u.byteLength);
    out.set(u);
    return out.buffer;
  }
  return new ArrayBuffer(0);
}

/**
 * Parse Pisell Hardware List.xlsx (`hardware` sheet). Ignores Excel column A for classification.
 * Merges rows that differ only by memory/color into options. Embedded images → product (ID) slot.
 * Replaces prior hardware catalog when used from store import.
 */
export async function importPisellHardwareFromWorkbook(
  arrayBuffer: ArrayBuffer,
  input: { categoryDefs: MaterialCategoryDef[] },
): Promise<{
  result: PisellImportResult;
  materials: MaterialPage[];
  associations: AssociationRow[];
  erpInventoryLines: ErpInventoryLine[];
}> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);
  const ws = wb.getWorksheet("hardware") ?? wb.worksheets[0];
  if (!ws) {
    return {
      result: {
        categoriesEnsured: [],
        materialsAdded: 0,
        associationsAdded: 0,
        erpLinesAdded: 0,
        rowCount: 0,
      },
      materials: [],
      associations: [],
      erpInventoryLines: [],
    };
  }

  const imageByRow = new Map<number, { extension: string; buffer: ArrayBuffer }>();
  for (const img of ws.getImages()) {
    const row = Math.max(1, Math.round(img.range.tl.row));
    const imageIdRaw = img.imageId as unknown;
    const imageIdNum = typeof imageIdRaw === "number" ? imageIdRaw : Number(imageIdRaw);
    if (!Number.isFinite(imageIdNum)) continue;
    const im = wb.getImage(imageIdNum);
    if (!im.buffer) continue;
    const ab = toArrayBuffer(im.buffer as unknown);
    if (!ab.byteLength) continue;
    const ext = (im.extension || "jpeg").replace(/^\./, "");
    imageByRow.set(row, { extension: ext, buffer: ab });
  }

  const parsed: ParsedRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const item = normalizeItem(cellText(row.getCell(2).value));
    if (!item) continue;
    parsed.push({
      excelRow: r,
      item,
      price: cellNum(row.getCell(5).value),
      vip: cellNum(row.getCell(8).value),
      vvip: cellNum(row.getCell(9).value),
      warranty: cellText(row.getCell(10).value).trim(),
      link: cellHyperlinkOrText(row.getCell(11).value),
    });
  }

  const groups = new Map<string, ParsedRow[]>();
  for (const pr of parsed) {
    const k = baseGroupKey(pr.item);
    const arr = groups.get(k) ?? [];
    arr.push(pr);
    groups.set(k, arr);
  }

  const newMaterials: MaterialPage[] = [];
  const newAssociations: AssociationRow[] = [];
  const newErpLines: ErpInventoryLine[] = [];

  for (const [, rows] of groups) {
    rows.sort((a, b) => a.excelRow - b.excelRow);
    const useOptions = rows.length > 1;
    const primary = rows[0]!;
    const groupBaseKey = baseGroupKey(primary.item);
    const hwCat = inferHardwareCategoryFromItem(primary.item, input.categoryDefs);
    const warrantyMonthsAfterShip = parseWarrantyMonthsAfterShip(primary.warranty);
    const noteBits: string[] = [];
    if (primary.link) noteBits.push(`Link: ${primary.link}`);

    let association: AssociationRow;
    if (useOptions) {
      const deviceTitle = titleCaseBase(groupBaseKey);
      const opts: HardwareOption[] = [];
      for (const r of rows) {
        const id = crypto.randomUUID();
        let optProductId: string | null = null;
        const im = imageByRow.get(r.excelRow);
        if (im) {
          const safeName = `Pisell-r${r.excelRow}-${r.item.slice(0, 40).replace(/[/\\?%*:|"<>]/g, "-")}.${im.extension === "jpeg" ? "jpg" : im.extension}`;
          const mat = await createMaterialPageFromImageBuffer({
            buffer: im.buffer,
            extension: im.extension,
            fileName: safeName,
            category: hwCat,
            imageKind: "product",
          });
          newMaterials.push(mat);
          optProductId = mat.id;
        }
        const band = rowPriceBand(r);
        opts.push({
          id,
          label: optionLabelFromItem(r.item, groupBaseKey),
          optionPrice: band.regular,
          priceBand: band,
          ...(optProductId ? { productMaterialId: optProductId } : {}),
        });
      }
      const minReg = opts.length ? Math.min(...opts.map((o) => o.priceBand?.regular ?? o.optionPrice)) : 0;
      const rowLevelProduct = opts.find((o) => o.productMaterialId)?.productMaterialId ?? null;
      const baseBand = rowPriceBand(primary);
      association = normalizeAssociationRow({
        id: crypto.randomUUID(),
        hardwareName: hwCat,
        deviceModel: deviceTitle,
        color: DEFAULT_MAP_COLOR,
        productMaterialId: rowLevelProduct,
        quoteAdMaterialId: null,
        technicalMaterialId: null,
        unitPrice: minReg,
        priceBand: baseBand,
        warrantyMonthsAfterShip,
        quoteTierMode: "follow",
        note: noteBits.join("\n"),
        quoteTableNote: "",
        options: opts,
        addons: [],
      });
    } else {
      let productMaterialId: string | null = null;
      const imgRow = rows.find((x) => imageByRow.has(x.excelRow));
      if (imgRow) {
        const im = imageByRow.get(imgRow.excelRow);
        if (im) {
          const safeName = `Pisell-r${imgRow.excelRow}-${imgRow.item.slice(0, 40).replace(/[/\\?%*:|"<>]/g, "-")}.${im.extension === "jpeg" ? "jpg" : im.extension}`;
          const mat = await createMaterialPageFromImageBuffer({
            buffer: im.buffer,
            extension: im.extension,
            fileName: safeName,
            category: hwCat,
            imageKind: "product",
          });
          newMaterials.push(mat);
          productMaterialId = mat.id;
        }
      }
      const band = rowPriceBand(primary);
      association = normalizeAssociationRow({
        id: crypto.randomUUID(),
        hardwareName: hwCat,
        deviceModel: primary.item,
        color: DEFAULT_MAP_COLOR,
        productMaterialId,
        quoteAdMaterialId: null,
        technicalMaterialId: null,
        unitPrice: band.regular,
        priceBand: band,
        warrantyMonthsAfterShip,
        quoteTierMode: "follow",
        note: noteBits.join("\n"),
        quoteTableNote: "",
        options: [],
        addons: [],
      });
    }

    newAssociations.push(association);

    if (association.options.filter((o) => o.label.trim()).length > 0) {
      for (const o of association.options) {
        if (!o.label.trim()) continue;
        newErpLines.push(
          normalizeErpInventoryLine({
            kind: "hardware",
            catalogRefId: association.id,
            catalogOptionId: o.id,
            barcode: (o.barcode ?? "").trim(),
            quantityOnHand: 0,
          }),
        );
      }
    } else {
      newErpLines.push(
        normalizeErpInventoryLine({
          kind: "hardware",
          catalogRefId: association.id,
          catalogOptionId: null,
          barcode: "",
          quantityOnHand: 0,
        }),
      );
    }
  }

  return {
    result: {
      categoriesEnsured: [],
      materialsAdded: newMaterials.length,
      associationsAdded: newAssociations.length,
      erpLinesAdded: newErpLines.length,
      rowCount: parsed.length,
    },
    materials: newMaterials,
    associations: newAssociations,
    erpInventoryLines: newErpLines,
  };
}
