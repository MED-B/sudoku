import { defineConfig } from "vite";

export default defineConfig({
  root: "client",
  build: {
    outDir: "../server/dist",
    emptyOutDir: true,
  },
});