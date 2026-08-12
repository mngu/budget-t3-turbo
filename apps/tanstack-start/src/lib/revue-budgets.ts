import {
  addDays,
  addMonths,
  differenceInCalendarMonths,
  isSameDay,
  parseISO,
} from "date-fns";

import type { RevueCategory } from "./revue-categories";

/**
 * Comparaison de la dépense de la période aux budgets mensuels de `/budgets` —
 * maquette du 2026-08-06, qui a ajouté la même rangée « Budget » et les mêmes
 * jauges à `Revue du mois.dc.html` et à `Transactions.dc.html`. C'est le premier
 * écran à consommer `category_budgets` ; les poser restait jusqu'ici sans effet
 * visible ailleurs que sur `/budgets`.
 *
 * Trois raisons, et trois seulement, de ne rien comparer — la maquette donne à
 * chacune sa phrase plutôt que de faire disparaître la rangée :
 * - `aucun` : aucun budget n'est posé, les postes n'ont que leur moyenne ;
 * - `comptes` : un budget ne connaît pas les comptes, il porte sur tous à la
 *   fois. Comparé à la dépense d'une sélection de comptes, il ferait passer
 *   chaque poste sous son budget sans que rien n'ait changé ;
 * - `periode` : un budget est mensuel. Le sélecteur de période propose aussi
 *   bien un trimestre qu'une plage quelconque (« 30 derniers jours ») : le
 *   premier a un multiple, la seconde n'en a pas — sauf à tomber pile sur un
 *   cycle, voir `wholeMonths`.
 */
export type BudgetsOff = "aucun" | "comptes" | "periode";

export const BUDGETS_OFF_MESSAGES: Record<BudgetsOff, string> = {
  aucun: "Aucun budget défini — les postes se comparent à leur moyenne.",
  comptes:
    "Les budgets portent sur tous les comptes : la comparaison est masquée quand un filtre de comptes est actif.",
  periode:
    "Les budgets sont mensuels : la comparaison ne s'affiche que sur un nombre entier de mois.",
};

export type RevueBudgets =
  | { off: BudgetsOff }
  | {
      off: null;
      /** Budget mensuel de tous les postes × mois couverts. */
      total: number;
      /** Dépense de la période qu'un budget couvre réellement. */
      covered: number;
      /** Dépense qu'aucun budget ne couvre — le segment hachuré des jauges. */
      uncovered: number;
      /** Postes budgétés / postes en tout, au sens de `budgetSlots`. */
      budgeted: number;
      slots: number;
    };

/**
 * Mois **pleins** couverts par la période, `0` si elle n'en est pas faite. Un
 * budget mensuel ne se multiplie que par ça : sur « 30 derniers jours », qui
 * chevauche deux mois partiels, le doubler serait un mensonge et le laisser à un
 * mois aussi.
 *
 * Le test porte sur les bornes seules — `to + 1 jour` doit tomber exactement sur
 * `from + n mois` — et **pas** sur « commence le 1er, finit le dernier jour » :
 * le sélecteur de période permet de caler le mois sur un autre jour de départ
 * (28 juin – 27 juil. est un mois plein), et ce réglage vit dans le navigateur
 * alors que cette fonction tourne aussi côté serveur, dans le loader de la
 * revue. Dérivé des bornes, il n'a rien à lui transmettre. Le mois calendaire
 * reste le cas particulier `startDay = 1`.
 *
 * ponytail: un cycle écrêté par un mois court (28 févr. – 30 mars pour un
 * départ au 31) n'est pas reconnu et masque la comparaison ce mois-là ; à
 * traiter en passant le jour de départ jusqu'ici, donc en le sortant du
 * navigateur.
 */
export function wholeMonths(from?: string, to?: string): number {
  if (!from || !to) return 0;
  const start = parseISO(from);
  const next = addDays(parseISO(to), 1);
  const months = differenceInCalendarMonths(next, start);
  return months > 0 && isSameDay(addMonths(start, months), next) ? months : 0;
}

interface TreeNode {
  id: number;
  name: string;
  children: { id: number; name: string }[];
}

interface Plan {
  rows: { categoryId: number; amount: number | null; detailed: boolean }[];
  total: number;
  budgeted: number;
  slots: number;
}

/**
 * Pose sur chaque poste son budget de la période et la part de sa dépense qu'il
 * couvre, et rend les totaux du bandeau. Comparaison écartée : les postes
 * ressortent tels quels, budgets à `null`.
 */
export function attachBudgets(
  categories: RevueCategory[],
  {
    tree,
    plan,
    expenses,
    search,
  }: {
    tree: TreeNode[];
    plan: Plan;
    /** Total des sorties de la période — ce que les budgets doivent couvrir. */
    expenses: number;
    search: { dateFrom?: string; dateTo?: string; bank?: string | string[] };
  },
): { categories: RevueCategory[]; budgets: RevueBudgets } {
  const months = wholeMonths(search.dateFrom, search.dateTo);
  // Ordre repris de la maquette : « aucun budget » l'emporte sur le filtre de
  // comptes, qui n'a rien à expliquer tant qu'il n'y a rien à comparer.
  //
  // Le test du filtre porte sur la **présence** du param et jamais sur « tous
  // les comptes sont cochés » : `toggleBank` retombe sur `undefined` dès que la
  // sélection est complète et l'URL ne matérialise jamais la liste entière —
  // comparer sa longueur au roster lirait « filtré » sur un état qui ne l'est
  // pas.
  const off: BudgetsOff | null =
    plan.budgeted === 0
      ? "aucun"
      : search.bank !== undefined
        ? "comptes"
        : months === 0
          ? "periode"
          : null;
  if (off) return { categories, budgets: { off } };

  const amountById = new Map(
    plan.rows.map((row) => [row.categoryId, row.amount]),
  );
  const detailedIds = new Set(
    plan.rows.filter((row) => row.detailed).map((row) => row.categoryId),
  );
  const nodeByName = new Map(tree.map((node) => [node.name, node]));

  const decorated = categories.map((category) =>
    withBudget(
      category,
      nodeByName.get(category.filter),
      amountById,
      detailedIds,
      months,
    ),
  );
  const covered = decorated.reduce((sum, c) => sum + c.covered, 0);

  return {
    categories: decorated,
    budgets: {
      off: null,
      // L'enveloppe vient de `budgets.plan` et non des postes de la période : un
      // poste budgété sans dépense ce mois-ci ne doit pas la faire rétrécir.
      // Conséquence assumée — `budgeted`/`slots` comptent les postes de tout
      // l'espace, catégories d'entrée comprises, exactement comme `/budgets`, si
      // bien que les deux écrans disent la même phrase avec les mêmes nombres.
      total: plan.total * months,
      covered,
      uncovered: Math.max(0, expenses - covered),
      budgeted: plan.budgeted,
      slots: plan.slots,
    },
  };
}

function withBudget(
  category: RevueCategory,
  node: TreeNode | undefined,
  amountById: ReadonlyMap<number, number | null>,
  detailedIds: ReadonlySet<number>,
  months: number,
): RevueCategory {
  // Une parente sans sous-catégorie reste globale quel que soit son drapeau —
  // même règle que `budgetSlots` côté serveur, sinon son budget disparaîtrait de
  // l'écran sans disparaître des compteurs. « Sans catégorie », qui ne
  // correspond à aucune ligne de `categories`, tombe ici aussi.
  if (!node || !detailedIds.has(node.id) || node.children.length === 0) {
    const amount = node ? (amountById.get(node.id) ?? null) : null;
    const budget = amount === null ? null : amount * months;
    return {
      ...category,
      budget,
      // Un budget global couvre tout le poste, reliquat « à classer » compris.
      covered: budget === null ? 0 : category.total,
      subs: category.subs.map((sub) => ({ ...sub, budget: null })),
    };
  }

  const childByName = new Map(
    node.children.map((child) => [child.name, child]),
  );
  const subs = category.subs.map((sub) => {
    const child = sub.filter === null ? undefined : childByName.get(sub.filter);
    const amount = child ? (amountById.get(child.id) ?? null) : null;
    return { ...sub, budget: amount === null ? null : amount * months };
  });
  // La somme porte sur **toutes** les sous-catégories budgétées de la base, y
  // compris celles sans dépense ce mois-ci — donc sur `node.children` et non sur
  // `subs`, qui ne contient que ce que la période a fait apparaître. Sinon le
  // « Budget » affiché sous le poste ne serait pas la somme des jauges de la
  // colonne, ni un terme du total du bandeau.
  const amounts = node.children
    .map((child) => amountById.get(child.id) ?? null)
    .filter((amount): amount is number => amount !== null);

  return {
    ...category,
    budget: amounts.length ? amounts.reduce((a, b) => a + b, 0) * months : null,
    // Ce qu'une parente détaillée couvre s'arrête à ses sous-catégories
    // budgétées : son reliquat « à classer » est de la dépense hors budget.
    covered: subs.reduce(
      (sum, sub) => sum + (sub.budget === null ? 0 : sub.total),
      0,
    ),
    subs,
  };
}
