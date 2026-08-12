import { format, parseISO, subMonths } from "date-fns";

import type { MonthlyCategoryTotal } from "@budget/api";

// Fenêtre de la moyenne de référence (« vs moy. 3 mois »).
//
// ponytail: les mois de référence sont des mois **calendaires** (`monthlyHistory`
// groupe sur `to_char(booking_date, 'YYYY-MM')`), y compris quand le sélecteur de
// période cale le mois sur un autre jour de départ. Les ordres de grandeur
// restent comparables ; rendre la référence cyclique demande de refaire
// l'agrégat côté serveur.
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
//
// L'ancre est le *mois* de `iso`, pris sur la chaîne (`monthKey`) et non sur un
// `Date` : `iso` peut porter une heure UTC (`new Date().toISOString()`), et la
// convertir en heure locale ferait basculer de mois le premier jour à minuit
// passé dans les fuseaux négatifs. Ancré au 1er du mois, le pas de `subMonths`
// ne peut plus dériver.
function monthsEndingAt(iso: string, count: number): string[] {
  const end = parseISO(`${monthKey(iso)}-01`);
  return Array.from({ length: count }, (_, i) =>
    format(subMonths(end, count - 1 - i), "yyyy-MM"),
  );
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

/** Écart d'un montant à sa moyenne de référence. */
export interface Delta {
  /** En euros, signé. */
  amount: number;
  /** En pourcentage de la moyenne, signé. `null` si la moyenne vaut zéro. */
  pct: number | null;
}

/**
 * Écart à la moyenne, tel que les maquettes le calculent : le pourcentage se
 * rapporte à la *valeur absolue* de la référence, sinon une moyenne négative (le
 * solde d'un mois déficitaire) inverse le signe affiché. `null` quand il n'y a
 * pas d'historique ; `pct` seul est `null` quand la référence vaut zéro —
 * l'écart en euros reste lisible, le pourcentage n'aurait aucun sens.
 */
export function deltaTo(current: number, average: number | null): Delta | null {
  if (average === null) return null;
  const amount = current - average;
  return {
    amount,
    pct: average === 0 ? null : (amount / Math.abs(average)) * 100,
  };
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
 * Volontairement *pas* `referenceAverage` appliqué à l'historique filtré sur une
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

/**
 * Moyenne d'une série mensuelle sur la fenêtre de référence — le « vs moy. »
 * des trois chiffres de tête de la revue. `null` quand aucun mois de référence
 * n'est exploitable, ce que l'écran affiche tel quel (« Pas d'historique de
 * comparaison ») plutôt que de comparer à zéro.
 *
 * Elle renvoyait autrefois aussi la sparkline et l'écart déjà calculé, pour les
 * tuiles de synthèse de l'ancienne revue ; celle-ci a été remplacée par l'anneau
 * le 2026-08-03, qui calcule son écart lui-même (`deltaTo`) et n'a pas de
 * sparkline.
 */
export function referenceAverage(
  totals: MonthTotals[],
  anchorIso: string,
  pick: (t: MonthTotals) => number,
): number | null {
  const byMonth = new Map(totals.map((t) => [t.month, t]));
  const previous = referenceMonths(totals, anchorIso)
    .map((m) => byMonth.get(m))
    .filter((t): t is MonthTotals => t !== undefined)
    .map(pick);

  if (previous.length === 0) return null;
  return previous.reduce((a, b) => a + b, 0) / previous.length;
}
