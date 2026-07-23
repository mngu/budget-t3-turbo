# Catégories intelligentes — Plan d'implémentation

> **Pour Hermes :** Utiliser le skill `subagent-driven-development` pour implémenter ce plan tâche par tâche.

**Goal:** Remplacer les 11 catégories plates par une arborescence parent/enfant, avec une feature d'analyse LLM qui propose des sous-catégories adaptées aux transactions réelles, et une catégorisation few-shot qui utilise les transactions similaires déjà classées pour améliorer la précision.

**Architecture:** Deux features principales — (1) « Suggestions » : un LLM costaud analyse l'ensemble des transactions et propose une arborescence que l'utilisateur valide via une UI dédiée ; (2) « Few-shot » : le pipeline de catégorisation existant est enrichi pour injecter 3-5 exemples de transactions similaires déjà catégorisées, permettant au LLM de classer par analogie plutôt qu'avec un prompt générique.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL), tRPC, TanStack Start, React, Base UI, Anthropic SDK (Claude Haiku pour catégorisation, Sonnet pour analyse), Zod

---

## Architecture détaillée

### Feature 1 : Analyse et suggestions de catégories

**Déclenchement :** bouton dans l'UI ou script CLI `pnpm suggest-categories`

**Pipeline :**
1. **Collecte** — échantillon représentatif des transactions (derniers 6 mois, max ~500)
2. **Analyse LLM** (Claude Sonnet) — prompt décrivant les transactions et demandant une arborescence à 2 niveaux
3. **Sortie structurée** — `[{ parent: "Alimentation", enfants: ["Courses", "Boulangerie", ...] }, ...]`
4. **Preview UI** — page `/categories/suggestions` avec arborescence interactive
5. **Application** — création en DB + re-catégorisation

### Feature 2 : Catégorisation few-shot

**Principe :** injecter 3-5 transactions similaires déjà catégorisées dans le prompt du LLM.

**Recherche de similarité :**
- Même `counterparty` → match exact prioritaire
- Trigrammes PostgreSQL (`pg_trgm`) sur `description` normalisée
- Même `bank_code`/`MCC` en fallback
- Priorité aux `categorySource = 'manual'`

### Modèle de données

```sql
ALTER TABLE categories ADD COLUMN parent_id INTEGER REFERENCES categories(id);
-- parent_id NULL = catégorie parente
-- parent_id NOT NULL = sous-catégorie
-- Une transaction pointe toujours vers une sous-catégorie (feuille)
```

---

### UI de la page `/categories/suggestions`

```
┌─────────────────────────────────────────────────────────┐
│  🏷️  Suggestions de catégories                          │
│  Analyse de 847 transactions · Générée le 22/07/2026    │
│                                                         │
│  [🔄 Relancer l'analyse]                  [💾 Appliquer]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📦 Alimentation                          [📝 renommer] │
│  ├── ☑️ Courses                  142 txns    [✏️][🗑️]  │
│  ├── ☑️ Boulangerie               38 txns    [✏️][🗑️]  │
│  ├── ☑️ Livraison                 56 txns    [✏️][🗑️]  │
│  ├── ☑️ Restaurants               89 txns    [✏️][🗑️]  │
│  └── ☐ Marché                     12 txns    [✏️][🗑️]  │
│                                                         │
│  🚗 Transport                              [📝 renommer]│
│  ├── ☑️ Métro / Bus               64 txns    [✏️][🗑️]  │
│  └── ☑️ Carburant                 23 txns    [✏️][🗑️]  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  ➕ Ajouter une catégorie                               │
│  ➕ Ajouter une sous-catégorie à...                     │
└─────────────────────────────────────────────────────────┘
```

**Interactions :**
- ☑️ checkbox : active/désactive la sous-catégorie
- ✏️ : édition inline du nom
- 🗑️ : suppression de la proposition
- 📝 renommer : édition inline du parent
- Glisser-déposer entre parents, fusion par drop sur une autre
- Clic sur le compteur → drawer listant les transactions
- Couleur auto : héritée du parent avec variation

**États de la page :**
| État | Affichage |
|---|---|
| Jamais analysé | Message + bouton "Analyser mes transactions" |
| Analyse en cours | Spinner + "Analyse en cours..." |
| Résultats dispo | Arborescence interactive |
| Résultats obsolètes | Bannière jaune + bouton Relancer |

---

## Plan d'implémentation

### Phase 1 : Schéma et migration

#### Task 1.1 : Ajouter `parent_id` au schéma Drizzle
**Files:**
- Modify: `packages/db/src/schema.ts`

Ajouter `parentId: integer("parent_id").references((): AnyPgColumn => categories.id)` à la table `categories`. Mettre à jour le type `NewCategory`.

#### Task 1.2 : Générer et appliquer la migration
```bash
pnpm -F @budget/db with-env drizzle-kit generate
pnpm -F @budget/db with-env drizzle-kit migrate
```

#### Task 1.3 : Adapter le router categories pour renvoyer l'arborescence
**Files:**
- Modify: `packages/api/src/router/categories.ts`

Ajouter une query `tree` qui retourne les catégories nestées (parents avec leurs enfants), et adapter `list` pour supporter un paramètre `parentId`.

---

### Phase 2 : Feature Suggestions (backend)

#### Task 2.1 : Créer le schéma Zod pour les suggestions
**Files:**
- Create: `packages/api/src/lib/suggest-categories-schema.ts`

Définir `CategorySuggestionSchema` → `z.object({ parent: z.string(), enfants: z.array(z.string()) })` et la version array.

#### Task 2.2 : Collecte d'échantillon de transactions
**Files:**
- Create: `packages/api/src/lib/suggest-categories-core.ts`

Fonction `sampleTransactions(limit?: number)` → échantillon représentatif des transactions (couvrant tous les comptes, triées par date décroissante).

#### Task 2.3 : Build du prompt d'analyse
**Files:**
- Modify: `packages/api/src/lib/suggest-categories-core.ts`

Fonction `buildAnalysisPrompt(transactions)` → prompt décrivant les transactions (description, montant, contrepartie, MCC) et demandant de proposer une arborescence.

#### Task 2.4 : Appel LLM pour analyse
**Files:**
- Modify: `packages/api/src/lib/suggest-categories-core.ts`

Fonction `analyzeAndSuggest(transactions)` → appel Anthropic (Claude Sonnet) avec structured outputs, retourne les suggestions parsées.

#### Task 2.5 : Routeur tRPC pour les suggestions
**Files:**
- Modify: `packages/api/src/router/categories.ts`

Ajouter les procédures :
- `suggestions.generate` — lance l'analyse, retourne les suggestions
- `suggestions.status` — vérifie si une analyse existe, son âge, le nombre de nouvelles transactions depuis

#### Task 2.6 : Routeur tRPC pour l'application
**Files:**
- Modify: `packages/api/src/router/categories.ts`

Ajouter la procédure `suggestions.apply(input: { categories: CategorySuggestion[] })` → crée les catégories/sous-catégories en DB puis lance la re-catégorisation.

---

### Phase 3 : Feature Suggestions (UI)

#### Task 3.1 : Page `/categories/suggestions` — squelette
**Files:**
- Create: `apps/tanstack-start/src/routes/_authed/categories.suggestions.tsx`

Page avec les 4 états (jamais analysé, chargement, résultats, obsolète). Bouton "Analyser mes transactions" dans l'état initial.

#### Task 3.2 : Composant `CategoryTree`
**Files:**
- Create: `apps/tanstack-start/src/components/CategoryTree.tsx`

Composant d'arborescence interactive : rendu récursif parent → enfants, checkboxes, édition inline, suppression, drag & drop entre parents.

#### Task 3.3 : Composant `TransactionPreviewDrawer`
**Files:**
- Create: `apps/tanstack-start/src/components/TransactionPreviewDrawer.tsx`

Drawer affichant la liste des transactions qui seraient classées dans une sous-catégorie donnée.

#### Task 3.4 : Logique d'application + feedback
**Files:**
- Modify: `apps/tanstack-start/src/routes/_authed/categories.suggestions.tsx`

Bouton "Appliquer" → confirmation dialog → appel tRPC `suggestions.apply` → toast succès → redirection.

---

### Phase 4 : Catégorisation few-shot

#### Task 4.1 : Extension pg_trgm pour la similarité textuelle
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

#### Task 4.2 : Fonction de recherche de transactions similaires
**Files:**
- Create: `packages/api/src/lib/similar-transactions.ts`

Fonction `findSimilar(transaction, limit=5)` → recherche par `counterparty` exact, puis trigrammes sur `description`, puis `bank_code`/`MCC`. Retourne les transactions déjà catégorisées triées par similarité.

#### Task 4.3 : Enrichissement du prompt de catégorisation
**Files:**
- Modify: `packages/api/scripts/categorize-core.ts`

Fonction `buildFewShotPrompt(transaction, similars, categoryTree)` → construit un prompt avec la section "Transactions similaires déjà catégorisées :" suivie des exemples, puis "Nouvelle transaction à catégoriser :".

#### Task 4.4 : Intégration dans le pipeline de catégorisation
**Files:**
- Modify: `packages/api/scripts/categorize.ts`

Avant d'envoyer le batch au LLM, pour chaque transaction chercher ses similaires, construire le prompt few-shot enrichi. Adapter la logique de batch (un appel par transaction ou micro-batch avec contexte partagé ? → micro-batch de 10 avec similaires injectés).

#### Task 4.5 : Fallback vers prompt générique
Si aucune transaction similaire trouvée, utiliser le prompt actuel (sans section few-shot). Transparent pour le reste du pipeline.

---

### Phase 5 : Tests

#### Task 5.1 : Tests unitaires `categorize-core`
**Files:**
- Modify: `packages/api/scripts/categorize-core.test.ts`

Ajouter des tests pour `buildFewShotPrompt`, `findSimilar` (mock DB), et le fallback.

#### Task 5.2 : Tests unitaires `suggest-categories-core`
**Files:**
- Create: `packages/api/scripts/suggest-categories-core.test.ts`

Tester `sampleTransactions`, `buildAnalysisPrompt`, le parsing de la sortie LLM.

---

### Phase 6 : Polish

#### Task 6.1 : Script CLI `pnpm suggest-categories`
**Files:**
- Create: `packages/api/scripts/suggest-categories.ts`
- Modify: `package.json` (racine)

#### Task 6.2 : Mise à jour du CLAUDE.md
**Files:**
- Modify: `CLAUDE.md`

Documenter les nouvelles features, les commandes, le nouveau schéma.

---

## Fichiers impactés — résumé

| Fichier | Action |
|---|---|
| `packages/db/src/schema.ts` | Modifier (parent_id) |
| `packages/api/src/router/categories.ts` | Modifier (tree, suggestions.*) |
| `packages/api/src/lib/suggest-categories-core.ts` | Créer |
| `packages/api/src/lib/suggest-categories-schema.ts` | Créer |
| `packages/api/src/lib/similar-transactions.ts` | Créer |
| `packages/api/scripts/categorize-core.ts` | Modifier (few-shot) |
| `packages/api/scripts/categorize.ts` | Modifier (intégration similar) |
| `packages/api/scripts/suggest-categories.ts` | Créer (CLI) |
| `apps/tanstack-start/src/routes/_authed/categories.suggestions.tsx` | Créer |
| `apps/tanstack-start/src/components/CategoryTree.tsx` | Créer |
| `apps/tanstack-start/src/components/TransactionPreviewDrawer.tsx` | Créer |
| `package.json` | Modifier (script suggest) |
| `CLAUDE.md` | Modifier (doc) |

---

## Risques et open questions

- **Coût LLM analyse** : ~500 transactions envoyées à Sonnet → estimer le coût avant de lancer
- **pg_trgm** : vérifier que l'extension est disponible sur l'instance PostgreSQL
- **Transactions sans similaires** : les premières transactions seront toujours classées via le prompt générique → effet boule de neige positif ensuite
- **UI drag & drop** : alternative plus simple = simples checkboxes sans drag (MVP), drag en v2
- **Couleurs auto** : définir une palette de variations par parent, ou laisser le LLM suggérer des couleurs ?
