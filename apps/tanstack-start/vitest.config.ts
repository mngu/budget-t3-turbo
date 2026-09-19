import { defineConfig } from "vitest/config";

// Keep unit tests isolated from the Nitro and TanStack Start Vite plugins.
export default defineConfig({
  // Vitest does not resolve tsconfig path aliases automatically.
  resolve: { alias: { "~": new URL("src", import.meta.url).pathname } },
});
