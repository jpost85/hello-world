import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Static SPA. base: "./" keeps asset paths relative so it works on GitHub Pages
// project sites (served from /<repo>/) as well as the root.
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    outDir: "dist",
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Salvo — Artillery Duel",
        short_name: "Salvo",
        description: "A touch-first artillery duel: lob shells across destructible terrain.",
        theme_color: "#0b0d1a",
        background_color: "#05060c",
        display: "fullscreen",
        orientation: "any",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache the built app shell so it launches offline.
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
      },
    }),
  ],
});
