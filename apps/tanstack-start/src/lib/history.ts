import type { MonthlyCategoryTotal } from "@budget/api";

// Nombre de points de la sparkline des tuiles.
const SPARK_MONTHS = 6;
// Fenêtre de la moyenne de référence (« vs moy. 3 mois »).
const AVERAGE_MONTHS = 3;

// Un mois de référence dont le volume tombe sous cette fraction du volume
// médian de la fenêtre est un mois *partiel*, pas un mois sobre : c'est la
// signature du premier mois importé, qui ne couvre que quelques jours. Le
// compter dans la moyenne écrase la référence et gonfle l'écart affiché — sur
// les données réelles, un mois d'amorçage à 18 transactions faisait passer
// « vs moy. 3 mois » de +33 % à +92 %.
const PARTIAL_MONTH_RATIO = 0.4;

const monthKey = (iso: string) => iso.slice(0, 7);

// Les N clés `YYYY-MM` finissant au mois de `iso`, dans l'ordre chronologique.
function monthsEndingAt(iso: string, count: number): string[] {
  const [year, month] = monthKey(iso).split("-").map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1 - i, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  return keys;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

export interface MonthTotals {
  month: string;
  debit: number;
  credit: number;
  count: number;
}

// Replie l'historique par catégorie en totaux mensuels.
export function totalsByMonth(history: MonthlyCategoryTotal[]): MonthTotals[] {
  const byMonth = new Map<string, MonthTotals>();
  for (const row of history) {
    const entry = byMonth.get(row.month) ?? {
      month: row.month,
      debit: 0,
      credit: 0,
      count: 0,
    };
    entry.debit += row.debit;
    entry.credit += row.credit;
    entry.count += row.count;
    byMonth.set(row.month, entry);
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

// Les mois de référence retenus : les `AVERAGE_MONTHS` qui précèdent celui
// affiché, moins ceux qui sont manifestement partiels. Le mois affiché est
// volontairement exclu — sinon un mois exceptionnel se comparerait en partie à
// lui-même et l'écart serait toujours minoré.
function referenceMonths(totals: MonthTotals[], anchorIso: string): string[] {
  const anchor = monthKey(anchorIso);
  const byMonth = new Map(totals.map((t) => [t.month, t]));
  const candidates = monthsEndingAt(anchorIso, AVERAGE_MONTHS + 1)
    .filter((m) => m !== anchor)
    .map((m) => byMonth.get(m))
    .filter((t): t is MonthTotals => t !== undefined && t.count > 0);

  const reference = median(candidates.map((t) => t.count));
  return candidates
    .filter((t) => t.count >= reference * PARTIAL_MONTH_RATIO)
    .map((t) => t.month);
}

/**
 * Moyenne de chaque catégorie parente sur la fenêtre de référence, en une passe.
 * `null` quand aucun mois de référence n'est exploitable.
 *
 * Volontairement *pas* `compareToAverage` appliqué à l'historique filtré sur une
 * catégorie, qui donnerait des écarts faux dans les deux sens :
 * — la fenêtre est dérivée des totaux tous postes confondus. Un mois sans
 *   dépense dans une catégorie n'a simplement pas de ligne dans `history` ;
 *   `referenceMonths` l'écarterait (`count > 0`) et la moyenne d'un poste
 *   sporadique ne porterait que sur ses mois actifs — surestimée au point
 *   d'inverser le sens de l'écart affiché. Ici l'absence vaut zéro, ce qu'elle est.
 * — le garde-fou « mois partiel » mesure un volume *global* : la médiane des
 *   comptes d'une seule catégorie n'y veut rien dire.
 *
 * La clé est le nom de la catégorie parente, `""` pour les transactions sans
 * catégorie — même convention que `transactions.byCategory`, qui les regroupe
 * sous un libellé vide là où `history` les remonte à `null`.
 */
export function averagesByCategory(
  history: MonthlyCategoryTotal[],
  anchorIso: string,
  pick: (row: MonthlyCategoryTotal) => number,
): Map<string, number> | null {
  const months = referenceMonths(totalsByMonth(history), anchorIso);
  if (months.length === 0) return null;

  const window = new Set(months);
  const sums = new Map<string, number>();
  for (const row of history) {
    if (!window.has(row.month)) continue;
    const key = row.category ?? "";
    sums.set(key, (sums.get(key) ?? 0) + pick(row));
  }
  // Division par la fenêtre entière, pas par le nombre de mois où la catégorie
  // apparaît : c'est tout l'objet du commentaire ci-dessus.
  for (const [key, total] of sums) sums.set(key, total / months.length);
  return sums;
}

export interface Comparison {
  /** Dernières valeurs mensuelles, la période affichée en dernier. */
  points: number[];
  /** Moyenne des mois de référence. `null` si l'historique manque. */
  average: number | null;
  /** Écart relatif à cette moyenne, en pourcentage signé. */
  deltaPct: number | null;
}

export function compareToAverage(
  totals: MonthTotals[],
  anchorIso: string,
  pick: (t: MonthTotals) => number,
  current: number,
): Comparison {
  const byMonth = new Map(totals.map((t) => [t.month, t]));
  const anchor = monthKey(anchorIso);
  const spark = monthsEndingAt(anchorIso, SPARK_MONTHS).map((m) => {
    if (m === anchor) return current;
    const entry = byMonth.get(m);
    return entry ? pick(entry) : 0;
  });

  const previous = referenceMonths(totals, anchorIso)
    .map((m) => byMonth.get(m))
    .filter((t): t is MonthTotals => t !== undefined)
    .map(pick);

  if (previous.length === 0)
    return { points: spark, average: null, deltaPct: null };
  const average = previous.reduce((a, b) => a + b, 0) / previous.length;
  return {
    points: spark,
    average,
    deltaPct: average === 0 ? null : ((current - average) / average) * 100,
  };
}

// Nombre de mois consécutifs, en remontant depuis le mois affiché, où les
// dépenses dépassent les revenus. 0 quand le mois affiché est à l'équilibre.
export function negativeStreak(
  totals: MonthTotals[],
  anchorIso: string,
  currentBalance: number,
): number {
  if (currentBalance >= 0) return 0;
  const anchor = monthKey(anchorIso);
  const byMonth = new Map(totals.map((t) => [t.month, t]));
  let streak = 1;
  for (const month of [...byMonth.keys()].sort().reverse()) {
    if (month >= anchor) continue;
    const entry = byMonth.get(month);
    if (!entry || entry.credit - entry.debit >= 0) break;
    streak += 1;
  }
  return streak;
}
