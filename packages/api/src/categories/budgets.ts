// Budgets mensuels par catégorie — onglet « Budgets » de /categories.
//
// Un budget se pose sur une catégorie. Une parente peut être « détaillée » :
// ce sont alors ses sous-catégories qui portent chacune un montant, et la
// parente affiche leur somme. Les deux lectures ne coexistent jamais — c'est
// `budgetSlots` qui tranche, et c'est de lui que sortent tous les compteurs.
import { and, eq, gte, isNotNull, isNull, lt, sql } from "@budget/db";
import { db } from "@budget/db/client";
import { categories, categoryBudgets, transactions } from "@budget/db/schema";

// Fenêtre de référence : les 6 derniers mois **complets**. Le mois en cours en
// est exclu — il ne couvre qu'une fraction du calendrier et tirerait toute
// moyenne vers le bas, donc toute proposition avec elle.
const HISTORY_MONTHS = 6;

// Une catégorie vue moins de 4 mois sur 6 ne reçoit pas de proposition : sa
// moyenne serait un chiffre inventé plutôt qu'une habitude. Elle garde sa
// moyenne affichée (c'est un fait) mais pas le bouton de pré-remplissage.
const MIN_ACTIVE_MONTHS = 4;

export interface CategoryBudgetRow {
  categoryId: number;
  /** Montant mensuel posé, ou `null` si la catégorie n'est pas budgétée. */
  amount: number | null;
  /** Parente dont le budget est réparti sur ses sous-catégories. */
  detailed: boolean;
  /** Dépense mensuelle moyenne sur les 6 mois complets, arrondie à 5 €. */
  average: number;
  /** Historique trop court pour proposer un montant (voir MIN_ACTIVE_MONTHS). */
  irregular: boolean;
}

export interface CategoryBudgetPlan {
  rows: CategoryBudgetRow[];
  /** Total mensuel budgété, sur les seuls postes qui comptent. */
  total: number;
  /** Postes budgétés / postes en tout — « poste » au sens de `budgetSlots`. */
  budgeted: number;
  slots: number;
}

/**
 * Les catégories qui portent réellement un budget : une parente « globale »
 * compte pour elle-même, une parente « détaillée » s'efface derrière ses
 * sous-catégories. Une parente sans sous-catégorie est toujours globale, quel
 * que soit son drapeau.
 *
 * C'est la seule définition de « poste » de l'écran : les compteurs d'en-tête,
 * le « N sans budget » et le bandeau « tout est budgété » en sortent tous, donc
 * ils ne peuvent pas se contredire.
 */
export function budgetSlots(
  tree: { id: number; children: { id: number }[] }[],
  detailedIds: ReadonlySet<number>,
): number[] {
  return tree.flatMap((parent) =>
    detailedIds.has(parent.id) && parent.children.length > 0
      ? parent.children.map((child) => child.id)
      : [parent.id],
  );
}

/**
 * Proposition de budget pour une série de 6 totaux mensuels (mois sans dépense
 * inclus, à zéro). La moyenne porte bien sur 6 et non sur les seuls mois
 * actifs : un poste vu 5 mois sur 6 dépense en moyenne moins qu'un poste vu
 * tous les mois, et le budget doit le dire.
 */
export function budgetProposal(monthlyTotals: number[]): {
  average: number;
  irregular: boolean;
} {
  const active = monthlyTotals.filter((v) => v > 0).length;
  const sum = monthlyTotals.reduce((a, v) => a + v, 0);
  return {
    // Arrondi à 5 € : c'est une proposition, pas une mesure — un montant rond
    // se lit comme une décision, « 317 € » se lit comme un relevé.
    average: Math.round(sum / HISTORY_MONTHS / 5) * 5,
    irregular: active < MIN_ACTIVE_MONTHS,
  };
}

// Bornes de la fenêtre de référence, en `YYYY-MM-DD` (colonne `date`).
function historyWindow(now = new Date()) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const firstOfMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  return {
    start: iso(
      new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - HISTORY_MONTHS, 1),
      ),
    ),
    end: iso(new Date(firstOfMonth)),
  };
}

export async function budgetPlan(): Promise<CategoryBudgetPlan> {
  const { start, end } = historyWindow();
  const month = sql<string>`to_char(${transactions.bookingDate}, 'YYYY-MM')`;

  const [nodes, saved, spend] = await Promise.all([
    db
      .select({ id: categories.id, parentId: categories.parentId })
      .from(categories)
      .orderBy(categories.id),
    db.select().from(categoryBudgets),
    db
      .select({
        categoryId: transactions.categoryId,
        month,
        debit: sql<string>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.direction, "debit"),
          isNotNull(transactions.categoryId),
          // Périmètre « tous les comptes » : les deux jambes d'un virement
          // interne y sont toujours, la paire se neutralise donc toujours.
          isNull(transactions.transferPairId),
          gte(transactions.bookingDate, start),
          lt(transactions.bookingDate, end),
        ),
      )
      .groupBy(transactions.categoryId, month),
  ]);

  // Série mensuelle propre à chaque catégorie (transactions directes).
  const own = new Map<number, Map<string, number>>();
  for (const row of spend) {
    if (row.categoryId === null) continue;
    const months = own.get(row.categoryId) ?? new Map<string, number>();
    months.set(row.month, Number(row.debit));
    own.set(row.categoryId, months);
  }

  // Série d'une parente = la sienne + celle de ses sous-catégories : c'est le
  // même argent, et son budget global doit couvrir les deux.
  const effective = new Map<number, Map<string, number>>();
  for (const node of nodes) {
    const months = new Map(own.get(node.id) ?? []);
    effective.set(node.id, months);
  }
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const parent = effective.get(node.parentId);
    if (!parent) continue;
    for (const [m, v] of own.get(node.id) ?? []) {
      parent.set(m, (parent.get(m) ?? 0) + v);
    }
  }

  const savedById = new Map(saved.map((b) => [b.categoryId, b]));
  const rows: CategoryBudgetRow[] = nodes.map((node) => {
    const row = savedById.get(node.id);
    return {
      categoryId: node.id,
      amount: row?.amount == null ? null : Number(row.amount),
      detailed: row?.detailed ?? false,
      ...budgetProposal([...(effective.get(node.id)?.values() ?? [])]),
    };
  });

  const tree = nodes
    .filter((n) => n.parentId === null)
    .map((parent) => ({
      id: parent.id,
      children: nodes.filter((n) => n.parentId === parent.id),
    }));
  const slots = budgetSlots(
    tree,
    new Set(saved.filter((b) => b.detailed).map((b) => b.categoryId)),
  );
  const amountById = new Map(rows.map((r) => [r.categoryId, r.amount]));
  const amounts = slots.map((id) => amountById.get(id) ?? null);

  return {
    rows,
    total: amounts.reduce((sum: number, a) => sum + (a ?? 0), 0),
    budgeted: amounts.filter((a) => a !== null).length,
    slots: slots.length,
  };
}

// `amount` nul retire le budget sans effacer la ligne : elle peut encore porter
// le mode « Détaillé » de la parente.
export async function setCategoryBudget(
  categoryId: number,
  amount: number | null,
): Promise<void> {
  const value = amount === null ? null : amount.toFixed(2);
  await db
    .insert(categoryBudgets)
    .values({ categoryId, amount: value })
    .onConflictDoUpdate({
      target: categoryBudgets.categoryId,
      set: { amount: value },
    });
}

export async function setCategoryDetailed(
  categoryId: number,
  detailed: boolean,
): Promise<void> {
  await db
    .insert(categoryBudgets)
    .values({ categoryId, detailed })
    .onConflictDoUpdate({
      target: categoryBudgets.categoryId,
      set: { detailed },
    });
}

export async function clearCategoryBudgets(): Promise<void> {
  await db.delete(categoryBudgets);
}
