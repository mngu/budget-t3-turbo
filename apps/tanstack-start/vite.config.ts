import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { codeInspectorPlugin } from "code-inspector-plugin";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  ssr: {
    // Bundling pg breaks CJS interop during SSR. Keep it external and declared
    // in the app's dependencies so Nitro can trace it into .output.
    external: ["pg"],
  },
  server: {
    // Must match the registered Enable Banking callback URL.
    port: 3000,
    host: true,
  },
  plugins: [
    // Run before TanStack rewrites routes so inspector line numbers stay accurate.
    codeInspectorPlugin({
      bundler: "vite",
      // Injected data-insp-path props are interpreted as nested Three properties
      // by R3F and crash on updates. Exclude WebGL files from instrumentation.
      match: /^(?!.*packages\/ui\/src\/three\/)/,
      pathFormat: [
        path.resolve(import.meta.dirname, "../.."),
        "--line",
        "{line}",
        "--column",
        "{column}",
        "{file}",
      ],
    }),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    nitro({
      // Nitro traces Lucide's ESM files, but Node resolves its CJS entry point.
      // Inline it to prevent ERR_MODULE_NOT_FOUND during production SSR.
      externals: {
        inline: ["lucide-react"],
      },
    }),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
  ],
});
