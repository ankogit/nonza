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

export default defineConfig({
  plugins: [vue(), stripWorkerSourceMap()],
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
    sourcemap: false,
  },
  server: {
    port: 3000,
  },
});
