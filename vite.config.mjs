import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist/app",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve("src/ui/app.js"),
      output: {
        entryFileNames: "app.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.some((name) => name.endsWith(".css"))) {
            return "app.css";
          }
          return "chunks/[name]-[hash][extname]";
        },
      },
    },
  },
});
