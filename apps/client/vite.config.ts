import { defineConfig } from "vite";

export default defineConfig(() => ({
  base: process.env.VITE_BASE ?? "/",
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION ?? "0.2.0")
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
        }
      }
    }
  },
  server: {
    port: 5173
  }
}));
