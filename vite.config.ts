import { defineConfig } from "vite";

// Static SPA. base: "./" keeps asset paths relative so it works on GitHub Pages
// project sites (served from /<repo>/) as well as the root.
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    outDir: "dist",
  },
});
