const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "data", "marketing-quote-v1.json");
const outputPath = path.join(root, "public", "cloud-seed", "marketing-quote-v1.json");
const placeholder =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 160'%3E%3Crect width='240' height='160' fill='%23111627'/%3E%3Ctext x='120' y='83' fill='%239b8cff' font-family='Arial' font-size='16' text-anchor='middle'%3EPiSELL asset%3C/text%3E%3C/svg%3E";

const document = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const activeFloorPlan = document.state.floorPlanDataUrl;

document.state.materials = (document.state.materials || []).map((material) => ({
  ...material,
  // Preserve the active plan map; original marketing files remain in the archive.
  dataUrl: material.dataUrl === activeFloorPlan ? material.dataUrl : placeholder,
}));

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(document));
console.log(`Wrote ${path.relative(root, outputPath)} (${fs.statSync(outputPath).size} bytes)`);
