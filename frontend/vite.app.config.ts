import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@app": resolve(__dirname, "./src/app"),
      "@widgets": resolve(__dirname, "./src/widgets"),
      "@features": resolve(__dirname, "./src/features"),
      "@entities": resolve(__dirname, "./src/entities"),
      "@shared": resolve(__dirname, "./src/shared"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
});
