import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";

function cellText(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && v.richText) return v.richText.map((t) => t.text).join("");
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  if (typeof v === "object" && "text" in v) return String(v.text ?? "");
  return "";
}

const buf = await readFile("Pisell Hardware List.xlsx");
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buf);
const ws = wb.getWorksheet("hardware") ?? wb.worksheets[0];
const capRe = /\bWIFI\s*\+\s*(\d+)\s*G\b/i;
const byBase = new Map();
for (let r = 2; r <= ws.rowCount; r++) {
  const row = ws.getRow(r);
  const item = cellText(row.getCell(2).value).replace(/\r\n/g, " ").replace(/\n/g, " ").trim();
  if (!item) continue;
  const m = item.match(capRe);
  const base = m ? item.slice(0, m.index).trim().toLowerCase() : `__single__:${item}`;
  const arr = byBase.get(base) ?? [];
  arr.push({ r, item });
  byBase.set(base, arr);
}
const multi = [...byBase.entries()].filter(([, a]) => a.length > 1).sort((a, b) => b[1].length - a[1].length);
console.log("groups with >1 row:", multi.length);
for (const [b, rows] of multi.slice(0, 25)) {
  console.log("\n---", b.slice(0, 70), rows.length);
  for (const x of rows) console.log(" ", x.r, x.item.slice(0, 90));
}
