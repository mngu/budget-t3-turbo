// Logique pure (aucune dépendance DB/SDK) — calcule ce qui doit être supprimé
// quand le mode "Remplacer" des suggestions de catégories est appliqué.
// Seule implémentation de cette décision dans tout le projet : appelée à la
// fois par la query d'aperçu (previewReplace) et par la mutation réelle
// (applySuggestions) — voir suggestions/analyze.ts. Le frontend ne
// réimplémente jamais cet algorithme, il affiche le résultat de
// previewReplace tel quel.
import type { CategorySuggestion } from "./schema";

export interface ExistingCategoryForReplace {
  id: number;
  name: string;
  parentId: number | null;
  manualTransactionCount: number;
}

export interface ReplacePlan {
  // Catégories existantes à supprimer : absentes de la proposition, et ni
  // elles ni un de leurs enfants ne contiennent de transaction manuelle.
  idsToDelete: number[];
  namesToDelete: string[];
  // Catégories existantes conservées malgré leur absence de la proposition,
  // car elles (ou un enfant) contiennent une transaction catégorisée
  // manuellement.
  namesKept: string[];
}

export function flattenProposedNames(
  suggestions: CategorySuggestion[],
): Set<string> {
  const names = new Set<string>();
  for (const { parent, enfants } of suggestions) {
    names.add(parent);
    for (const enfant of enfants) names.add(enfant.name);
  }
  return names;
}

// Une catégorie présente dans la proposition n'est jamais supprimée : elle
// est reparentée par upsertCategory, pas ici. Une catégorie absente est
// protégée (jamais supprimée) si elle-même ou un de ses enfants (remontée
// bottom-up, 2 niveaux seulement) contient une transaction manuelle.
export function computeReplacePlan(
  existing: ExistingCategoryForReplace[],
  proposedNames: Set<string>,
): ReplacePlan {
  const notProposed = existing.filter((c) => !proposedNames.has(c.name));

  const protectedIds = new Set(
    notProposed.filter((c) => c.manualTransactionCount > 0).map((c) => c.id),
  );
  for (const c of notProposed) {
    if (c.parentId !== null || protectedIds.has(c.id)) continue;
    const hasProtectedChild = notProposed.some(
      (child) => child.parentId === c.id && protectedIds.has(child.id),
    );
    if (hasProtectedChild) protectedIds.add(c.id);
  }

  const toDelete = notProposed.filter((c) => !protectedIds.has(c.id));

  return {
    idsToDelete: toDelete.map((c) => c.id),
    namesToDelete: toDelete.map((c) => c.name),
    namesKept: notProposed
      .filter((c) => protectedIds.has(c.id))
      .map((c) => c.name),
  };
}
