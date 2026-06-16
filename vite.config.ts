/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The normal build code-splits each lazily-imported map into its own chunk so
// the initial download stays small. The single-file build (SINGLE_FILE=1)
// collapses everything into one chunk so the inlined HTML runs offline.
const singleFile = !!process.env.SINGLE_FILE;

export default defineConfig({
  plugins: [react()],
  build: singleFile
    ? { rollupOptions: { output: { inlineDynamicImports: true } } }
    : {},
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
