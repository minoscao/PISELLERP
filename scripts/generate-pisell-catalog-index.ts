/**
 * Produces the lightweight product picker index used by inbound/outbound ERP screens.
 * It deliberately excludes material images so the Cloudflare static app can load it fast.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "src", "data", "pisellHardwareSeed.json");
const target = join(root, "public", "pisellCatalogIndex.json");

const payload = JSON.parse(await readFile(source, "utf8")) as {
  generatedAt?: number;
  associations?: Array<Record<string, unknown>>;
};

const associations = (payload.associations ?? []).map((row) => {
  const { productMaterialId: _productMaterialId, quoteAdMaterialId: _quoteAdMaterialId, technicalMaterialId: _technicalMaterialId, ...catalogRow } = row;
  return catalogRow;
});

await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify({ generatedAt: payload.generatedAt ?? Date.now(), associations }));
console.log(`Wrote ${target}: ${associations.length} products`);
