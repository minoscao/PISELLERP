/**
 * Extract marketing-quote-v1 persist JSON from Chrome IndexedDB blob (UTF-16LE).
 * Usage: node scripts/extract-chrome-idb-persist.mjs [blobPath] [outPath]
 */
import fs from "node:fs";
import path from "node:path";

const defaultBlob =
  process.env.LOCALAPPDATA +
  "/Google/Chrome/User Data/Default/IndexedDB/http_localhost_5174.indexeddb.blob/1/03/3ed";

const blobPath = process.argv[2] || defaultBlob;
const outPath = process.argv[3] || path.resolve("data/marketing-quote-chrome-idb-extract.json");

const raw = fs.readFileSync(blobPath);
console.log("blob size", raw.length, "bytes");

/** Chrome IDB external blob: skip header until UTF-16 `{` */
let start = -1;
for (let i = 0; i < Math.min(raw.length - 1, 512); i += 2) {
  if (raw[i] === 0x7b && raw[i + 1] === 0x00) {
    start = i;
    break;
  }
}
if (start < 0) {
  for (let i = 0; i < raw.length - 1; i++) {
    if (raw[i] === 0x7b && raw[i + 1] === 0x00) {
      start = i;
      break;
    }
  }
}
if (start < 0) throw new Error("JSON start not found");

const utf16 = raw.subarray(start);
let text = utf16.toString("utf16le");
// Trim trailing garbage after last `}`
const lastBrace = text.lastIndexOf("}");
if (lastBrace >= 0) text = text.slice(0, lastBrace + 1);

const parsed = JSON.parse(text);
fs.writeFileSync(outPath, JSON.stringify(parsed), "utf8");
console.log("written", outPath);

const st = parsed.state ?? parsed;
const plans = st.savedCustomPlans ?? [];
console.log(
  "plans:",
  plans.map((p) => ({
    name: p.name,
    updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : null,
    markers: p.data?.placements?.length ?? 0,
    floor: p.data?.floorPlanDataUrl?.length ?? 0,
  })),
);
const p5 = plans.find((p) => p.name === "5F 2 all");
if (p5) {
  console.log("5F updatedAt", new Date(p5.updatedAt).toISOString());
}
