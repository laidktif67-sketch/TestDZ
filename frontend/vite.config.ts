import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Avoid Workbox's Terser worker crash on Android/Termux ARM64.
      // The app bundle remains minified by Vite; only the generated SW is unminified.
      mode: "development",
      includeAssets: ["pwa-icon.svg"],
      manifest: {
        name: "TestDZ",
        short_name: "TestDZ",
        description: "منصة منظمة لاختبار تطبيقات Android في الجزائر",
        lang: "ar",
        dir: "rtl",
        theme_color: "#071b18",
        background_color: "#071b18",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
        ]
      }
    })
  ],
  server: { host: "0.0.0.0" },
});
