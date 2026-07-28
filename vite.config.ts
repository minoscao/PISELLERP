import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { quotePersistFileApiPlugin } from "./vite.quotePersistPlugin";

import { cloudflare } from "@cloudflare/vite-plugin";

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
  plugins: [react(), quotePersistFileApiPlugin(), cloudflare()],
  optimizeDeps: {
    exclude: ["pdfjs-dist"],
  },
  worker: {
    format: "es",
  },
});