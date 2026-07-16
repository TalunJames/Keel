import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: `http://localhost:${process.env.PORT || 3001}`, changeOrigin: true },
      "/periscope": { target: `http://localhost:${process.env.PORT || 3001}`, changeOrigin: true },
      // Only the vendored proposals *builder* lives on the backend (/proposals/app).
      // The bare /proposals route is the main SPA's Proposals tab, so it must fall
      // through to Vite's index.html — otherwise a hard refresh 404s ("Cannot GET").
      "/proposals/app": { target: `http://localhost:${process.env.PORT || 3001}`, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
