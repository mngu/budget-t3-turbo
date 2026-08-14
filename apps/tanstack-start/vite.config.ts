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
      // Sans ça, WebStorm ouvre `apps/tanstack-start` comme un projet à part au
      // lieu de sauter dans le monorepo déjà ouvert : code-inspector passe le
      // `root` de Vite (donc l'app) à launch-ide comme workspace, et ce workspace
      // gagne contre la détection `git rev-parse --show-toplevel`. `pathFormat`
      // est la seule voie qui impose la racine, et elle vaut aussi pour les
      // WebStorm < 2026.2, qui ne reçoivent aucun workspace du tout.
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
