import { defineConfig } from "vitest/config";

// Config à part, et volontairement vide : sans elle Vitest charge
// `vite.config.ts`, donc nitro et le plugin TanStack Start, qui n'ont rien à
// faire dans un run unitaire — ils échouent à s'évaluer et empêchent le serveur
// Vite de rendre la main à la fin des tests.
export default defineConfig({
  // Sauf l'alias de `tsconfig.json`, que Vitest ne lit pas : sans lui tout
  // module sous test important en `~/…` échoue à se résoudre.
  resolve: { alias: { "~": new URL("src", import.meta.url).pathname } },
});
