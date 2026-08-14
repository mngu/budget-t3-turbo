import { cn } from "@budget/ui";

import { euro0 } from "~/lib/format";

/**
 * Jauge de budget — portage des `jauge()` / `jaugeEch()` de `Revue du mois.dc.html`.
 *
 * Elle peint la dépense en trois segments : ce qui tient dans le budget, le
 * dépassement, et la dépense qu'aucun budget ne couvre (le reliquat « à
 * classer » d'une parente détaillée), hachurée.
 *
 * **Tout dépend de l'axe**, et c'est le seul réglage — `scale` :
 *
 * - **Axe propre** (`scale` absent) : la piste *est* le poste, sa longueur vaut
 *   `max(consommé, budget) + hors budget`. Le bord droit est donc le budget tant
 *   qu'on ne l'a pas dépassé, et les hachures se posent après lui, laissant le
 *   reste à dépenser en piste vide. C'est la jauge du bandeau et du poste
 *   ouvert, qui n'ont qu'une jauge à l'écran et rien à quoi se comparer.
 * - **Axe partagé** (`scale` fourni) : toutes les lignes d'une colonne se
 *   mesurent à la même règle, donc la longueur peinte doit être la **dépense** —
 *   les hachures reprennent à la fin du consommé et non à la fin du budget,
 *   sinon un poste sous-consommé se dessinerait plus long qu'il n'a dépensé. Le
 *   budget n'étant plus le bord droit de la piste, il lui faut un repère : c'est
 *   le trait que `BreakdownRow` pose par-dessus (il déborde la piste, il ne peut
 *   pas vivre dans ce composant, qui la découpe).
 *
 * `budget` à `null` peint la seule dépense, dans la teinte du poste : c'est une
 * ligne que rien ne budgète, et la même formule la rend sans cas particulier.
 *
 * Le repère d'allure du mois (`pace`, prorata des jours écoulés) n'est pas
 * porté : la maquette le calcule, puis le passe à `null` et masque sa légende.
 */
export function BudgetGauge({
  covered,
  budget,
  uncovered = 0,
  scale,
  fill,
  className,
}: {
  /** Dépense de la période que ce budget couvre. */
  covered: number;
  /** `null` = rien ne budgète cette ligne : la dépense se peint telle quelle. */
  budget: number | null;
  /** Dépense de la même ligne qu'aucun budget ne couvre. */
  uncovered?: number;
  /** Valeur qui occupe toute la piste. Absente, la jauge se cale sur elle-même. */
  scale?: number;
  /** Teinte du segment consommé : celle du poste, `--muted` pour le bandeau. */
  fill: string;
  className?: string;
}) {
  const within = budget === null ? covered : Math.min(covered, budget);
  const over = budget === null ? 0 : Math.max(0, covered - budget);
  // Sur un axe propre les hachures suivent le budget — le reste à dépenser
  // s'intercale en piste vide ; sur un axe partagé elles suivent le consommé,
  // pour que la longueur peinte reste la dépense.
  const hatchAt =
    scale === undefined ? Math.max(covered, budget ?? covered) : covered;
  // `|| 1` : une ligne à zéro sans budget diviserait par zéro.
  const full = (scale ?? hatchAt + uncovered) || 1;
  const pct = (value: number) => `${((value / full) * 100).toFixed(2)}%`;

  return (
    <span
      className={cn(
        "bg-track relative block h-2 overflow-hidden rounded-full",
        className,
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 rounded-full",
          within > 0 && "min-w-1",
          SLIDE,
        )}
        style={{ width: pct(within), background: fill }}
      />
      {/* Les 2 px retranchés à chaque segment le détachent du précédent : sans
          eux les teintes se touchent et se lisent comme une seule. */}
      {over > 0 && (
        <span
          className={cn(
            "bg-bad absolute inset-y-0 min-w-1 rounded-full",
            SLIDE,
          )}
          style={{
            left: `calc(${pct(within)} + 2px)`,
            width: `calc(${pct(over)} - 2px)`,
          }}
        />
      )}
      {uncovered > 0 && (
        <span
          className={cn("absolute inset-y-0 min-w-1", SLIDE)}
          style={{
            left: `calc(${pct(hatchAt)} + 2px)`,
            width: `calc(${pct(uncovered)} - 2px)`,
            background: BUDGET_HATCH,
          }}
        />
      )}
    </span>
  );
}

const SLIDE =
  "transition-[width,left] duration-[460ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none";

/**
 * Hachures du segment « dépense hors budget ». Exportées : la légende du pied
 * de la colonne des postes en reprend un échantillon, et les deux ne peuvent
 * pas diverger.
 */
export const BUDGET_HATCH =
  "repeating-linear-gradient(90deg, color-mix(in oklab, var(--subtle) 75%, transparent) 0 2px, transparent 2px 5px)";

/**
 * Le chiffre à droite d'une jauge : ce qu'il reste, ou de combien le budget est
 * dépassé. Un dépassement s'annonce en rouge et en gras — c'est le seul état de
 * la jauge qui appelle une décision.
 */
export function budgetCaption(covered: number, budget: number) {
  const rest = budget - covered;
  return {
    text: rest < 0 ? `+${euro0.format(-rest)}` : `reste ${euro0.format(rest)}`,
    over: rest < 0,
  };
}
