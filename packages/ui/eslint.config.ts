import { defineConfig } from "eslint/config";

import { baseConfig } from "@budget/eslint-config/base";
import { reactConfig } from "@budget/eslint-config/react";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  reactConfig,
  {
    // Composant WebGL repris tel quel de reactbits : `ogl` ne type pas
    // `Program.uniforms` (d'où les `no-unsafe-member-access`), et `program` est
    // déclaré avant d'être assigné parce que `resize()` le referme — ce que le
    // flux de TypeScript ne voit pas, d'où le `prefer-const` et les gardes
    // « toujours vraies ». Le laisser en l'état permet de le resynchroniser
    // depuis la source amont sans rejouer un patch.
    //
    // Même discipline que l'exception d'`@budget/api` : le fichier est nommé,
    // jamais un glob de dossier — l'exemption ne doit pas s'étendre en silence
    // au composant maison qui viendra se poser à côté.
    files: ["src/aurora.tsx"],
    rules: {
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "prefer-const": "off",
    },
  },
);
