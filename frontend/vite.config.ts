import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The React dev server runs on :5173 and proxies API calls to the FastAPI
// backend on :8000, so the two run side by side without CORS friction.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
  build: { outDir: "dist" },
});
