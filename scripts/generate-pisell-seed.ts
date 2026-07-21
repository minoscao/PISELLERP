/**
 * Reads `Pisell Hardware List.xlsx` from repo root and writes:
 * - `src/data/pisellHardwareSeed.json` — bundled into the app (file:// + HTTPS, everyone gets same catalog after deploy)
 * - `public/pisellHardwareSeed.json` — optional copy for debugging / static hosts
 *
 * Run: npm run generate:pisell-seed
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDefaultMaterialCategoryDefs } from "../src/constants/defaultMaterialCategories";
import { importPisellHardwareFromWorkbook } from "../src/utils/pisellHardwareImport";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const xlsxPath = join(root, "Pisell Hardware List.xlsx");
const outPublic = join(root, "public", "pisellHardwareSeed.json");
const outSrc = join(root, "src", "data", "pisellHardwareSeed.json");

const buf = await readFile(xlsxPath);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const bundle = await importPisellHardwareFromWorkbook(ab, {
  categoryDefs: buildDefaultMaterialCategoryDefs(),
});

const payload = {
  generatedAt: Date.now(),
  materials: bundle.materials,
  associations: bundle.associations,
  erpInventoryLines: bundle.erpInventoryLines,
};

const json = JSON.stringify(payload);
await mkdir(join(root, "public"), { recursive: true });
await mkdir(join(root, "src", "data"), { recursive: true });
await writeFile(outSrc, json);
await writeFile(outPublic, json);
const mb = (Buffer.byteLength(json) / (1024 * 1024)).toFixed(2);
console.log(
  `Wrote ${outSrc} and ${outPublic} (${mb} MB). Rows: ${bundle.result.rowCount}, assocs: ${bundle.associations.length}, materials: ${bundle.materials.length}`,
);
