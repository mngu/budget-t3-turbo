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
    // `pg` arrive par @budget/db, un package du workspace : Vite inline les
    // deps liées au build SSR, et `pg` (CommonJS) avec elles. L'interop CJS→ESM
    // lui fabrique alors une zone morte temporelle — le build passe, le serveur
    // démarre, et le premier rendu meurt en « Cannot access 'pg' before
    // initialization ». Invisible en dev, qui ne bundle pas.
    // Laissé externe, il est tracé dans .output et chargé nativement par Node.
    // C'est aussi pourquoi `pg` est déclaré dans le package.json de l'app alors
    // qu'il y arrive par @budget/db : pnpm est strict, et rollup doit pouvoir
    // le résoudre depuis l'app pour que nitro le trace.
    external: ["pg"],
  },
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
    // En premier, et c'est ce qui rend ses numéros de ligne justes : le plugin
    // est en `enforce: "pre"`, mais ceux de TanStack aussi (`tanstack-router:hmr`
    // et `:autoimport`), et ils réimpriment les fichiers de route par babel.
    // Placé après eux, code-inspector lisait le fichier régénéré — tout le
    // fichier sur une seule ligne, donc des `:1:251984:` inexploitables. Le
    // symptôme ne touchait que les routes, les composants ordinaires étant justes.
    codeInspectorPlugin({
      bundler: "vite",
      // R3F lit le `-` comme un séparateur de propriétés « percées » :
      // `material-color` vaut `mesh.material.color`. `data-insp-path` devient
      // donc `mesh.data.insp.path` : à la première application `mesh.data`
      // n'existe pas, R3F renonce au perçage et écrit silencieusement
      // `mesh.data = "<chemin>"` ; à la deuxième application des props sur le
      // *même* objet, le perçage repart, tombe sur cette chaîne et lève
      // « R3F: Cannot set "data-insp-path" ». D'où une panne invisible au
      // premier rendu et qui n'apparaît qu'à une mise à jour.
      // Rien à perdre à ne pas instrumenter ces fichiers : code-inspector
      // intercepte des clics sur du DOM, or ces éléments ne vivent que dans le
      // graphe WebGL — le canvas est un unique nœud DOM opaque.
      // `match` est le seul filtre par fichier du plugin (pas d'`exclude`), et
      // il est testé sur le chemin relatif à la racine — celui-là même qu'on
      // lit dans les `data-insp-path` injectés. Un `escapeTags` par balise a été
      // essayé avant : impossible à tenir complet (`animated.mesh`, `Bloom`,
      // `Billboard`, `Line`, `Text`… reversent tous leurs props dans un objet
      // Three) et son oubli est silencieux.
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
      // lucide-react n'a pas de champ `exports` : Node résout donc le specifier
      // nu par `main` (du CJS), alors que le tracer de nitro ne copie que ce que
      // le bundler a lu (l'ESM). Le build passe, `.output` démarre, et le
      // premier rendu SSR meurt en ERR_MODULE_NOT_FOUND — invisible en dev, qui
      // résout depuis les vrais node_modules. L'inliner supprime la résolution à
      // l'exécution. À retenter de retirer quand nitro sortira de l'alpha.
      externals: {
        inline: ["lucide-react"],
      },
    }),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
  ],
});
