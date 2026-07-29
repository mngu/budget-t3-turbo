import type {
  CategoryOverviewNode,
  CategorySuggestion,
  TxnForAnalysis,
} from "@budget/api";

/**
 * Une branche proposée par l'analyse et pas encore présente en base : la
 * « ligne proposée » posée dans la liste des catégories, sous la parente
 * concernée. Aucune persistance derrière — l'état du run vit en mémoire côté
 * serveur (voir suggestions/state.ts) et l'acceptation est une mutation par
 * branche (`categories.suggestions.accept`).
 */
export interface GhostBranch {
  /** Stable tant que le run ne change pas — sert au rejet local et au pending. */
  key: string;
  /**
   * Nom de la parente **tel qu'il existe en base** quand elle existe, jamais la
   * chaîne brute du LLM. C'est ce nom qui repart dans `suggestions.accept`, où
   * `upsertCategory` fait un `eq(categories.name, …)` exact : renvoyer « sante »
   * pour une parente « Santé » créerait une seconde parente au lieu de greffer
   * sous la première, alors que l'écran l'a affichée sous celle-ci.
   */
  parent: string;
  parentColor: string;
  name: string;
  txnIds: number[];
}

export interface DerivedSuggestions {
  /** Branches à greffer sous une parente qui existe déjà, par id de parente. */
  ghostsByParentId: Map<number, GhostBranch[]>;
  /** Branches dont la parente elle-même reste à créer. */
  proposedParents: { name: string; color: string; branches: GhostBranch[] }[];
  branchCount: number;
  /** Nombre de parentes existantes qui reçoivent au moins une branche. */
  touchedExistingParents: number;
}

/**
 * Comparaison de noms de catégories : casse, accents et espaces multiples
 * ignorés. Volontairement pas de dépluralisation — « Frais », « Cours »,
 * « Revenus », « Courses » la mettraient en défaut, et une greffe erronée est
 * silencieuse là où une proposition en double reste visible et écartable.
 * C'est le prompt (`buildAnalysisPrompt`) qui doit empêcher « Transports » face
 * à « Transport » ; ceci n'est qu'un filet.
 */
const norm = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

/**
 * Croise la proposition du LLM avec l'arborescence réelle pour ne garder que ce
 * qui manque. Deux filtres, dans cet ordre :
 *
 *  - une catégorie dont le nom existe **déjà quelque part** dans l'arbre n'est
 *    jamais une proposition. `categories.name` est unique en base : la
 *    recréer échouerait, et une analyse re-propose massivement l'existant
 *    (c'est même son rôle, le prompt part des catégories réelles) ;
 *  - une branche dont tous les `txnIds` ont déjà été rangés depuis l'analyse
 *    n'a plus rien à proposer. `dismissed` couvre le rejet manuel, qui n'est
 *    que local : rien à écrire en base pour dire « non ».
 */
export function deriveSuggestions(
  suggestions: CategorySuggestion[],
  tree: CategoryOverviewNode[],
  dismissed: ReadonlySet<string>,
): DerivedSuggestions {
  const parentByName = new Map<string, { id: number; name: string }>();
  const existingNames = new Set<string>();
  for (const parent of tree) {
    parentByName.set(norm(parent.name), { id: parent.id, name: parent.name });
    existingNames.add(norm(parent.name));
    for (const child of parent.children) existingNames.add(norm(child.name));
  }

  const ghostsByParentId = new Map<number, GhostBranch[]>();
  const proposedParents: DerivedSuggestions["proposedParents"] = [];
  let branchCount = 0;
  // La clé est dérivée du nom de parente **résolu** : deux propositions dont
  // les parentes se ramènent à la même existante (« Transport » et
  // « Transports ») produiraient sinon deux branches de clé identique — clé
  // React dupliquée, et un rejet qui en écarterait deux d'un coup.
  const seen = new Set<string>();

  for (const suggestion of suggestions) {
    const existingParent = parentByName.get(norm(suggestion.parent));
    // Le nom retenu est celui de la base dès qu'elle en a un — c'est lui qui
    // repartira dans `accept` (voir GhostBranch.parent).
    const parentName = existingParent?.name ?? suggestion.parent;

    const branches = suggestion.enfants
      .filter(
        (child) =>
          !existingNames.has(norm(child.name)) && child.txnIds.length > 0,
      )
      .map((child) => ({
        key: `${parentName}›${child.name}`,
        parent: parentName,
        parentColor: suggestion.parentColor,
        name: child.name,
        txnIds: child.txnIds,
      }))
      .filter((ghost) => {
        if (dismissed.has(ghost.key) || seen.has(ghost.key)) return false;
        seen.add(ghost.key);
        return true;
      });

    if (branches.length === 0) continue;
    branchCount += branches.length;

    if (existingParent === undefined) {
      proposedParents.push({
        name: parentName,
        color: suggestion.parentColor,
        branches,
      });
    } else {
      ghostsByParentId.set(existingParent.id, [
        ...(ghostsByParentId.get(existingParent.id) ?? []),
        ...branches,
      ]);
    }
  }

  return {
    ghostsByParentId,
    proposedParents,
    branchCount,
    touchedExistingParents: ghostsByParentId.size,
  };
}

/** Transactions de l'échantillon analysé correspondant à une branche. */
export function ghostTransactions(
  ghost: GhostBranch,
  sample: TxnForAnalysis[],
): TxnForAnalysis[] {
  const wanted = new Set(ghost.txnIds);
  return sample.filter((txn) => wanted.has(txn.id));
}
