import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

const meetRoot = resolve(__dirname, "../meet");

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@shared": resolve(meetRoot, "./src/shared"),
    },
  },
  publicDir: resolve(meetRoot, "./public"),
  server: {
    port: 3001,
    strictPort: false,
  },
});
