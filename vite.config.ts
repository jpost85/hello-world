/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The single-file build (SINGLE_FILE=1) collapses everything into one chunk so
// the inlined HTML runs offline — handy for the mobile PWA / share-a-file target.
const singleFile = !!process.env.SINGLE_FILE;

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: singleFile ? { rollupOptions: { output: { inlineDynamicImports: true } } } : {},
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
