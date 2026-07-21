import fs from "node:fs";
import crypto from "node:crypto";

const blobPath =
  process.argv[2] ||
  process.env.LOCALAPPDATA +
    "/Google/Chrome/User Data/Default/IndexedDB/http_localhost_5174.indexeddb.blob/1/03/3ed";

const raw = fs.readFileSync(blobPath);
const sig = Buffer.from("data:image/jpeg;base64,", "utf16le");

function md5(buf) {
  return crypto.createHash("md5").update(buf).digest("hex").slice(0, 12);
}

const hits = [];
let pos = 0;
while (pos >= 0 && pos < raw.length) {
  pos = raw.indexOf(sig, pos === 0 ? 0 : pos + 2);
  if (pos < 0) break;
  let end = pos + sig.length;
  const chars = [];
  while (end + 1 < raw.length) {
    const lo = raw[end];
    const hi = raw[end + 1];
    if (hi !== 0) break;
    if (lo === 0x22 || lo === 0x2c) break;
    const ok =
      (lo >= 0x41 && lo <= 0x5a) ||
      (lo >= 0x61 && lo <= 0x7a) ||
      (lo >= 0x30 && lo <= 0x39) ||
      lo === 0x2b ||
      lo === 0x2f ||
      lo === 0x3d;
    if (!ok) break;
    chars.push(lo);
    end += 2;
  }
  const b64 = Buffer.from(chars).toString("ascii");
  hits.push({ pos, b64Len: b64.length, approxBytes: Math.floor((b64.length * 3) / 4), md5: md5(b64) });
}

hits.sort((a, b) => b.b64Len - a.b64Len);
console.log("blob", blobPath, "jpeg utf16 hits", hits.length);
for (const h of hits.slice(0, 20)) {
  console.log(`  b64Len=${h.b64Len} ~${Math.round(h.approxBytes / 1024)}KB md5=${h.md5} pos=${h.pos}`);
}

// compare with disk plan floors
const disk = JSON.parse(
  fs.readFileSync(new URL("../data/marketing-quote-v1.json", import.meta.url), "utf8"),
).state;
for (const p of disk.savedCustomPlans || []) {
  const url = p.data?.floorPlanDataUrl || "";
  const b64 = url.startsWith("data:") ? url.split(",")[1] || "" : "";
  console.log(`disk ${p.name}: b64Len=${b64.length} md5=${md5(b64)}`);
}
