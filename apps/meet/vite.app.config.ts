import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

function stripWorkerSourceMap() {
  return {
    name: "strip-worker-sourcemap",
    generateBundle(_, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "asset" && chunk.fileName?.includes("e2ee") && typeof chunk.source === "string") {
          chunk.source = chunk.source.replace(/\n?\/\/# sourceMappingURL=.*$/m, "");
        }
      }
    },
  };
}

const isTauri = !!process.env.TAURI_ENV_PLATFORM;

export default defineConfig({
  plugins: [vue(), stripWorkerSourceMap()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@app": resolve(__dirname, "./src/meets/app"),
      "@widgets": resolve(__dirname, "./src/meets/widgets"),
      "@features": resolve(__dirname, "./src/meets/features"),
      "@entities": resolve(__dirname, "./src/meets/entities"),
      "@shared": resolve(__dirname, "./src/shared"),
      "@rooms": resolve(__dirname, "./src/rooms"),
    },
  },
  clearScreen: isTauri ? false : undefined,
  envPrefix: ["VITE_", "TAURI_ENV_"],
  server: {
    port: 3000,
    strictPort: isTauri,
    watch: isTauri ? { ignored: ["**/src-tauri/**"] } : undefined,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: isTauri ? !!process.env.TAURI_ENV_DEBUG : false,
    target: isTauri
      ? process.env.TAURI_ENV_PLATFORM === "windows"
        ? "chrome105"
        : "safari13"
      : undefined,
    base: isTauri ? "./" : undefined,
  },
});
