import { defineConfig } from "vite";

// Minimal Vite config. The app is framework-free (vanilla TS + Canvas/DOM),
// so there is nothing to configure beyond the defaults for now.
export default defineConfig({
  root: ".",
  server: { open: true },
  build: { outDir: "dist", sourcemap: true },
});
