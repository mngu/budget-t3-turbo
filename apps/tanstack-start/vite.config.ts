import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { codeInspectorPlugin } from "code-inspector-plugin";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    // 3000 comme l'ancienne app : l'URL de callback Enable Banking enregistrée
    // (http://localhost:3000/callback) doit correspondre. Ne pas lancer les deux
    // apps (budget-tracker et celle-ci) en même temps.
    port: 3000,
    // Écoute aussi sur l'IP LAN (pas seulement localhost) pour que l'app Expo
    // sur un téléphone du même réseau atteigne l'API (http://<ip-du-mac>:3000).
    host: true,
  },
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    nitro(),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
    codeInspectorPlugin({
      bundler: "vite",
    }),
  ],
});
