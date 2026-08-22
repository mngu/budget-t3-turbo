// Budgets mensuels par catégorie — écran /budgets.
//
// Un budget est un montant mensuel posé sur une catégorie, sans dimension de
// mois : `set` écrase, rien à versionner. Depuis la suppression de
// `category_budgets` (le montant vit dans `categories.budget_amount`), il n'y a
// plus de mode « Détaillé » : chaque catégorie, parente ou non, est un poste et
// porte son propre montant.
import { and, eq, gte, isNotNull, isNull, lt, sql } from "@budget/db";
import { db } from "@budget/db/client";
import { bankAccounts, categories, transactions } from "@budget/db/schema";

// Fenêtre de référence : les 6 derniers mois **complets**. Le mois en cours en
// est exclu — il ne couvre qu'une fraction du calendrier et tirerait toute
// moyenne vers le bas, donc toute proposition avec elle.
//
// ponytail: mois **calendaires**, même quand le sélecteur de période cale le
// mois sur un autre jour de départ (réglage navigateur, jamais envoyé ici). Les
// ordres de grandeur restent comparables ; aligner la moyenne sur le cycle
// demande de faire remonter le jour de départ jusqu'au serveur.
const HISTORY_MONTHS = 6;

// Une catégorie vue moins de 4 mois sur 6 ne reçoit pas de proposition : sa
// moyenne serait un chiffre inventé plutôt qu'une habitude. Elle garde sa
// moyenne affichée (c'est un fait) mais pas le bouton de pré-remplissage.
const MIN_ACTIVE_MONTHS = 4;

export interface CategoryBudgetRow {
  categoryId: number;
  /** Montant mensuel posé, ou `null` si la catégorie n'est pas budgétée. */
  amount: number | null;
  /** Dépense mensuelle moyenne sur les 6 mois complets, arrondie à 5 €. */
  average: number;
  /** Historique trop court pour proposer un montant (voir MIN_ACTIVE_MONTHS). */
  irregular: boolean;
}

export interface CategoryBudgetPlan {
  rows: CategoryBudgetRow[];
  /** Total mensuel budgété. */
  total: number;
  /** Postes budgétés / postes en tout — un poste = une catégorie. */
  budgeted: number;
  slots: number;
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

export async function budgetPlan(
  organizationId: string,
): Promise<CategoryBudgetPlan> {
  const { start, end } = historyWindow();
  const month = sql<string>`to_char(${transactions.bookingDate}, 'YYYY-MM')`;

  const [nodes, spend] = await Promise.all([
    db
      .select({
        id: categories.id,
        parentId: categories.parentId,
        amount: categories.budgetAmount,
      })
      .from(categories)
      .where(eq(categories.organizationId, organizationId))
      .orderBy(categories.id),
    db
      .select({
        categoryId: transactions.categoryId,
        month,
        debit: sql<string>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
      .where(
        and(
          eq(bankAccounts.organizationId, organizationId),
          eq(transactions.direction, "debit"),
          isNotNull(transactions.categoryId),
          // Périmètre « tous les comptes » : les deux jambes d'un virement
          // interne y sont toujours, la paire se neutralise donc toujours.
          isNull(transactions.transferPairId),
          eq(transactions.excluded, false),
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
  // même argent, et son budget doit couvrir les deux.
  const effective = new Map(
    nodes.map((node) => [node.id, new Map(own.get(node.id) ?? [])]),
  );
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const parent = effective.get(node.parentId);
    if (!parent) continue;
    for (const [m, v] of own.get(node.id) ?? []) {
      parent.set(m, (parent.get(m) ?? 0) + v);
    }
  }

  const rows: CategoryBudgetRow[] = nodes.map((node) => ({
    categoryId: node.id,
    amount: node.amount === null ? null : Number(node.amount),
    ...budgetProposal([...(effective.get(node.id)?.values() ?? [])]),
  }));

  return {
    rows,
    total: rows.reduce((sum, r) => sum + (r.amount ?? 0), 0),
    budgeted: rows.filter((r) => r.amount !== null).length,
    slots: rows.length,
  };
}

// Le `WHERE` porte l'espace : un id venu du client et appartenant à un autre
// foyer ne touche aucune ligne. Un `UPDATE` à zéro ligne ne lève pas, d'où le
// `returning` — l'écran attend une confirmation.
export async function setCategoryBudget(
  organizationId: string,
  categoryId: number,
  amount: number | null,
): Promise<void> {
  const updated = await db
    .update(categories)
    .set({ budgetAmount: amount === null ? null : amount.toFixed(2) })
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.organizationId, organizationId),
      ),
    )
    .returning({ id: categories.id });
  if (updated.length === 0) throw new Error("Catégorie introuvable.");
}

// « Tout vider » ne vide que l'espace courant.
export async function clearCategoryBudgets(
  organizationId: string,
): Promise<void> {
  await db
    .update(categories)
    .set({ budgetAmount: null })
    .where(eq(categories.organizationId, organizationId));
}
