# App mobile Expo avec gluestack-ui — design

Date : 2026-07-21

## Contexte et objectif

`apps/expo` est aujourd'hui un placeholder : login fonctionnel (better-auth/expo), plomberie tRPC + React Query déjà en place (`src/utils/api.tsx`), mais aucun écran métier. L'objectif de ce projet est de construire une v1 de l'app mobile permettant de consulter et gérer ses transactions bancaires, en utilisant **gluestack-ui** comme librairie de composants.

## Décision d'architecture : pas de codebase de composants unifié web/mobile

L'idée initiale était de partager un seul jeu de composants entre `apps/tanstack-start` (web) et `apps/expo` (mobile) via gluestack-ui. Ce n'est **pas retenu** pour une raison technique vérifiée :

> Source : [gluestack-ui installation docs](https://github.com/gluestack/gluestack-ui/blob/main/src/docs/home/getting-started/installation/index.mdx) — "gluestack-ui v5 does not currently support Next.js. Next.js support will be available as soon as NativeWind v5 adds web support. In the meantime, the steps below use NativeWind v4 (Tailwind CSS v3)."

Le rendu web de gluestack-ui n'est aujourd'hui supporté qu'avec NativeWind v4 / Tailwind v3, et uniquement documenté pour Next.js (pas Vite/TanStack Start, le bundler web de ce monorepo). Ce monorepo est entièrement sur Tailwind v4. Unifier aurait donc demandé un downgrade global de Tailwind (régression pour le web) et une intégration Vite non documentée.

**Décision** : `@budget/ui` (Base UI) reste inchangé et utilisé exclusivement par `apps/tanstack-start`. gluestack-ui est utilisé exclusivement par `apps/expo`, sans partage de composants entre les deux apps. Le lien de cohérence visuelle entre web et mobile passe par les **tokens de thème partagés** (`@budget/tailwind-config/theme`), déjà importés par `apps/expo/src/styles.css` et utilisés par le placeholder actuel (`bg-background`, `text-foreground`, `bg-primary`, etc.) — pas par les composants eux-mêmes.

## Setup technique

- `npx gluestack-ui init` dans `apps/expo`, moteur **NativeWind v5** (déjà configuré : `withNativewind` dans `metro.config.js`, PostCSS via `@budget/tailwind-config/postcss-config`, pas de plugin babel — conforme aux prérequis NativeWind v5 de gluestack-ui).
- Bump de versions requis par gluestack-ui : `nativewind` `5.0.0-preview.2` → `^5.0.0-preview.4`, `react-native-css` `3.0.1` → `^3.0.4`.
- Nouvelles dépendances : `@gluestack-ui/core`, `@gluestack-ui/utils`, `react-native-svg` (composants Actionsheet/Icon), `react-native-gifted-charts` (graphiques, cf. plus bas).
- Le thème Tailwind généré par le CLI gluestack-ui est **remplacé/mappé** pour pointer vers les tokens existants de `@budget/tailwind-config/theme`, plutôt que d'utiliser la palette par défaut de gluestack — pour garder une identité visuelle cohérente avec le web.
- Composants ajoutés au fil de l'eau via `npx gluestack-ui add <component>` (modèle "copy-paste" façon shadcn, comme déjà pratiqué dans `packages/ui` avec `ui-add`), pas tout le catalogue d'un coup. Liste initiale : Button, Input, Card, Badge, Actionsheet, Spinner, Toast.

## Navigation

Structure sous `apps/expo/src/app/` (expo-router, déjà en place) :

```
(tabs)/
  _layout.tsx          # Tab bar : Transactions | Banques
  index.tsx            # Transactions (liste + KPIs + répartition par catégorie)
  banques.tsx          # Liste des connexions + statut + sync
transaction/[id].tsx   # Détail transaction + édition de catégorie
_layout.tsx            # (existant) providers — inchangé
index.tsx              # (existant) login — inchangé
```

Pas de groupe de routes protégées façon `_authed` (comme sur le web) : le pattern actuel (affichage conditionnel selon la session dans le composant) est conservé, suffisant vu la taille de l'app.

## Écrans et données

### Onglet Transactions

- **Liste** : `trpc.transactions.list` (déjà existant, réutilisé tel quel) en défilement infini via `useInfiniteQuery` (React Query), en incrémentant le paramètre `page` existant côté API (pas de vrai curseur à ajouter côté serveur). Rendu avec `@legendapp/list` (dépendance déjà présente dans `apps/expo`).
- **Filtres** (banque/catégorie/période/recherche — équivalent de `transactions-filters.tsx` et `calendar-filter.tsx` côté web) : regroupés dans une feuille modale (Actionsheet gluestack-ui) plutôt qu'une barre inline, pour économiser l'espace écran.
- **Édition de catégorie** : `trpc.categories.list` pour les options, `trpcClient.transactions.updateCategory.mutate()` à la sélection, puis `queryClient.invalidateQueries()` pour rafraîchir la liste (équivalent mobile de `router.invalidate()`, qui n'a pas de sens ici — pas de _loader_ côté mobile).
- **KPIs + répartition par catégorie** : `trpc.transactions.byCategory` (directions debit/credit, déjà existant), rendu avec `react-native-gifted-charts` (SVG, sans dépendance Skia) à la place de `recharts` (non compatible React Native).

### Onglet Banques

- `trpc.connections.list` pour le statut des connexions existantes (lecture seule).
- Bouton **Synchroniser** → `trpcClient.sync.run.mutate()`, feedback par Toast gluestack-ui (équivalent du `SyncButton` web, qui utilise `sonner` via `@budget/ui/toast` — non compatible RN).
- **Hors scope v1** : ajout d'une nouvelle banque (wizard OAuth Enable Banking). La `redirectUrl` du flow d'auth bancaire est une URL fixe configurée dans `settings`, actuellement pointée sur le web (`http://localhost:3000/callback`) ; porter ça sur mobile demanderait de gérer un deep-link de retour dans l'app Expo, sujet distinct non traité ici. L'ajout de banque reste une action web-only.

## Gestion des erreurs et états vides

Pas de _loader_/`errorComponent` façon TanStack Router côté mobile : chaque écran gère directement les états `isPending`/`isError`/données vides de React Query (spinner gluestack-ui pendant le chargement, message + action "réessayer" en cas d'erreur, état vide textuel si liste vide — même esprit que le web). Erreur de mutation (sync, changement de catégorie) : Toast d'erreur, sans bloquer l'UI — même logique que les `catch` déjà présents dans `SyncButton`/`CategoryCell` côté web.

## Tests et validation

- Pas de précédent de tests de composants React Native dans ce repo (seul `@budget/api` a des tests Vitest ; `apps/expo` n'a aucun script `test`). Pas de nouveau setup de test de composants introduit dans ce projet.
- Toute logique pure extraite (formatage, transformation de données) reste testable en Vitest si elle apparaît.
- Validation fonctionnelle par test manuel via Expo Go/simulateur (`pnpm -F @budget/expo dev`) — pas de claim de fonctionnement sans l'avoir vérifié à l'écran.

## Dark mode et accessibilité

Hérités des tokens `@budget/tailwind-config/theme` déjà en place (le placeholder gère déjà `useColorScheme` pour le header du `Stack`). Pas de travail spécifique prévu au-delà de vérifier que les composants gluestack-ui respectent bien ces tokens une fois le thème mappé.

## Hors scope (rappel)

- Partage de composants avec le web (voir décision d'architecture ci-dessus).
- Ajout d'une nouvelle connexion bancaire (wizard OAuth) depuis le mobile.
- Nouveau framework de test de composants RN.
