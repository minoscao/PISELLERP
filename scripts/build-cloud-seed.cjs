const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "data", "marketing-quote-v1.json");
const outputPath = path.join(root, "public", "cloud-seed", "marketing-quote-v1.json");
const assetsDir = path.join(root, "public", "cloud-assets");

function extensionFor(bytes, declaredMime) {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpg";
  if (bytes.subarray(0, 6).toString() === "GIF87a" || bytes.subarray(0, 6).toString() === "GIF89a") return "gif";
  if (bytes.subarray(8, 12).toString() === "WEBP") return "webp";
  return declaredMime.includes("svg") ? "svg" : "img";
}

function writeAsset(dataUrl) {
  const match = /^data:(image\/[\w.+-]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) return dataUrl;
  const bytes = Buffer.from(match[2], "base64");
  const hash = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 24);
  const fileName = `${hash}.${extensionFor(bytes, match[1])}`;
  const filePath = path.join(assetsDir, fileName);
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, bytes);
  return `/cloud-assets/${fileName}`;
}

function externalizeImages(value) {
  if (typeof value === "string") {
    return value.startsWith("data:image/") ? writeAsset(value) : value;
  }
  if (Array.isArray(value)) return value.map(externalizeImages);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, externalizeImages(item)]));
  }
  return value;
}

fs.rmSync(assetsDir, { recursive: true, force: true });
fs.mkdirSync(assetsDir, { recursive: true });
const document = externalizeImages(JSON.parse(fs.readFileSync(sourcePath, "utf8")));

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(document));
console.log(
  `Wrote ${path.relative(root, outputPath)} (${fs.statSync(outputPath).size} bytes) and ${fs.readdirSync(assetsDir).length} image assets`,
);
