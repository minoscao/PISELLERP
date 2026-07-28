import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { quotePersistFileApiPlugin } from "./vite.quotePersistPlugin";

function copyHardwareSeedToBuild(): Plugin {
  return {
    name: "copy-pisell-hardware-seed-to-build",
    closeBundle() {
      const source = path.resolve(process.cwd(), "src/data/pisellHardwareSeed.json");
      const target = path.resolve(process.cwd(), "dist/pisellHardwareSeed.json");
      if (!fs.existsSync(source)) return;
      fs.copyFileSync(source, target);
    },
  };
}

export default defineConfig({
  base: "./",
  define: {
    __APP_RELEASE_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    __APP_VERSION_LABEL__: JSON.stringify("Beta 0.5"),
  },
  server: {
    port: 5174,
    strictPort: false,
  },
  plugins: [react(), quotePersistFileApiPlugin(), copyHardwareSeedToBuild()],
  optimizeDeps: {
    exclude: ["pdfjs-dist"],
  },
  worker: {
    format: "es",
  },
});
