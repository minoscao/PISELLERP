import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";

const buf = await readFile("Pisell Hardware List.xlsx");
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buf);
const ws = wb.getWorksheet("hardware");
const c = ws.getRow(2).getCell(11);
console.log(JSON.stringify(c.value, null, 2), c.hyperlink);
