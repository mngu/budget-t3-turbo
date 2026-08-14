import { cn } from "@budget/ui";

import type { Delta } from "../-lib/history";
import type { RevueBudgets } from "../-lib/revue-budgets";
import { euro0, signedEuro0 } from "~/lib/format";
import { BUDGETS_OFF_MESSAGES } from "../-lib/revue-budgets";
import { budgetCaption, BudgetGauge } from "./budget-gauge";
import { DeltaAmount, DeltaPill } from "./delta-pill";

/**
 * Bandeau de tête — portage de `KpiBand.dc.html` (projet Claude Design
 * fc13100e-…). Le solde en gros à gauche, les deux flux à droite sur une paire
 * de barres proportionnelles ; chacun des trois chiffres porte son écart à la
 * moyenne de référence, en pastille (pourcentage) et en clair (euros).
 *
 * Monté une seule fois, par le layout `_revue` : les deux écrans qu'il coiffe
 * disent la même chose du même périmètre. Il ne calcule aucun écart lui-même —
 * la moyenne de référence est choisie par l'appelant (voir `../-lib/history`).
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
