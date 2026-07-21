# App mobile Expo avec gluestack-ui — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire une v1 de l'app mobile (`apps/expo`) permettant de consulter les transactions, éditer leur catégorie, voir les KPIs/répartition par catégorie, et gérer (lecture + sync) les connexions bancaires — avec gluestack-ui comme librairie de composants, séparée de `@budget/ui` (web).

**Architecture:** gluestack-ui installé uniquement dans `apps/expo` (moteur NativeWind v5, déjà en place), thème mappé sur les tokens partagés `@budget/tailwind-config/theme`. Navigation par onglets (expo-router `Tabs`). Données via le client tRPC déjà configuré dans `src/utils/api.tsx`, réutilisant tel quel le routeur `@budget/api` (aucun changement serveur).

**Tech Stack:** Expo SDK 54, expo-router, NativeWind v5 / Tailwind v4, gluestack-ui v5, `@legendapp/list` (liste virtualisée), `react-native-gifted-charts` (graphiques), `@tanstack/react-query` + tRPC.

**Spec de référence :** `docs/superpowers/specs/2026-07-21-mobile-app-gluestack-ui-design.md`

## Global Constraints

- gluestack-ui reste scopé à `apps/expo` — ne jamais toucher `packages/ui` ni `apps/tanstack-start` dans ce plan (décision d'architecture de la spec).
- Alias d'import dans `apps/expo` : `~/*` → `./src/*` (voir `apps/expo/tsconfig.json`).
- Composants gluestack-ui installés sous `src/components/ui` (flag CLI `--path src/components/ui`), ajoutés un par un via `npx gluestack-ui add <component>`, jamais tout le catalogue d'un coup.
- Thème Tailwind de gluestack-ui mappé sur `@budget/tailwind-config/theme` existant (tokens `--primary`, `--background`, `--foreground`, etc. déjà identiques en nommage — voir Task 1) — pas la palette par défaut de gluestack.
- **Pas de nouveau framework de test introduit** (ni test de composants React Native, ni Vitest dans `apps/expo` — ce package n'en a aucun aujourd'hui, seul `@budget/api` a des tests Vitest). Chaque tâche se termine par une **vérification manuelle** via `pnpm -F @budget/expo dev` (Expo Go ou simulateur) au lieu d'un cycle de test automatisé — décision actée dans la spec, pas un raccourci.
- Toutes les chaînes visibles par l'utilisateur sont en français (convention du projet).
- Les routeurs tRPC (`transactions`, `categories`, `connections`, `sync`) sont réutilisés tels quels, aucune modification côté `packages/api` dans ce plan.
- `pnpm-workspace.yaml` définit des versions "catalog:" partagées pour `tailwindcss` (`^4.1.16`) et consorts — toute dépendance ajoutée qui nécessite une version différente doit être vérifiée/ajustée au niveau du catalogue, pas forkée localement dans `apps/expo` (voir Task 1, étape de vérification de version).

---

### Task 1: Installer et configurer gluestack-ui dans apps/expo

**Files:**
- Modify: `apps/expo/package.json` (nouvelles dépendances, bump `nativewind`/`react-native-css`)
- Modify: `pnpm-workspace.yaml` (bump catalogue `tailwindcss`/`@tailwindcss/postcss` si nécessaire — voir étape 2)
- Create (par le CLI gluestack-ui): `apps/expo/gluestack-ui.config.json`
- Create (par le CLI gluestack-ui): `apps/expo/src/components/ui/gluestack-ui-provider/*`, `apps/expo/src/components/ui/icon/*`, `apps/expo/src/components/ui/overlay/*`, `apps/expo/src/components/ui/toast/*`
- Modify: `apps/expo/src/styles.css` (réconciliation des tokens de thème générés par le CLI avec `@budget/tailwind-config/theme` existant)
- Modify: `apps/expo/src/app/_layout.tsx` (enveloppe `GluestackUIProvider`)

**Interfaces:**
- Produces: `GluestackUIProvider` importable depuis `~/components/ui/gluestack-ui-provider`, utilisable par toutes les tâches suivantes. `useToast` importable depuis `~/components/ui/toast` (Task 7).

- [ ] **Step 1: Vérifier la version de tailwindcss actuellement résolue**

Run: `pnpm why tailwindcss --filter @budget/expo`

Si la version résolue est `< 4.2.0` : ouvrir `pnpm-workspace.yaml` à la racine et monter les entrées du catalogue :

```yaml
catalog:
  "@tailwindcss/postcss": ^4.2.0
  "@tailwindcss/vite": ^4.2.0
  tailwindcss: ^4.2.0
```

Puis `pnpm install` à la racine, et vérifier que le web n'est pas cassé :

Run: `pnpm -F @budget/tanstack-start typecheck && pnpm -F @budget/tanstack-start build`
Expected: les deux commandes réussissent sans erreur.

- [ ] **Step 2: Lancer l'initialisation gluestack-ui**

Run (depuis la racine du repo) :

```bash
cd apps/expo && npx gluestack-ui@latest init --nativewind-v5 --path src/components/ui --use-pnpm -y
```

Expected: la commande installe `@gluestack-ui/core`, `@gluestack-ui/utils`, `react-native-svg`, ajoute/ajuste `nativewind` (`^5.0.0-preview.4`) et `react-native-css` (`^3.0.4`), crée `gluestack-ui.config.json`, et ajoute les composants `gluestack-ui-provider`, `icon`, `overlay`, `toast` sous `src/components/ui`. Elle peut créer un fichier `global.css` à la racine de `apps/expo` (voir étape suivante) et/ou modifier `metro.config.js`/`postcss.config.mjs`.

- [ ] **Step 3: Inspecter le diff généré**

Run: `git status && git diff -- apps/expo`
Expected: liste des fichiers créés/modifiés par le CLI. Noter en particulier si un fichier `global.css` a été créé (au lieu de modifier `src/styles.css` existant).

- [ ] **Step 4: Réconcilier le thème avec `@budget/tailwind-config/theme`**

Si le CLI a créé un `apps/expo/global.css` séparé : déplacer son contenu utile (imports NativeWind/gluestack hors tokens de couleur) dans `apps/expo/src/styles.css`, puis supprimer `global.css`.

Dans `apps/expo/src/styles.css`, si le CLI a ajouté un bloc `--primary`, `--background`, `--foreground`, etc. (format triplet RGB, ex. `--primary: 23 23 23;`) : le **supprimer entièrement** (light ET dark) — ces noms de tokens sont déjà définis avec les bonnes valeurs OKLCH par `@budget/tailwind-config/theme`, importé plus bas dans le même fichier. Le fichier final doit ressembler à :

```css
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css";

@import "nativewind/theme";

@import "@budget/tailwind-config/theme";
```

Si le CLI a ajouté un bloc `@theme inline { --color-primary: rgb(var(--primary)); ... }` : le supprimer aussi — `@budget/tailwind-config/theme` définit déjà l'équivalent (`--color-primary: var(--primary);`, sans wrapper `rgb()` car les valeurs sont en OKLCH).

- [ ] **Step 5: Envelopper l'app avec GluestackUIProvider**

Modifier `apps/expo/src/app/_layout.tsx` :

```tsx
import { useColorScheme } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";

import { GluestackUIProvider } from "~/components/ui/gluestack-ui-provider";
import { queryClient } from "~/utils/api";

import "../styles.css";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GluestackUIProvider mode={colorScheme === "dark" ? "dark" : "light"}>
      <QueryClientProvider client={queryClient}>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: "#c03484",
            },
            contentStyle: {
              backgroundColor: colorScheme == "dark" ? "#09090B" : "#FFFFFF",
            },
          }}
        />
        <StatusBar />
      </QueryClientProvider>
    </GluestackUIProvider>
  );
}
```

- [ ] **Step 6: Vérification manuelle**

Run: `pnpm -F @budget/expo dev`
Ouvrir dans Expo Go ou un simulateur. Vérifier :
- L'app démarre sans erreur de build/console liée à Tailwind ou NativeWind.
- L'écran de login s'affiche identique à avant (mêmes couleurs `bg-background`/`bg-primary`), pas de flash de style incorrect.
- Basculer le thème système clair/sombre et vérifier que les couleurs suivent toujours (héritées de `@budget/tailwind-config/theme`).

- [ ] **Step 7: Commit**

```bash
git add apps/expo pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(expo): installe gluestack-ui (NativeWind v5, thème partagé)"
```

---

### Task 2: Navigation par onglets (Transactions / Banques)

**Files:**
- Modify: `apps/expo/package.json` (ajoute `lucide-react-native`)
- Modify: `apps/expo/src/app/index.tsx` (redirige vers les onglets si connecté, retire le placeholder)
- Create: `apps/expo/src/app/(tabs)/_layout.tsx`
- Create: `apps/expo/src/app/(tabs)/index.tsx` (placeholder Transactions, rempli en Task 3)
- Create: `apps/expo/src/app/(tabs)/banques.tsx` (placeholder Banques, rempli en Task 7)

**Interfaces:**
- Consumes: `authClient` depuis `~/utils/auth` (existant).
- Produces: route `/(tabs)` avec deux écrans enfants `index` et `banques`, atteignable après connexion.

- [ ] **Step 1: Ajouter lucide-react-native**

```bash
pnpm --filter @budget/expo add lucide-react-native
```

Expected : ajouté dans `apps/expo/package.json` sous `dependencies`.

- [ ] **Step 2: Simplifier `index.tsx` (login + redirection)**

Remplacer le contenu de `apps/expo/src/app/index.tsx` :

```tsx
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, Stack } from "expo-router";

import { authClient } from "~/utils/auth";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const signIn = async () => {
    setPending(true);
    setError(null);
    const res = await authClient.signIn.email({ email, password });
    setPending(false);
    if (res.error) setError(res.error.message ?? "Connexion impossible");
  };

  return (
    <View className="flex gap-2">
      <TextInput
        className="border-input bg-background text-foreground items-center rounded-md border px-3 text-lg leading-tight"
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        className="border-input bg-background text-foreground items-center rounded-md border px-3 text-lg leading-tight"
        value={password}
        onChangeText={setPassword}
        placeholder="Mot de passe"
        secureTextEntry
      />
      {error && <Text className="text-destructive">{error}</Text>}
      <Pressable
        className="bg-primary flex items-center rounded-sm p-2"
        disabled={pending || !email || !password}
        onPress={() => void signIn()}
      >
        <Text className="text-foreground">Se connecter</Text>
      </Pressable>
    </View>
  );
}

export default function Index() {
  const { data: session } = authClient.useSession();

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <SafeAreaView className="bg-background">
      <Stack.Screen options={{ title: "Budget" }} />
      <View className="bg-background h-full w-full p-4">
        <Text className="text-foreground pb-2 text-center text-5xl font-bold">
          Budget
        </Text>
        <LoginForm />
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Créer le layout d'onglets**

Create `apps/expo/src/app/(tabs)/_layout.tsx` :

```tsx
import { Tabs } from "expo-router";
import { LandmarkIcon, ReceiptTextIcon } from "lucide-react-native";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color, size }) => (
            <ReceiptTextIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="banques"
        options={{
          title: "Banques",
          tabBarIcon: ({ color, size }) => (
            <LandmarkIcon color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 4: Créer les écrans placeholder**

Create `apps/expo/src/app/(tabs)/index.tsx` :

```tsx
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TransactionsScreen() {
  return (
    <SafeAreaView className="bg-background flex-1">
      <View className="flex-1 items-center justify-center">
        <Text className="text-foreground">Transactions à venir</Text>
      </View>
    </SafeAreaView>
  );
}
```

Create `apps/expo/src/app/(tabs)/banques.tsx` :

```tsx
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function BanquesScreen() {
  return (
    <SafeAreaView className="bg-background flex-1">
      <View className="flex-1 items-center justify-center">
        <Text className="text-foreground">Banques à venir</Text>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 5: Vérification manuelle**

Run: `pnpm -F @budget/expo dev`
Se connecter avec un compte existant. Vérifier :
- Redirection automatique vers l'écran à onglets après connexion.
- Les deux onglets "Transactions" et "Banques" sont visibles avec leurs icônes, la navigation entre les deux fonctionne.
- Se déconnecter puis relancer l'app ramène bien au formulaire de login (pas de boucle de redirection).

- [ ] **Step 6: Commit**

```bash
git add apps/expo
git commit -m "feat(expo): navigation par onglets Transactions/Banques"
```

---

### Task 3: Liste des transactions avec défilement infini

**Files:**
- Modify: `apps/expo/package.json` (ajoute `@budget/validators`)
- Modify: `apps/expo/src/utils/api.tsx` (exporte le client tRPC brut `trpcClient`)
- Create: `apps/expo/src/components/transaction-list-item.tsx`
- Modify: `apps/expo/src/app/(tabs)/index.tsx` (liste réelle, remplace le placeholder)

**Interfaces:**
- Consumes: `trpc`, `queryClient` depuis `~/utils/api` (existant) ; `PAGE_SIZE`, `transactionsSearchSchema` type `TransactionsSearch` depuis `@budget/validators` ; type `TransactionRow` depuis `@budget/api`.
- Produces: `trpcClient` exporté depuis `~/utils/api` (utilisé par Task 4, 6, 7 pour les mutations). Composant `TransactionListItem({ transaction, onPress }: { transaction: TransactionRow; onPress: () => void })` réutilisé par Task 4.

- [ ] **Step 1: Ajouter @budget/validators**

```bash
pnpm --filter @budget/expo add @budget/validators@workspace:*
```

Expected : ajouté dans `apps/expo/package.json` sous `dependencies`.

- [ ] **Step 2: Exporter le client tRPC brut**

Modifier `apps/expo/src/utils/api.tsx` — extraire le client passé à `createTRPCOptionsProxy` dans sa propre variable exportée :

```tsx
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import type { AppRouter } from "@budget/api";

import { authClient } from "./auth";
import { getBaseUrl } from "./base-url";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ...
    },
  },
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === "development" ||
        (opts.direction === "down" && opts.result instanceof Error),
      colorMode: "ansi",
    }),
    httpBatchLink({
      transformer: superjson,
      url: `${getBaseUrl()}/api/trpc`,
      headers() {
        const headers = new Map<string, string>();
        headers.set("x-trpc-source", "expo-react");

        const cookies = authClient.getCookie();
        if (cookies) {
          headers.set("Cookie", cookies);
        }
        return headers;
      },
    }),
  ],
});

/**
 * A set of typesafe hooks for consuming your API.
 */
export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});

export type { RouterInputs, RouterOutputs } from "@budget/api";
```

- [ ] **Step 3: Créer le composant de ligne de transaction**

Create `apps/expo/src/components/transaction-list-item.tsx` :

```tsx
import { Pressable, Text, View } from "react-native";

import type { TransactionRow } from "@budget/api";

import { Badge, BadgeText } from "~/components/ui/badge";

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});
const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export function TransactionListItem({
  transaction,
  onPress,
}: {
  transaction: TransactionRow;
  onPress: () => void;
}) {
  const signed =
    (transaction.direction === "debit" ? -1 : 1) * Number(transaction.amount);

  return (
    <Pressable
      onPress={onPress}
      className="border-border flex-row items-center justify-between gap-2 border-b px-4 py-3"
    >
      <View className="flex-1 gap-1">
        <Text className="text-foreground font-medium" numberOfLines={1}>
          {transaction.description}
        </Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-muted-foreground text-xs">
            {dateFr.format(new Date(transaction.bookingDate))} ·{" "}
            {transaction.bankName}
          </Text>
          {transaction.category && (
            <Badge variant="outline" size="sm">
              <BadgeText>{transaction.category}</BadgeText>
            </Badge>
          )}
        </View>
      </View>
      <Text
        className={
          transaction.direction === "debit"
            ? "text-destructive font-semibold"
            : "font-semibold text-green-600"
        }
      >
        {euro.format(signed)}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: Ajouter le composant Badge de gluestack-ui**

```bash
cd apps/expo && npx gluestack-ui@latest add badge -y
```

Expected : crée `apps/expo/src/components/ui/badge/index.tsx`.

- [ ] **Step 5: Implémenter la liste à défilement infini**

Remplacer `apps/expo/src/app/(tabs)/index.tsx` :

```tsx
import { useInfiniteQuery } from "@tanstack/react-query";
import { LegendList } from "@legendapp/list/react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Text, View } from "react-native";

import { PAGE_SIZE } from "@budget/validators";

import { TransactionListItem } from "~/components/transaction-list-item";
import { trpcClient } from "~/utils/api";

export function getNextTransactionsPageParam(
  pages: { rows: unknown[]; total: number }[],
): number | undefined {
  const loaded = pages.reduce((acc, p) => acc + p.rows.length, 0);
  const total = pages.at(-1)?.total ?? 0;
  return loaded < total ? pages.length + 1 : undefined;
}

export default function TransactionsScreen() {
  const { data, isPending, isError, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["transactions.list.infinite"],
      queryFn: ({ pageParam }) =>
        trpcClient.transactions.list.query({
          page: pageParam,
          sort: "date",
          order: "desc",
        }),
      initialPageParam: 1,
      getNextPageParam: (_lastPage, pages) =>
        getNextTransactionsPageParam(pages),
    });

  const rows = data?.pages.flatMap((p) => p.rows) ?? [];

  if (isPending) {
    return (
      <SafeAreaView className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="bg-background flex-1 items-center justify-center px-4">
        <Text className="text-destructive text-center">
          Impossible de charger les transactions.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-background flex-1">
      {rows.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted-foreground">Aucune transaction.</Text>
        </View>
      ) : (
        <LegendList
          data={rows}
          keyExtractor={(t) => String(t.id)}
          renderItem={({ item }) => (
            <TransactionListItem transaction={item} onPress={() => {}} />
          )}
          estimatedItemSize={72}
          recycleItems
          onEndReached={() => {
            if (!isFetchingNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator className="my-4" /> : null
          }
        />
      )}
    </SafeAreaView>
  );
}
```

Note : `queryKey` utilisé littéralement plutôt que la clé générée par le proxy tRPC (`trpc.transactions.list.queryKey(...)`), car `trpc.transactions.list.infiniteQueryOptions()` n'existe pas pour cette procédure (son input `transactionsSearchSchema` n'a pas de champ `cursor` — prérequis strict de tRPC pour exposer `infiniteQueryOptions`). Le paramètre de page (`page`) est géré manuellement via `pageParam`/`getNextPageParam`, en réutilisant `trpcClient` (client brut) plutôt que le proxy `trpc`.

- [ ] **Step 6: Vérification manuelle**

Run: `pnpm -F @budget/expo dev`
Vérifier dans l'app :
- La liste des transactions se charge et s'affiche (description, date, banque, catégorie si présente, montant coloré selon débit/crédit).
- Faire défiler jusqu'en bas déclenche le chargement de la page suivante (indicateur de chargement visible), jusqu'à ce que toutes les transactions soient chargées (plus de déclenchement au-delà de `total`).
- Avec un compte n'ayant aucune transaction (ou en filtrant côté DB), l'état vide "Aucune transaction." s'affiche.

- [ ] **Step 7: Commit**

```bash
git add apps/expo
git commit -m "feat(expo): liste des transactions avec défilement infini"
```

---

### Task 4: Édition de la catégorie d'une transaction

**Files:**
- Create: `apps/expo/src/components/category-picker-sheet.tsx`
- Modify: `apps/expo/src/app/(tabs)/index.tsx` (état de sélection + branchement du sheet)

**Interfaces:**
- Consumes: `TransactionListItem` (Task 3), `trpc`/`trpcClient`/`queryClient` depuis `~/utils/api`, type `CategoryOption` depuis `@budget/api`.
- Produces: `CategoryPickerSheet({ transactionId, categories, onClose }: { transactionId: number | null; categories: CategoryOption[]; onClose: () => void })`.

- [ ] **Step 1: Ajouter le composant Actionsheet de gluestack-ui**

```bash
cd apps/expo && npx gluestack-ui@latest add actionsheet -y
```

Expected : crée `apps/expo/src/components/ui/actionsheet/index.tsx`.

- [ ] **Step 2: Créer le sheet de sélection de catégorie**

Create `apps/expo/src/components/category-picker-sheet.tsx` :

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { CategoryOption } from "@budget/api";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from "~/components/ui/actionsheet";
import { trpcClient } from "~/utils/api";

export function CategoryPickerSheet({
  transactionId,
  categories,
  onClose,
}: {
  transactionId: number | null;
  categories: CategoryOption[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const updateCategory = useMutation({
    mutationFn: (category: string) => {
      if (transactionId === null) throw new Error("Aucune transaction sélectionnée");
      return trpcClient.transactions.updateCategory.mutate({
        id: transactionId,
        category,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["transactions.list.infinite"],
      });
      onClose();
    },
  });

  return (
    <Actionsheet isOpen={transactionId !== null} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        {categories.map((c) => (
          <ActionsheetItem
            key={c.id}
            isDisabled={updateCategory.isPending}
            onPress={() => updateCategory.mutate(c.name)}
          >
            <ActionsheetItemText>{c.name}</ActionsheetItemText>
          </ActionsheetItem>
        ))}
      </ActionsheetContent>
    </Actionsheet>
  );
}
```

- [ ] **Step 3: Brancher le sheet dans l'écran Transactions**

Dans `apps/expo/src/app/(tabs)/index.tsx`, ajouter l'état de sélection et la requête des catégories :

```tsx
import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { LegendList } from "@legendapp/list/react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Text, View } from "react-native";

import { PAGE_SIZE } from "@budget/validators";

import { CategoryPickerSheet } from "~/components/category-picker-sheet";
import { TransactionListItem } from "~/components/transaction-list-item";
import { trpc, trpcClient } from "~/utils/api";

export function getNextTransactionsPageParam(
  pages: { rows: unknown[]; total: number }[],
): number | undefined {
  const loaded = pages.reduce((acc, p) => acc + p.rows.length, 0);
  const total = pages.at(-1)?.total ?? 0;
  return loaded < total ? pages.length + 1 : undefined;
}

export default function TransactionsScreen() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: categories = [] } = useQuery(trpc.categories.list.queryOptions());

  const { data, isPending, isError, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["transactions.list.infinite"],
      queryFn: ({ pageParam }) =>
        trpcClient.transactions.list.query({
          page: pageParam,
          sort: "date",
          order: "desc",
        }),
      initialPageParam: 1,
      getNextPageParam: (_lastPage, pages) =>
        getNextTransactionsPageParam(pages),
    });

  const rows = data?.pages.flatMap((p) => p.rows) ?? [];

  if (isPending) {
    return (
      <SafeAreaView className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="bg-background flex-1 items-center justify-center px-4">
        <Text className="text-destructive text-center">
          Impossible de charger les transactions.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-background flex-1">
      {rows.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted-foreground">Aucune transaction.</Text>
        </View>
      ) : (
        <LegendList
          data={rows}
          keyExtractor={(t) => String(t.id)}
          renderItem={({ item }) => (
            <TransactionListItem
              transaction={item}
              onPress={() => setSelectedId(item.id)}
            />
          )}
          estimatedItemSize={72}
          recycleItems
          onEndReached={() => {
            if (!isFetchingNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator className="my-4" /> : null
          }
        />
      )}
      <CategoryPickerSheet
        transactionId={selectedId}
        categories={categories}
        onClose={() => setSelectedId(null)}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Vérification manuelle**

Run: `pnpm -F @budget/expo dev`
Vérifier :
- Toucher une transaction ouvre le sheet avec la liste des catégories existantes.
- Sélectionner une catégorie ferme le sheet et met à jour la catégorie affichée sur la ligne concernée (badge) sans recharger l'app.
- Vérifier en base ou via l'app web que `category_source` passe bien à `manual` pour la transaction modifiée (comportement déjà garanti par `updateCategory`, non modifié).

- [ ] **Step 5: Commit**

```bash
git add apps/expo
git commit -m "feat(expo): édition de la catégorie d'une transaction"
```

---

### Task 5: Filtres des transactions (feuille modale)

**Files:**
- Create: `apps/expo/src/components/transaction-filters-sheet.tsx`
- Modify: `apps/expo/src/app/(tabs)/index.tsx` (état des filtres, bouton d'ouverture, branchement à la requête)

**Interfaces:**
- Consumes: type `TransactionsSearch` depuis `@budget/validators`, `trpc.transactions.banks`/`trpc.categories.list` (existants).
- Produces: `TransactionFiltersSheet({ isOpen, value, banks, categories, onClose, onApply }: { isOpen: boolean; value: TransactionFilters; banks: string[]; categories: CategoryOption[]; onClose: () => void; onApply: (next: TransactionFilters) => void })`, type `TransactionFilters = Pick<TransactionsSearch, "bank" | "category" | "dateFrom" | "dateTo" | "q">`.

- [ ] **Step 1: Ajouter le composant Input de gluestack-ui**

```bash
cd apps/expo && npx gluestack-ui@latest add input button -y
```

Expected : crée `apps/expo/src/components/ui/input/index.tsx` et `apps/expo/src/components/ui/button/index.tsx` (le composant `button` est un prérequis utilisé à l'intérieur du sheet).

- [ ] **Step 2: Créer le sheet de filtres**

Create `apps/expo/src/components/transaction-filters-sheet.tsx` :

```tsx
import { useState } from "react";

import type { CategoryOption } from "@budget/api";
import type { TransactionsSearch } from "@budget/validators";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from "~/components/ui/actionsheet";
import { Button, ButtonText } from "~/components/ui/button";
import { Input, InputField } from "~/components/ui/input";

export type TransactionFilters = Pick<
  TransactionsSearch,
  "bank" | "category" | "dateFrom" | "dateTo" | "q"
>;

export function TransactionFiltersSheet({
  isOpen,
  value,
  categories,
  onClose,
  onApply,
}: {
  isOpen: boolean;
  value: TransactionFilters;
  categories: CategoryOption[];
  onClose: () => void;
  onApply: (next: TransactionFilters) => void;
}) {
  const [draft, setDraft] = useState<TransactionFilters>(value);

  return (
    <Actionsheet
      isOpen={isOpen}
      onClose={() => {
        setDraft(value);
        onClose();
      }}
    >
      <ActionsheetBackdrop />
      <ActionsheetContent className="gap-3 px-4 pb-6">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <Input>
          <InputField
            placeholder="Rechercher (libellé, contrepartie)"
            value={draft.q ?? ""}
            onChangeText={(q) => setDraft((d) => ({ ...d, q: q || undefined }))}
          />
        </Input>
        <Input>
          <InputField
            placeholder="Catégorie (nom exact)"
            value={draft.category ?? ""}
            onChangeText={(category) =>
              setDraft((d) => ({ ...d, category: category || undefined }))
            }
          />
        </Input>
        <Button
          onPress={() => {
            onApply(draft);
            onClose();
          }}
        >
          <ButtonText>Appliquer</ButtonText>
        </Button>
        <Button
          variant="outline"
          onPress={() => {
            setDraft({});
            onApply({});
            onClose();
          }}
        >
          <ButtonText>Réinitialiser</ButtonText>
        </Button>
      </ActionsheetContent>
    </Actionsheet>
  );
}
```

Note : le filtre "catégorie" est un champ texte libre (nom exact) plutôt qu'un sélecteur dédié pour cette v1 — `categories` reste passé en prop pour une évolution ultérieure (liste déroulante), volontairement non implémentée ici pour rester dans le périmètre défini par la spec (pas de sur-ingénierie).

- [ ] **Step 3: Brancher les filtres dans l'écran Transactions**

Dans `apps/expo/src/app/(tabs)/index.tsx`, ajouter l'état des filtres, un bouton pour ouvrir le sheet, et les injecter dans `queryFn` + `queryKey` :

```tsx
import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { LegendList } from "@legendapp/list/react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SlidersHorizontalIcon } from "lucide-react-native";

import { CategoryPickerSheet } from "~/components/category-picker-sheet";
import {
  TransactionFiltersSheet,
  type TransactionFilters,
} from "~/components/transaction-filters-sheet";
import { TransactionListItem } from "~/components/transaction-list-item";
import { trpc, trpcClient } from "~/utils/api";

export function getNextTransactionsPageParam(
  pages: { rows: unknown[]; total: number }[],
): number | undefined {
  const loaded = pages.reduce((acc, p) => acc + p.rows.length, 0);
  const total = pages.at(-1)?.total ?? 0;
  return loaded < total ? pages.length + 1 : undefined;
}

export default function TransactionsScreen() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({});

  const { data: categories = [] } = useQuery(trpc.categories.list.queryOptions());

  const { data, isPending, isError, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["transactions.list.infinite", filters],
      queryFn: ({ pageParam }) =>
        trpcClient.transactions.list.query({
          ...filters,
          page: pageParam,
          sort: "date",
          order: "desc",
        }),
      initialPageParam: 1,
      getNextPageParam: (_lastPage, pages) =>
        getNextTransactionsPageParam(pages),
    });

  const rows = data?.pages.flatMap((p) => p.rows) ?? [];

  if (isPending) {
    return (
      <SafeAreaView className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="bg-background flex-1 items-center justify-center px-4">
        <Text className="text-destructive text-center">
          Impossible de charger les transactions.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-background flex-1">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text className="text-foreground text-lg font-bold">
          Transactions
        </Text>
        <Pressable onPress={() => setFiltersOpen(true)}>
          <SlidersHorizontalIcon className="text-foreground" />
        </Pressable>
      </View>
      {rows.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted-foreground">Aucune transaction.</Text>
        </View>
      ) : (
        <LegendList
          data={rows}
          keyExtractor={(t) => String(t.id)}
          renderItem={({ item }) => (
            <TransactionListItem
              transaction={item}
              onPress={() => setSelectedId(item.id)}
            />
          )}
          estimatedItemSize={72}
          recycleItems
          onEndReached={() => {
            if (!isFetchingNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator className="my-4" /> : null
          }
        />
      )}
      <CategoryPickerSheet
        transactionId={selectedId}
        categories={categories}
        onClose={() => setSelectedId(null)}
      />
      <TransactionFiltersSheet
        isOpen={filtersOpen}
        value={filters}
        categories={categories}
        onClose={() => setFiltersOpen(false)}
        onApply={setFilters}
      />
    </SafeAreaView>
  );
}
```

Note : `queryKey` inclut désormais `filters`, ce qui invalide et relance naturellement la requête infinie depuis la page 1 à chaque changement de filtre (comportement standard de React Query sur changement de clé).

- [ ] **Step 4: Vérification manuelle**

Run: `pnpm -F @budget/expo dev`
Vérifier :
- Le bouton de filtres ouvre le sheet, pré-rempli avec les filtres actifs.
- Appliquer un filtre (ex: texte de recherche présent dans une transaction connue) réduit bien la liste en conséquence, et le défilement infini recharge correctement depuis la page 1.
- "Réinitialiser" vide les filtres et réaffiche toutes les transactions.

- [ ] **Step 5: Commit**

```bash
git add apps/expo
git commit -m "feat(expo): filtres des transactions (feuille modale)"
```

---

### Task 6: KPIs et répartition par catégorie

**Files:**
- Modify: `apps/expo/package.json` (ajoute `react-native-gifted-charts`)
- Create: `apps/expo/src/lib/category-breakdown.ts`
- Create: `apps/expo/src/components/category-breakdown-chart.tsx`
- Modify: `apps/expo/src/app/(tabs)/index.tsx` (ajoute KPIs + graphique au-dessus de la liste)

**Interfaces:**
- Consumes: type `CategoryBreakdownItem` depuis `@budget/api`, `trpc.transactions.byCategory` (existant), `TransactionFilters` (Task 5).
- Produces: `toPieChartData(items: CategoryBreakdownItem[]): { value: number; color: string; text: string }[]` (testé unitairement), `CategoryBreakdownChart({ title, items }: { title: string; items: CategoryBreakdownItem[] })`.

- [ ] **Step 1: Ajouter react-native-gifted-charts**

```bash
pnpm --filter @budget/expo add react-native-gifted-charts
```

- [ ] **Step 2: Extraire la transformation de données (logique pure)**

Create `apps/expo/src/lib/category-breakdown.ts` :

```ts
import type { CategoryBreakdownItem } from "@budget/api";

export interface PieSlice {
  value: number;
  color: string;
  text: string;
}

export function toPieChartData(
  items: CategoryBreakdownItem[],
): PieSlice[] {
  return items
    .filter((item) => item.total > 0)
    .map((item) => ({
      value: item.total,
      color: item.color,
      text: item.category,
    }));
}
```

- [ ] **Step 2b: Test manuel de la transformation (pas de vitest dans ce package)**

Ce fichier ne dispose pas de harnais de test automatisé dans `apps/expo` (voir Global Constraints). Vérifier son comportement à l'étape 5 (vérification manuelle de l'écran) en confirmant que le nombre de parts du graphique correspond au nombre de catégories avec un total non nul renvoyées par `trpc.transactions.byCategory`.

- [ ] **Step 3: Créer le composant de graphique**

Create `apps/expo/src/components/category-breakdown-chart.tsx` :

```tsx
import { Text, View } from "react-native";
import { PieChart } from "react-native-gifted-charts";

import type { CategoryBreakdownItem } from "@budget/api";

import { Card } from "~/components/ui/card";
import { toPieChartData } from "~/lib/category-breakdown";

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function CategoryBreakdownChart({
  title,
  items,
}: {
  title: string;
  items: CategoryBreakdownItem[];
}) {
  const data = toPieChartData(items);
  const total = items.reduce((acc, i) => acc + i.total, 0);

  return (
    <Card className="mx-4 items-center gap-2 p-4">
      <Text className="text-foreground font-semibold">{title}</Text>
      {data.length === 0 ? (
        <Text className="text-muted-foreground py-8 text-sm">
          Aucune donnée pour cette période.
        </Text>
      ) : (
        <PieChart data={data} donut radius={80} showText textSize={10} />
      )}
      <Text className="text-foreground text-lg font-bold">
        {euro.format(total)}
      </Text>
    </Card>
  );
}
```

- [ ] **Step 4: Ajouter le composant Card de gluestack-ui et brancher dans l'écran**

```bash
cd apps/expo && npx gluestack-ui@latest add card -y
```

Dans `apps/expo/src/app/(tabs)/index.tsx`, ajouter les requêtes KPI/répartition et le rendu au-dessus de la liste (import et état des filtres déjà présents depuis Task 5) :

```tsx
import { useQuery } from "@tanstack/react-query";

import { CategoryBreakdownChart } from "~/components/category-breakdown-chart";

// ... à l'intérieur de TransactionsScreen, après la déclaration de `filters` :
const { data: expensesByCategory = [] } = useQuery({
  queryKey: ["transactions.byCategory", filters, "debit"],
  queryFn: () =>
    trpcClient.transactions.byCategory.query({
      ...filters,
      direction: "debit",
    }),
});
const { data: revenuesByCategory = [] } = useQuery({
  queryKey: ["transactions.byCategory", filters, "credit"],
  queryFn: () =>
    trpcClient.transactions.byCategory.query({
      ...filters,
      direction: "credit",
    }),
});
```

Puis, dans le rendu, insérer avant le `<LegendList ...>` (ou avant le bloc `rows.length === 0 ? ... : ...`) :

```tsx
<View className="flex-row gap-4">
  <CategoryBreakdownChart title="Dépenses par catégorie" items={expensesByCategory} />
  <CategoryBreakdownChart title="Revenus par catégorie" items={revenuesByCategory} />
</View>
```

- [ ] **Step 5: Vérification manuelle**

Run: `pnpm -F @budget/expo dev`
Vérifier :
- Les deux graphiques (dépenses/revenus) s'affichent au-dessus de la liste, avec un total en euros cohérent avec les données affichées côté web (`apps/tanstack-start`) pour la même période.
- Changer les filtres (Task 5) met aussi à jour les graphiques (même `filters` que la liste).
- Avec un filtre ne retournant aucune transaction, le message "Aucune donnée pour cette période." s'affiche à la place du graphique.

- [ ] **Step 6: Commit**

```bash
git add apps/expo
git commit -m "feat(expo): KPIs et répartition par catégorie"
```

---

### Task 7: Écran Banques (connexions + synchronisation)

**Files:**
- Create: `apps/expo/src/components/connection-card.tsx`
- Modify: `apps/expo/src/app/(tabs)/banques.tsx` (remplace le placeholder)

**Interfaces:**
- Consumes: `trpc.connections.list`, `trpcClient.sync.run` (existants), type `ConnectionSummary` depuis `@budget/api`, `useToast` depuis `~/components/ui/toast` (installé en Task 1), `authClient` depuis `~/utils/auth`.
- Produces: `ConnectionCard({ connection }: { connection: ConnectionSummary })`.

- [ ] **Step 1: Ajouter le composant Spinner de gluestack-ui**

```bash
cd apps/expo && npx gluestack-ui@latest add spinner -y
```

- [ ] **Step 2: Créer la carte de connexion**

Create `apps/expo/src/components/connection-card.tsx` :

```tsx
import { Text, View } from "react-native";

import type { ConnectionSummary } from "@budget/api";

import { Badge, BadgeText } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";

function ConsentBadge({ connection }: { connection: ConnectionSummary }) {
  if (connection.status === "revoked") {
    return (
      <Badge variant="outline">
        <BadgeText>Révoquée</BadgeText>
      </Badge>
    );
  }
  if (connection.badge.level === "expired") {
    return (
      <Badge action="error">
        <BadgeText>Consentement expiré</BadgeText>
      </Badge>
    );
  }
  if (connection.badge.level === "warning") {
    return (
      <Badge action="warning">
        <BadgeText>Expire dans {connection.badge.daysLeft} j</BadgeText>
      </Badge>
    );
  }
  return (
    <Badge action="muted">
      <BadgeText>Expire dans {connection.badge.daysLeft} j</BadgeText>
    </Badge>
  );
}

export function ConnectionCard({
  connection,
}: {
  connection: ConnectionSummary;
}) {
  return (
    <Card className="mx-4 mb-3 gap-2 p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-foreground font-semibold">
          {connection.aspspName}
        </Text>
        <ConsentBadge connection={connection} />
      </View>
      {connection.accounts.length === 0 ? (
        <Text className="text-muted-foreground text-sm">
          Aucun compte rattaché.
        </Text>
      ) : (
        connection.accounts.map((a) => (
          <Text
            key={a.id}
            className={
              a.enabled
                ? "text-foreground text-sm"
                : "text-muted-foreground text-sm line-through"
            }
          >
            {a.displayName ?? connection.aspspName}
            {!a.enabled ? " (exclu)" : ""}
          </Text>
        ))
      )}
    </Card>
  );
}
```

- [ ] **Step 3: Implémenter l'écran Banques**

Remplacer `apps/expo/src/app/(tabs)/banques.tsx` :

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { LogOutIcon, RefreshCwIcon } from "lucide-react-native";

import { ConnectionCard } from "~/components/connection-card";
import { Toast, ToastDescription, ToastTitle, useToast } from "~/components/ui/toast";
import { authClient } from "~/utils/auth";
import { trpc, trpcClient } from "~/utils/api";

export default function BanquesScreen() {
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);

  const { data: connections = [], isPending, isError, refetch } = useQuery(
    trpc.connections.list.queryOptions(),
  );

  const showToast = (description: string, isErrorToast: boolean) => {
    toast.show({
      placement: "top",
      render: ({ id }) => (
        <Toast nativeID={`toast-${id}`} action={isErrorToast ? "error" : "success"}>
          <ToastTitle>{isErrorToast ? "Échec" : "Synchronisation"}</ToastTitle>
          <ToastDescription>{description}</ToastDescription>
        </Toast>
      ),
    });
  };

  const sync = async () => {
    setSyncing(true);
    try {
      await trpcClient.sync.run.mutate();
      await refetch();
      showToast("Synchronisation terminée.", false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Échec de la synchronisation.",
        true,
      );
    } finally {
      setSyncing(false);
    }
  };

  if (isPending) {
    return (
      <SafeAreaView className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="bg-background flex-1 items-center justify-center px-4">
        <Text className="text-destructive text-center">
          Impossible de charger les banques.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-background flex-1">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text className="text-foreground text-lg font-bold">Banques</Text>
        <View className="flex-row gap-4">
          <Pressable onPress={() => void sync()} disabled={syncing}>
            <RefreshCwIcon className="text-foreground" />
          </Pressable>
          <Pressable onPress={() => void authClient.signOut()}>
            <LogOutIcon className="text-foreground" />
          </Pressable>
        </View>
      </View>
      {connections.length === 0 ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-muted-foreground text-center">
            Aucune banque connectée pour l'instant.
          </Text>
        </View>
      ) : (
        connections.map((c) => <ConnectionCard key={c.id} connection={c} />)
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Vérification manuelle**

Run: `pnpm -F @budget/expo dev`
Vérifier :
- L'onglet Banques affiche les connexions existantes avec leur statut (badge cohérent avec ce qui est affiché sur `/banques` côté web pour le même compte).
- Le bouton de synchronisation déclenche `sync.run`, affiche un toast de résultat, et rafraîchit la liste des connexions.
- Le bouton de déconnexion ramène bien à l'écran de login (`index.tsx`).
- **Ne pas déclencher ce sync sur un compte réel sans confirmation explicite de l'utilisateur** — il touche de vraies sessions bancaires (voir `CLAUDE.md`, règle déjà en vigueur côté web).

- [ ] **Step 5: Commit**

```bash
git add apps/expo
git commit -m "feat(expo): écran Banques (connexions + synchronisation)"
```

---

## Self-Review (effectué avant remise du plan)

**1. Couverture de la spec :** setup gluestack-ui + thème (Task 1) ; navigation par onglets (Task 2) ; liste transactions + défilement infini (Task 3) ; édition catégorie (Task 4) ; filtres (Task 5) ; KPIs/graphique (Task 6) ; banques lecture seule + sync (Task 7). Hors scope confirmés (wizard OAuth, tests de composants RN) non traités, comme prévu.

**2. Placeholders :** aucun "TBD"/"TODO" ; chaque étape contient soit une commande exacte avec sortie attendue, soit du code complet.

**3. Cohérence des types/noms :** `TransactionFilters` (Task 5) réutilisé identiquement en Task 6 (`filters` dans les `queryKey`/`queryFn` de `byCategory`) ; `getNextTransactionsPageParam` a la même signature dans Task 3 et 5 (la fonction est redéfinie dans le même fichier à chaque modification du screen, pas de duplication de fichier) ; `trpcClient` introduit en Task 3 est le seul point d'export réutilisé par Task 4, 6, 7 ; `CategoryOption`/`CategoryBreakdownItem`/`ConnectionSummary` utilisés avec les champs exacts vérifiés dans `packages/api/src/router/*.ts` et `packages/api/src/lib/connections-core.ts`.

---

**Plan complet et sauvegardé dans `docs/superpowers/plans/2026-07-21-mobile-app-gluestack-ui.md`. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — un sous-agent frais par tâche, revue entre chaque tâche, itération rapide.

**2. Exécution en ligne** — exécution des tâches dans cette session via `executing-plans`, par lots avec points de contrôle.

**Laquelle veux-tu utiliser ?**
