import fs from "node:fs";

const blobPath = process.argv[2];
if (!blobPath) {
  console.error("usage: node probe-idb-blob.mjs <blobFile>");
  process.exit(1);
}

const raw = fs.readFileSync(blobPath);
console.log("file", blobPath, "bytes", raw.length);

function findAll(buf, needle, enc = "utf8") {
  const n = enc === "utf16le" ? Buffer.from(needle, "utf16le") : Buffer.from(needle);
  const out = [];
  let i = 0;
  while (i < buf.length) {
    const at = buf.indexOf(n, i);
    if (at < 0) break;
    out.push(at);
    i = at + (enc === "utf16le" ? 2 : 1);
  }
  return out;
}

for (const n of ["marketing-quote-v1", "savedCustomPlans", "5F 2 all", "cheer 5F", "Game reader", "Gam"]) {
  const u8 = findAll(raw, n, "utf8").length;
  const u16 = findAll(raw, n, "utf16le").length;
  if (u8 || u16) console.log(n, { utf8: u8, utf16le: u16 });
}

/** Blink blob often stores UTF-16 JSON after 0x7B 0x00 */
const starts = findAll(raw.slice(0, 4096), "{", "utf16le");
console.log("utf16 { in first 4k at", starts);

/** Try decode contiguous utf16le runs that look like JSON */
for (const off of [0, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60]) {
  try {
    const slice = raw.subarray(off);
    const head = slice.subarray(0, 80).toString("utf16le");
    if (!head.startsWith('{"')) continue;
    let text = slice.toString("utf16le");
    const end = text.lastIndexOf("}");
    if (end < 1000) continue;
    text = text.slice(0, end + 1);
    const parsed = JSON.parse(text);
    console.log("PARSED at offset", off, "keys", Object.keys(parsed));
    const plans = parsed.state?.savedCustomPlans ?? [];
    console.log(
      "plans",
      plans.map((p) => ({ name: p.name, markers: p.data?.placements?.length, floor: p.data?.floorPlanDataUrl?.length })),
    );
    break;
  } catch {
    /* next offset */
  }
}
