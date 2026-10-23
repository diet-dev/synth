import { defineConfig } from "vite";

// Демка: исходники в demo/, сборка для GitHub Pages — относительные пути
export default defineConfig({
  root: "demo",
  base: "./",
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
  },
});
