// Budgets mensuels par catégorie — écran /settings/categories.
//
// Un budget est un montant mensuel posé sur une catégorie, sans dimension de
// mois : `set` écrase, rien à versionner. Une parente peut être « détaillée » :
// ce sont alors ses sous-catégories qui portent les montants et son budget
// **est** leur somme — elle n'en garde aucun à elle (CHECK
// `categories_detailed_no_amount`), ce qui rend l'invariant vrai par
// construction plutôt que par un trigger.
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
  /** Parente dont le budget est réparti sur ses sous-catégories. */
  detailed: boolean;
  /** Dépense mensuelle moyenne sur les 6 mois complets, arrondie à 5 €. */
  average: number;
  /** Historique trop court pour proposer un montant (voir MIN_ACTIVE_MONTHS). */
  irregular: boolean;
}

export interface CategoryBudgetPlan {
  rows: CategoryBudgetRow[];
  /** Total mensuel budgété. */
  total: number;
  /** Postes budgétés / postes en tout — « poste » au sens de `budgetSlots`. */
  budgeted: number;
  slots: number;
}

/**
 * Les catégories qui portent réellement un budget : une parente « globale »
 * compte pour elle-même, une parente « détaillée » s'efface derrière ses
 * sous-catégories. Une parente sans sous-catégorie est toujours globale, quel
 * que soit son drapeau — sinon son budget disparaîtrait de l'écran mais pas des
 * compteurs.
 *
 * C'est la seule définition de « poste » : les compteurs d'en-tête en sortent
 * tous, donc ils ne peuvent pas se contredire.
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
        detailed: categories.budgetDetailed,
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
    detailed: node.detailed,
    ...budgetProposal([...(effective.get(node.id)?.values() ?? [])]),
  }));

  // Les compteurs comptent des **postes**, pas des lignes : sous une parente
  // détaillée, ce sont ses sous-catégories qui en sont, et son propre montant
  // n'existe pas (il serait compté deux fois avec le leur).
  const tree = nodes
    .filter((n) => n.parentId === null)
    .map((parent) => ({
      id: parent.id,
      children: nodes.filter((n) => n.parentId === parent.id),
    }));
  const amountById = new Map(rows.map((r) => [r.categoryId, r.amount]));
  const amounts = budgetSlots(
    tree,
    new Set(nodes.filter((n) => n.detailed).map((n) => n.id)),
  ).map((id) => amountById.get(id) ?? null);

  return {
    rows,
    total: amounts.reduce((sum: number, a) => sum + (a ?? 0), 0),
    budgeted: amounts.filter((a) => a !== null).length,
    slots: amounts.length,
  };
}

/**
 * Bascule Global / Détaillé d'une parente. Passer en détaillé **efface** son
 * montant global : le CHECK l'exige, et c'est ce qui garantit que son budget
 * affiché est toujours la somme de ses enfants. L'aller-retour ne le rend donc
 * pas — les montants des enfants, eux, dorment en base et reviennent.
 *
 * Le `parent_id IS NULL` a la même raison qu'`updateCategoryIcon` : le drapeau
 * n'a aucun sens sur une sous-catégorie, et posé là il lui effacerait son
 * montant.
 */
export async function setCategoryDetailed(
  organizationId: string,
  categoryId: number,
  detailed: boolean,
): Promise<void> {
  const updated = await db
    .update(categories)
    .set({ budgetDetailed: detailed, ...(detailed && { budgetAmount: null }) })
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.organizationId, organizationId),
        isNull(categories.parentId),
      ),
    )
    .returning({ id: categories.id });
  if (updated.length === 0) throw new Error("Catégorie parente introuvable.");
}

// Le `WHERE` porte l'espace : un id venu du client et appartenant à un autre
// foyer ne touche aucune ligne. Un `UPDATE` à zéro ligne ne lève pas, d'où le
// `returning` — l'écran attend une confirmation.
export async function setCategoryBudget(
  organizationId: string,
  categoryId: number,
  amount: number | null,
): Promise<void> {
  const value = amount === null ? null : amount.toFixed(2);
  const updated = await db
    .update(categories)
    .set({
      budgetAmount: value,
      // Poser un montant sur une catégorie, c'est dire qu'elle porte son propre
      // budget : le drapeau tombe avec. Sans ça une parente détaillée puis
      // vidée de ses sous-catégories reste `detailed` en base alors que l'écran
      // la rend globale — son champ accepte la saisie et le CHECK la refuse, et
      // la bascule est hors de portée (l'entrée de menu est cachée sans
      // sous-catégorie). Vider un montant, lui, ne dé-détaille rien.
      ...(value !== null && { budgetDetailed: false }),
    })
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.organizationId, organizationId),
      ),
    )
    .returning({ id: categories.id });
  if (updated.length === 0) throw new Error("Catégorie introuvable.");
}

// « Tout vider » ne vide que l'espace courant, et remet les parentes en
// « Global » : le drapeau sans montant n'est pas un état neutre, il afficherait
// « somme de N sous-cat. » sur une somme vide.
export async function clearCategoryBudgets(
  organizationId: string,
): Promise<void> {
  await db
    .update(categories)
    .set({ budgetAmount: null, budgetDetailed: false })
    .where(eq(categories.organizationId, organizationId));
}
