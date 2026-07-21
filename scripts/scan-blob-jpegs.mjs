import fs from "node:fs";
import crypto from "node:crypto";

const blobPath =
  process.env.LOCALAPPDATA +
  "/Google/Chrome/User Data/Default/IndexedDB/http_localhost_5174.indexeddb.blob/1/03/3ed";
const raw = fs.readFileSync(blobPath);

/** JPEG in base64 usually starts with /9j/ */
const sig = Buffer.from("/9j/", "utf16le");

function md5s(s) {
  return crypto.createHash("md5").update(s).digest("hex").slice(0, 12);
}

const hits = [];
let pos = 0;
while (pos >= 0) {
  pos = raw.indexOf(sig, pos === 0 ? 0 : pos + 2);
  if (pos < 0) break;
  const chars = [];
  let i = pos;
  while (i + 1 < raw.length) {
    const lo = raw[i];
    const hi = raw[i + 1];
    if (hi !== 0) break;
    const ok =
      (lo >= 0x41 && lo <= 0x5a) ||
      (lo >= 0x61 && lo <= 0x7a) ||
      (lo >= 0x30 && lo <= 0x39) ||
      lo === 0x2b ||
      lo === 0x2f ||
      lo === 0x3d;
    if (!ok) break;
    chars.push(lo);
    i += 2;
  }
  if (chars.length > 50000) {
    const b64 = Buffer.from(chars).toString("ascii");
    hits.push({ pos, b64Len: b64.length, md5: md5s(b64) });
  }
  pos += 2;
}

hits.sort((a, b) => b.b64Len - a.b64Len);
console.log("large jpeg b64 utf16 runs:", hits.length);
for (const h of hits.slice(0, 15)) {
  console.log(`  len=${h.b64Len} ~${Math.round((h.b64Len * 3) / 4 / 1024)}KB md5=${h.md5}`);
}

const sig8 = Buffer.from("/9j/");
const hits8 = [];
pos = 0;
while (pos >= 0) {
  pos = raw.indexOf(sig8, pos === 0 ? 0 : pos + 1);
  if (pos < 0) break;
  const chars = [];
  let i = pos;
  while (i < raw.length) {
    const c = raw[i];
    const ok =
      (c >= 0x41 && c <= 0x5a) ||
      (c >= 0x61 && c <= 0x7a) ||
      (c >= 0x30 && c <= 0x39) ||
      c === 0x2b ||
      c === 0x2f ||
      c === 0x3d;
    if (!ok) break;
    chars.push(c);
    i++;
  }
  if (chars.length > 50000) {
    const b64 = Buffer.from(chars).toString("ascii");
    hits8.push({ pos, b64Len: b64.length, md5: md5s(b64) });
  }
}
hits8.sort((a, b) => b.b64Len - a.b64Len);
console.log("large jpeg b64 utf8 runs:", hits8.length);
for (const h of hits8.slice(0, 15)) {
  console.log(`  len=${h.b64Len} ~${Math.round((h.b64Len * 3) / 4 / 1024)}KB md5=${h.md5}`);
}
const allHits = [...hits, ...hits8];

const disk = JSON.parse(fs.readFileSync("data/marketing-quote-v1.json", "utf8")).state;
for (const p of disk.savedCustomPlans || []) {
  const b64 = (p.data?.floorPlanDataUrl || "").split(",")[1] || "";
  console.log(`disk ${p.name}: len=${b64.length} md5=${md5s(b64)}`);
}

// find which blob runs match disk floors
for (const p of disk.savedCustomPlans || []) {
  const b64 = (p.data?.floorPlanDataUrl || "").split(",")[1] || "";
  const m = md5s(b64);
  const hit = allHits.find((h) => h.md5 === m);
  console.log(`match ${p.name}:`, hit ? `yes len=${hit.b64Len}` : "NO");
}
