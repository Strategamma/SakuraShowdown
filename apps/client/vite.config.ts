import { defineConfig } from "vite";

export default defineConfig(() => ({
  base: process.env.VITE_BASE ?? "/",
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION ?? "0.2.0")
  },
  server: {
    port: 5173
  }
}));
