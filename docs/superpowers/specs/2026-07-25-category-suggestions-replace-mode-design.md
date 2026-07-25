# Mode "Remplacer" pour les suggestions de catégories IA — design

Date : 2026-07-25

## Contexte et objectif

La feature de suggestions de catégories (`categoriesRouter.suggestions.{generate,status,apply}`, page `/categories`, composant `apps/tanstack-start/src/component/category-suggestions.tsx`) existe déjà : le LLM analyse un échantillon de transactions et propose une arborescence parent → sous-catégories, éditable et partiellement sélectionnable via des checkboxes (`category-tree.tsx`), avec preview des transactions concernées avant application.

Le mode d'application actuel (`applySuggestionsCore`) est **additif uniquement** : il crée les catégories cochées absentes, réutilise telles quelles celles qui existent déjà par nom (`onConflictDoNothing`), et ne touche jamais aux catégories absentes de la proposition. Ce design ajoute un second mode, **"Remplacer"**, pour le cas où l'utilisateur veut adopter l'arborescence proposée comme nouvelle structure de référence — par exemple après un premier seed grossier, ou pour une restructuration complète.

Objectif produit : rendre ce remplacement possible sans jamais perdre une correction manuelle de catégorisation, et sans surprise — l'utilisateur voit exactement ce qui va être supprimé avant de confirmer.

## Mode "Fusionner" vs mode "Remplacer"

Sélecteur radio en haut de `SuggestionsWorkspace`, défaut sur **Fusionner** (comportement actuel, inchangé) :

- **Fusionner** : additif, comportement actuel de `applySuggestionsCore`, aucun changement de code sur ce chemin.
- **Remplacer** : l'arborescence cochée devient la nouvelle vérité —
  - Catégorie existante **absente** de la sélection cochée, **sans** transaction `categorySource = 'manual'` rattachée (elle ou ses enfants) → supprimée (cascade).
  - Catégorie existante **absente** de la sélection, **avec** au moins une transaction manuelle rattachée (elle ou un de ses enfants) → conservée telle quelle, non touchée.
  - Catégorie existante **présente par nom** dans la sélection → réutilisée, et son `parentId` est mis à jour pour matcher la nouvelle structure (permet une vraie restructuration : ex. une catégorie racine qui devient sous-catégorie).
  - Dans les deux modes, les transactions `categorySource = 'manual'` ne sont jamais réinitialisées ni déplacées. Les transactions `categorySource = 'llm'` (ou `null`) sont remises en attente puis recatégorisées, comme aujourd'hui.

Décocher une sous-catégorie proposée a un sens différent selon le mode : en Fusion, "ne pas la créer" ; en Remplacement, "ne pas la créer **et** ne pas garder l'ancienne du même nom si elle existe" — ce point est explicité dans le texte de la dialog de confirmation.

## Prévisualisation avant confirmation

La dialog de confirmation en mode Remplacer affiche un diff concret plutôt qu'un texte générique, calculé côté client à partir de données déjà chargées sur la page :

- Catégories qui seront **supprimées** (nom listé).
- Catégories **conservées malgré tout** car elles contiennent des corrections manuelles (nom listé).
- Nombre de catégories **créées** vs **réutilisées**.

Pour ça, `categoriesRouter.overview` gagne un champ `manualTransactionCount` par catégorie (à côté du `transactionCount` déjà présent — un `count()` conditionnel de plus dans la même requête groupée, pas de nouvel endpoint). Le diff est ensuite un simple calcul client : comparer les noms de l'arborescence cochée à l'`overview` déjà en mémoire.

Le bouton de confirmation en mode Remplacer utilise un style destructif (cohérent avec la suppression de catégorie existante, `category-overview-tree.tsx`), au lieu du style neutre actuel. Le toast final rapporte les chiffres réellement exécutés (créées / réutilisées / supprimées / conservées), pas seulement `categoriesCreated` comme aujourd'hui.

## Séquence d'exécution (`applySuggestionsCore`, mode Remplacer)

Enveloppée dans une transaction DB (`db.transaction`) pour rester atomique sur la partie catégories :

1. Reset des transactions `categorySource = 'llm'` → `categoryId = null`, `categorySource = null` (comme aujourd'hui, jamais les `manual`).
2. Calcul de la liste des catégories à supprimer : absentes de la sélection cochée **et** sans transaction manuelle rattachée — calcul remonté (bottom-up) : si un enfant est protégé par une transaction manuelle, son parent est protégé aussi (sinon la suppression du parent violerait la contrainte de clé étrangère sur l'enfant conservé).
3. Suppression cascade de cette liste (enfants avant parents, même ordre que `categoriesRouter.remove`).
4. Upsert de l'arborescence cochée : création des catégories absentes, mise à jour du `parentId` pour celles qui existent déjà par nom.
5. Relance de la catégorisation (`runCategorize`) — conserve son `try/catch` actuel, non bloquant, comportement inchangé.

Le mode Fusion n'est pas concerné par les étapes 2-3 (pas de suppression) ni par la mise à jour de `parentId` en étape 4 (upsert reste `onConflictDoNothing` pur, comportement actuel).

## Cas limites

- **Deux catégories existantes convergent vers un même nom proposé** (ex. "Courses" et "Supermarché" fusionnées en "Courses" dans la proposition) : la première trouvée par nom est réutilisée/reparentée ; la seconde est supprimée si vide de corrections manuelles, ou conservée à part si elle en contient. Ses transactions manuelles ne sont **pas** migrées vers la catégorie fusionnée — limite connue, assumée (fusionner le contenu de deux catégories est hors scope ; ce design ne fait que remplacer la *structure*).
- **Sélection cochée vide en mode Remplacer** : bouton "Appliquer" désactivé, comme le comportement actuel du mode Fusion (`payload.length === 0`).
- **Échec partiel** : la transaction DB garantit que la suppression + l'upsert des catégories sont tout-ou-rien. Seule la recatégorisation finale (`runCategorize`) garde son comportement non-bloquant existant.
- **Nouvelles transactions arrivées depuis l'analyse** : même bandeau d'avertissement qu'aujourd'hui (`newTransactionsCount`), aucune logique spécifique au mode Remplacer.

## Tests à ajouter (`suggest-categories-core.test.ts`)

- Mode Fusion : comportement inchangé (non-régression).
- Mode Remplacement : catégorie absente + sans transaction manuelle → supprimée.
- Mode Remplacement : catégorie absente + avec transaction manuelle → conservée.
- Mode Remplacement : parent absent de la sélection mais enfant protégé par une transaction manuelle → parent conservé aussi.
- Mode Remplacement : catégorie existante présente dans la sélection → `parentId` mis à jour.
- Les deux modes : transactions `categorySource = 'manual'` jamais touchées (ni `categoryId` ni `categorySource`).

## Hors scope

- Fusion du contenu de deux catégories convergeant vers un même nom (cf. cas limite ci-dessus) — seules les corrections manuelles sont protégées, pas migrées.
- Renommage automatique d'une catégorie existante par le LLM (ex. suggérer que "Alimentation" devienne "Courses & Alimentation") — le matching reste par nom exact ; un renommage se ferait via le mutation `rename` existant, séparément.
- Dry-run/preview côté serveur : le diff de la dialog de confirmation est calculé côté client à partir de l'`overview` déjà en mémoire, pas d'appel réseau dédié.
