import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const crossOriginHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["pyodide"],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    headers: crossOriginHeaders,
    watch: {
      ignored: ["**/src-tauri/**", "**/outputs/**"],
    },
  },
  preview: {
    headers: crossOriginHeaders,
  },
});
