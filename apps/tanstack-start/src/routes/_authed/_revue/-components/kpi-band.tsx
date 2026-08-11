import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { cn } from "@budget/ui";

import type { Delta } from "~/lib/history";
import type { RevueBudgets } from "~/lib/revue-budgets";
import { euro0, signedEuro0 } from "~/lib/format";
import { BUDGETS_OFF_MESSAGES } from "~/lib/revue-budgets";
import { BREAKDOWN_WIDTH } from "./breakdown-list";
import { budgetCaption, BudgetGauge } from "./budget-gauge";

/**
 * Bandeau de tête — portage de `KpiBand.dc.html` (projet Claude Design
 * fc13100e-…). Le solde en gros à gauche, les deux flux à droite sur une paire
 * de barres proportionnelles ; chacun des trois chiffres porte son écart à la
 * moyenne de référence, en pastille (pourcentage) et en clair (euros).
 *
 * Monté une seule fois, par le layout `_revue` : les deux écrans qu'il coiffe
 * disent la même chose du même périmètre. Il ne calcule aucun écart lui-même —
 * la moyenne de référence est choisie par l'appelant (voir `~/lib/history`).
 */
/** Un flux du bandeau : son montant *positif* et son écart à la moyenne. */
interface Flow {
  amount: number;
  delta: Delta | null;
}

export function KpiBand({
  label,
  balance,
  balanceDelta,
  flow,
  budget,
}: {
  label: string;
  /** Solde de la période ou de la sélection, signé. */
  balance: number;
  balanceDelta: Delta | null;
  /**
   * Les deux rangées de flux. Absentes, le bandeau se réduit au solde : c'est
   * le `showFlow` de la maquette, que la revue met à `false` quand un poste
   * s'ouvre, pour lui céder la droite du bandeau. Un objet plutôt que deux props
   * plus un booléen — un demi-bandeau de flux ne veut rien dire, la paire ne
   * doit pas pouvoir se dissocier.
   */
  flow?: { revenues: Flow; expenses: Flow };
  /**
   * Troisième rangée : la dépense de la période contre l'enveloppe mensuelle de
   * `/budgets`. Une comparaison écartée ne fait pas disparaître la rangée — elle
   * y met sa raison en clair, sans quoi l'écran laisserait croire qu'aucun
   * budget n'existe (voir `BUDGETS_OFF_MESSAGES`). Rangée du bloc de flux et non
   * du solde : elle en partage la grille, ses trois colonnes doivent s'aligner.
   */
  budget?: RevueBudgets;
}) {
  // La plus grosse des deux barres fait toute la largeur, l'autre s'y rapporte :
  // c'est un comparateur des deux flux entre eux, pas une part d'un tout.
  const peak = Math.max(flow?.revenues.amount ?? 0, flow?.expenses.amount ?? 0);
  // À zéro, les deux pistes restent vides. La maquette retombe sur une part de
  // 50 %, ce qui peint les deux barres à fond sur une sélection sans une seule
  // ligne — l'écran le plus vide serait le plus rempli.
  const width = (amount: number) =>
    peak > 0 ? `${((amount / peak) * 100).toFixed(1)}%` : "0%";

  return (
    // `flex-wrap` n'est pas dans la maquette, qui mesure son conteneur : il
    // évite que le bloc de flux, à largeur minimale, ne pousse le solde hors de
    // l'écran sur une fenêtre étroite.
    <div className="flex flex-none flex-wrap items-center gap-x-[clamp(22px,3vw,40px)] gap-y-3">
      <div>
        <div className="label-caps">{label}</div>
        <div
          className={cn(
            "num text-hero mt-0.5",
            balance < 0 ? "text-bad" : "text-ok",
          )}
        >
          {signedEuro0.format(balance)}
        </div>
        {/* Hauteur fixe, occupée ou non : sans elle le gros chiffre remonterait
            dès qu'un écran n'a pas d'historique à comparer. */}
        <div className="mt-1.5 flex items-center gap-2.5 whitespace-nowrap">
          <DeltaPill delta={balanceDelta} worseWhenUp={false} />
          {/* La maquette masque cette mention sous 1 200 px de conteneur, la
              pastille disant déjà le sens ; ici c'est un point d'arrêt. */}
          <DeltaAmount
            delta={balanceDelta}
            className="text-subtle text-meta max-lg:hidden"
          />
        </div>
      </div>

      {flow && (
        <div className="flex max-w-140 min-w-75 flex-1 flex-col">
          <FlowRow
            label="Entrées"
            tone="ok"
            amount={flow.revenues.amount}
            width={width(flow.revenues.amount)}
            delta={flow.revenues.delta}
            // Des entrées qui montent sont une bonne nouvelle, des sorties non :
            // les pastilles du bandeau n'ont pas toutes la même polarité.
            worseWhenUp={false}
          />
          <FlowRow
            label="Sorties"
            tone="bad"
            amount={flow.expenses.amount}
            width={width(flow.expenses.amount)}
            delta={flow.expenses.delta}
            worseWhenUp
            className="border-border border-t"
          />
          {budget && <BudgetRow budget={budget} />}
        </div>
      )}
    </div>
  );
}

/**
 * Colonne de droite du bandeau, le poste ouvert : intitulé calé à gauche,
 * contenu sur une rangée de 33 px calée à droite, écart en dessous. Elle
 * n'existe que tant qu'un poste l'occupe — c'est la contrepartie du bloc de
 * flux, qui disparaît au même moment.
 *
 * Pas de prop de polarité : un poste est toujours une sortie, et une sortie qui
 * monte est toujours une mauvaise nouvelle.
 */
export function KpiFocus({
  delta,
  budget,
  children,
}: {
  label: string;
  delta: Delta | null;
  /**
   * Comparaison au budget du poste ouvert. **Absent** = la revue ne compare pas
   * du tout (la raison est déjà dite dans le bandeau, la répéter ici serait du
   * bruit) ; `amount: null` = c'est ce poste-là qui n'a pas de budget, et
   * l'écran le dit — un blanc se lirait comme un budget à zéro.
   */
  budget?: {
    amount: number | null;
    covered: number;
    uncovered: number;
    /** Teinte du poste : sa jauge appartient à la même famille que son arc. */
    fill: string;
  };
  children: React.ReactNode;
}) {
  const caption =
    budget?.amount == null
      ? null
      : budgetCaption(budget.covered, budget.amount);
  return (
    // Largeur de la colonne de droite. La maquette la calcule, mais avec la
    // *même* expression que la colonne des postes (`rdStackPx === listPx`) :
    // c'est un alignement, pas une coïncidence — d'où la reprise à l'identique
    // du `BREAKDOWN_WIDTH` de `breakdown-list.tsx`.
    <div className={cn(BREAKDOWN_WIDTH, "flex max-w-full flex-none flex-col items-end")}>
      <div className="mt-0.5 flex h-8 w-full min-w-0 items-center justify-between gap-3.5">
        {children}
      </div>
      <div className="flex min-h-5 items-center justify-end gap-2.5 whitespace-nowrap">
        {delta ? (
          <>
            <DeltaPill delta={delta} worseWhenUp />
            <DeltaAmount delta={delta} className="text-subtle text-meta" />
          </>
        ) : (
          <span className="text-subtle text-meta">
            Pas d'historique de comparaison
          </span>
        )}
      </div>

      {budget &&
        (budget.amount === null || caption === null ? (
          <div className="text-subtle text-meta mt-2.5 w-full text-right">
            Pas de budget sur ce poste
          </div>
        ) : (
          <div className="mt-2.5 flex w-full flex-col gap-1">
            <BudgetGauge
              covered={budget.covered}
              budget={budget.amount}
              uncovered={budget.uncovered}
              fill={budget.fill}
            />
            <div className="num text-label flex items-baseline justify-between gap-2.5">
              <span className="text-subtle">
                Budget {euro0.format(budget.amount)}
              </span>
              <span
                className={cn(
                  caption.over
                    ? "text-bad font-semibold"
                    : "text-subtle font-medium",
                )}
              >
                {caption.text}
              </span>
            </div>
          </div>
        ))}
    </div>
  );
}

function FlowRow({
  label,
  tone,
  amount,
  width,
  delta,
  worseWhenUp,
  className,
}: {
  label: string;
  tone: "ok" | "bad";
  amount: number;
  width: string;
  delta: Delta | null;
  worseWhenUp: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex h-8 items-center gap-3", className)}>
      <span className="label-caps w-12 flex-none">{label}</span>
      <span className="bg-track h-2 min-w-10 flex-1 overflow-hidden rounded-full">
        <span
          className={cn(
            "block h-full rounded-full opacity-85",
            tone === "ok" ? "bg-ok" : "bg-bad",
          )}
          style={{ width }}
        />
      </span>
      <span
        className={cn(
          "num text-amount min-w-28 flex-none text-right",
          tone === "ok" ? "text-ok" : "text-bad",
        )}
      >
        {euro0.format(amount)}
      </span>
      {/* Largeur fixe, à la différence de la pastille du solde : les deux
          rangées alignent leurs pastilles l'une sous l'autre, quel que soit le
          nombre de chiffres du pourcentage. */}
      <DeltaPill
        delta={delta}
        worseWhenUp={worseWhenUp}
        className="w-17 justify-center"
      />
      {/* Premier sacrifié quand la fenêtre se resserre — la maquette le retire
          sous 1 320 px de conteneur. */}
      <DeltaAmount
        delta={delta}
        worseWhenUp={worseWhenUp}
        className="text-meta min-w-26 font-semibold max-xl:hidden"
      />
    </div>
  );
}

/**
 * La rangée « Budget » du bandeau. Elle reprend au pixel près les largeurs de
 * `FlowRow` — les trois barres du bandeau alignent leurs deux extrémités, une
 * largeur qui dérive ici les décale toutes.
 *
 * Le libellé et la jauge sont le seul contenu garanti : le chiffre de droite
 * (« reste 45 € ») se retire sous `xl` comme les mentions « vs moy. » des deux
 * rangées de flux, faute de quoi la jauge serait plus courte que les barres au
 * -dessus d'elle. Le segment rouge du dépassement, lui, ne se cache jamais.
 */
function BudgetRow({ budget }: { budget: RevueBudgets }) {
  if (budget.off !== null) {
    return (
      <div className="border-border flex min-h-8 items-center gap-3 border-t">
        <span className="label-caps w-12 flex-none">Budget</span>
        <span className="text-subtle text-meta min-w-0 flex-1 py-2">
          {BUDGETS_OFF_MESSAGES[budget.off]}
        </span>
      </div>
    );
  }

  const caption = budgetCaption(budget.covered, budget.total);
  return (
    <div className="border-border flex h-8 items-center gap-3 border-t">
      <span className="label-caps w-12 flex-none">Budget</span>
      <BudgetGauge
        covered={budget.covered}
        budget={budget.total}
        uncovered={budget.uncovered}
        // Teinte neutre : l'enveloppe du mois n'appartient à aucun poste, et
        // la peindre en vert ou en rouge trancherait à la place du lecteur.
        fill="color-mix(in oklab, var(--muted-foreground) 62%, transparent)"
        className="h-2 min-w-10 flex-1"
      />
      <span className="num text-amount text-muted-foreground min-w-28 flex-none text-right">
        {euro0.format(budget.total)}
      </span>
      {/* Colonne vide de la pastille : un budget n'a pas d'écart à une moyenne,
          mais la retirer décalerait le chiffre de droite d'une rangée à l'autre. */}
      <span className="w-17 flex-none" />
      <span
        className={cn(
          "num text-label min-w-26 flex-none text-right max-xl:hidden",
          caption.over ? "text-bad font-semibold" : "text-subtle font-medium",
        )}
      >
        {caption.text}
      </span>
    </div>
  );
}

/**
 * Écart en pourcentage. Sa couleur ne suit pas son signe mais sa *polarité* :
 * des sorties en hausse sont une mauvaise nouvelle, des entrées en hausse non.
 */
function DeltaPill({
  delta,
  worseWhenUp,
  className,
}: {
  delta: Delta | null;
  worseWhenUp: boolean;
  className?: string;
}) {
  // Pas de pourcentage quand la référence vaut zéro : « +∞ % » ne dit rien que
  // l'écart en euros ne dise mieux.
  if (delta?.pct == null) return null;
  const bad = worseWhenUp ? delta.amount > 0 : delta.amount < 0;
  return (
    <span
      className={cn(
        "num text-meta flex h-5 flex-none items-center gap-1 rounded-full px-2 font-semibold",
        bad ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok",
        className,
      )}
    >
      {/* Aucune flèche à l'écart nul, comme la maquette : il n'y a pas de sens
          à montrer. */}
      {delta.amount > 0 && (
        <TrendingUpIcon className="size-3" aria-hidden />
      )}
      {delta.amount < 0 && (
        <TrendingDownIcon className="size-3" aria-hidden />
      )}
      {signedPercent.format(delta.pct)} %
    </span>
  );
}

/** L'écart en euros, second rôle de la pastille. */
function DeltaAmount({
  delta,
  worseWhenUp,
  className,
}: {
  delta: Delta | null;
  /** Absent = la mention reste neutre, comme sous le solde de la maquette. */
  worseWhenUp?: boolean;
  className?: string;
}) {
  if (!delta) return null;
  const bad =
    worseWhenUp === undefined
      ? undefined
      : worseWhenUp
        ? delta.amount > 0
        : delta.amount < 0;
  return (
    <span
      className={cn(
        "num flex-none text-right whitespace-nowrap",
        bad === undefined ? undefined : bad ? "text-bad" : "text-ok",
        className,
      )}
    >
      {signedEuro0.format(delta.amount)} vs moy.
    </span>
  );
}

const signedPercent = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
