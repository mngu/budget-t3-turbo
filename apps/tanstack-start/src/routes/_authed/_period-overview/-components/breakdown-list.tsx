"use client";

import { TriangleAlertIcon } from "lucide-react";

import { cn } from "@budget/ui";
import { Toolbar } from "@budget/ui/toolbar";

import type { RevueBudgets } from "~/lib/revue-budgets";
import type { RevueCategory } from "~/lib/revue-categories";
import { CategoryIcon } from "~/component/category-icon";
import { shadeCategoryColor } from "~/lib/category-color";
import { euro } from "~/lib/format";
import { budgetCaption, BudgetGauge } from "./budget-gauge";

export interface BreakdownItem {
  name: string;
  total: number;
  /** Teinte de la barre et de l'icône, déjà résolue au thème. */
  color: string;
  /**
   * Nom d'icône Lucide. Trois états, pas deux : **absent** = pas d'emplacement
   * d'icône du tout (les sous-catégories n'en ont pas, elles se lisent dans la
   * famille de leur parent), `null` = parente sans icône choisie, l'emplacement
   * porte le carré pointillé de `CategoryIcon`. Aplatir le test en
   * `row.icon && …` ferait disparaître le second cas.
   */
  icon?: string | null;
  /**
   * Le segment « à classer » du poste : ce qui reste porté par la parente
   * elle-même. Barre hachurée plutôt que pleine et triangle d'alerte — c'est un
   * reste à ranger, pas une sous-catégorie de plus.
   */
  aClasser?: boolean;
  /**
   * Vocabulaire du budget sur cette ligne. **Présent, même à `amount: null`** :
   * la ligne se dessine en jauge plutôt qu'en barre. `breakdownRows` le pose sur
   * *toutes* les lignes, budget ou pas — sinon la colonne changerait de gabarit
   * le jour où le premier budget est saisi. Optionnel malgré tout : la ligne
   * fabriquée du « + N autres » n'en a pas, elle n'agrège aucun poste réel.
   *
   * `amount: null` = rien ne budgète cette ligne (ou la revue ne compare pas) :
   * la jauge peint la seule dépense, dans la teinte du poste.
   *
   * `covered` = la part de `total` qu'un budget couvre. Le reste est hachuré —
   * d'où `covered: 0` sur le segment « à classer » d'une parente détaillée, que
   * rien ne peut budgéter.
   */
  budget?: { amount: number | null; covered: number };
  /** Absent = ligne de lecture seule (les sous-catégories ne se creusent pas). */
  onSelect?: () => void;
  /** Infobulle : ce que fera le clic. */
  title?: string;
}

// La maquette coupe à 13 lignes et replie le reste : au-delà, les barres
// deviennent illisibles et la colonne déborde.
const MAX_ROWS = 13;

/**
 * L'échelle de **toutes** les lignes de la colonne : le plus grand entre la plus
 * grosse dépense et le plus gros budget. Les budgets en font partie, sinon un
 * poste dépassant son budget serait le seul à déborder de la piste ; et surtout
 * l'échelle est unique, jauges et barres ordinaires confondues — une jauge calée
 * sur son propre budget peindrait un poste à 10 € aussi long qu'un poste à
 * 1 700 €, et la colonne ne se lirait plus de haut en bas.
 *
 * `1` évite la division par zéro.
 */
const breakdownScale = (rows: BreakdownItem[]) =>
  Math.max(...rows.map((r) => Math.max(r.total, r.budget?.amount ?? 0)), 1);

/**
 * Les lignes du niveau affiché : les postes parents, ou les sous-catégories du
 * poste ouvert, jauge de budget comprise. Fonction pure, sans **geste** attaché —
 * chaque écran décore ensuite ce que le clic doit faire, et les deux ne font pas
 * la même chose : sur `/` il fait *descendre* l'anneau, sur `/transactions` il
 * pose le filtre de catégorie.
 *
 * La jauge, elle, est ici et non dans les écrans : les deux colonnes comparent
 * au budget depuis le 2026-08-07 et ne peuvent pas en décider différemment.
 */
export function breakdownRows(
  categories: RevueCategory[],
  parent: RevueCategory | null,
  resolveColor: (color: string) => string,
  /**
   * La comparaison telle que le loader du layout l'a tranchée. Passée entière et
   * non réduite à un booléen : `off !== null` est silencieusement inversible aux
   * deux appels, et l'inverser fait disparaître toutes les jauges sans erreur.
   */
  budgets: RevueBudgets,
): BreakdownItem[] {
  const off = budgets.off !== null;
  if (!parent)
    return categories.map((category) => ({
      name: category.name,
      total: category.total,
      color: resolveColor(category.color),
      icon: category.icon,
      budget: categoryGauge(category, off),
    }));

  // Une parente est « détaillée » quand ce sont ses sous-catégories qui portent
  // les montants. Rien à demander au serveur : si l'une d'elles a un budget,
  // c'est qu'elle l'est — et sinon elle se lit comme globale, exactement comme
  // `budgetSlots` en décide côté base.
  const detailed = parent.subs.some((sub) => sub.budget !== null);
  // Une sous-catégorie n'a pas de couleur propre : c'est un palier de la teinte
  // de son parent, du plus dense au plus proche de la surface.
  const base = resolveColor(parent.color);
  return parent.subs.map((sub, index) => ({
    name: sub.name,
    total: sub.total,
    color: shadeCategoryColor(base, index, parent.subs.length),
    // `filter: null` est la marque du segment fabriqué par `byCategory` — le
    // reliquat porté par la parente, qu'aucune ligne de `categories` ne décrit.
    aClasser: sub.filter === null,
    budget: subGauge(sub, off, detailed),
  }));
}

/**
 * Jauge d'un poste. Son budget global couvre tout ce qu'il porte ; celui d'une
 * parente détaillée s'arrête à ses sous-catégories budgétées, et le reliquat
 * « à classer » part en hachures. Sans budget — ou comparaison écartée — la
 * dépense se peint entière : la ligne garde sa jauge et son gabarit.
 */
const categoryGauge = (category: RevueCategory, off: boolean) =>
  off || category.budget === null
    ? { amount: null, covered: category.total }
    : { amount: category.budget, covered: category.covered };

/**
 * Jauge d'une sous-catégorie : elle porte son budget seule, rien n'en déborde.
 *
 * Le segment « à classer » d'une parente **détaillée** est le seul cas où rien
 * n'est couvert : c'est de la dépense qu'aucun budget ne peut atteindre, et elle
 * se peint donc tout en hachures. Sous une parente globale, au contraire, il
 * fait partie de ce que le budget de la parente couvre — la ligne se lit alors
 * comme n'importe quelle autre.
 */
const subGauge = (
  sub: RevueCategory["subs"][number],
  off: boolean,
  detailed: boolean,
) => {
  if (sub.filter === null && detailed && !off)
    return { amount: null, covered: 0 };
  return off || sub.budget === null
    ? { amount: null, covered: sub.total }
    : { amount: sub.budget, covered: sub.total };
};

/**
 * Les postes du niveau affiché, du plus élevé au plus faible, chacun sous sa
 * barre proportionnelle — la colonne de droite de la revue, à droite de
 * l'anneau sur `/` et de la table sur `/transactions`.
 *
 * Montée par chaque écran et non par le layout `_revue` : sur `/`, cliquer une
 * ligne fait descendre l'anneau dans ses sous-catégories, et le niveau de
 * l'anneau est un état de l'écran. Le composant qui commande ce niveau doit donc
 * porter le gestionnaire de la ligne (voir `RevuePanel`).
 *
 * Masquée sous `lg` : elle ne peut pas s'empiler sous l'écran courant, la table
 * y prendrait toute la hauteur. L'anneau, lui, se lit seul — son centre affiche
 * déjà le poste survolé et sa part.
 *
 * Le décompte des sous-catégories n'y figure pas : la maquette le calcule mais
 * le masque (`listMetaDisplay: 'none'`), il a migré en tête de la colonne de
 * droite du bandeau. Le `meta` ci-dessous est l'*autre* intitulé, celui de
 * `Breakdown.dc.html`, qui ne parle que de budget.
 */
export function BreakdownList({
  rows,
  fold = false,
}: {
  rows: BreakdownItem[];
  /**
   * Replier la queue de liste sous un « + N autres ». La maquette ne le fait
   * **que** sur les sous-catégories (`shown = subs.slice(0, LIST_MAX)`), jamais
   * sur les catégories parentes, dont elle rend toujours la liste entière : au
   * premier niveau chaque ligne est une porte d'entrée vers ses enfants, et le
   * repli la condamnerait — c'est ce qui faisait disparaître « Sans catégorie »,
   * dernière de la liste par construction, derrière un « + 1 autres ».
   */
  fold?: boolean;
}) {
  const shown = fold ? rows.slice(0, MAX_ROWS) : rows;
  const rest = fold ? rows.slice(MAX_ROWS) : [];
  const restTotal = rest.reduce((acc, r) => acc + r.total, 0);
  // L'échelle porte sur **toutes** les lignes, repliées comprises : sinon la
  // barre du « + N autres » dépasserait celle du plus gros poste affiché.
  const max = breakdownScale(rows);
  // La colonne de reste, elle, ne s'ouvre que s'il y a un reste à écrire :
  // aucune ligne budgétée, aucun « reste 45 € », 74 px de vide en moins.
  const captioned = rows.some((row) => row.budget?.amount != null);

  return (
    <div className={cn("hidden flex-none flex-col pt-4 lg:flex")}>
      {/* La zone de défilement *est* la barre d'outils : une seule tabulation
          entre dans la colonne, les flèches haut/bas la parcourent en bouclant.
          Une liste de treize boutons prenait sinon treize tabulations à
          traverser — et les lignes de lecture seule restent atteignables
          (`focusableWhenDisabled`, actif par défaut), sans quoi la colonne
          serait muette au clavier dès qu'on descend dans un poste.
          (Home/Fin ne font rien : `Toolbar` n'active pas `enableHomeAndEndKeys`
          du composite.) */}
      <Toolbar.Root
        orientation="vertical"
        aria-label="Répartition par poste"
        className="flex min-h-0 flex-1 scrollbar-thin [scrollbar-color:var(--border-strong)_transparent] flex-col overflow-y-auto"
      >
        {/* Clé de **position** et non de nom : c'est ce qui fait exister la
            transition de la barre. Keyée par nom, chaque changement de niveau ou
            de période démonte toutes les lignes et les remonte à leur largeur
            finale — la transition est bien posée mais ne se déclenche jamais.
            Réutiliser le nœud de même rang le fait glisser de l'ancienne largeur
            à la nouvelle, comme le `sc-for` de la maquette. Sans danger ici : la
            ligne n'a ni état local ni champ de saisie. */}
        {shown.map((row, index) => (
          <BreakdownRow key={index} row={row} max={max} captioned={captioned} />
        ))}
        {rest.length > 0 && (
          <BreakdownRow
            row={{
              name: `+ ${rest.length} autres`,
              total: restTotal,
              color: "var(--border-strong)",
            }}
            max={max}
            captioned={captioned}
          />
        )}
      </Toolbar.Root>
    </div>
  );
}

/**
 * Emplacement d'icône : plus large que l'icône elle-même, et aligné par sa base
 * comme le reste de la rangée — d'où le décalage d'un pixel et demi, repris tel
 * quel de la maquette.
 */
const ICON_SLOT =
  "flex h-3.5 w-4 flex-none translate-y-[1.5px] items-center justify-center";

/**
 * Une ligne de répartition : l'icône du poste, l'intitulé, le montant, et sous
 * eux la barre proportionnelle. Partagée par les deux colonnes de postes de la
 * revue — seule la *source* des lignes et le geste attaché diffèrent d'un écran
 * à l'autre, le dessin de la ligne est le même (`Breakdown.dc.html`).
 *
 * La barre est **pleinement saturée sur sa propre rangée** et non un fond
 * translucide derrière le texte : c'est le changement du 2026-08-04, motivé
 * dans la maquette par la lisibilité de l'intitulé.
 */
function BreakdownRow({
  row,
  max,
  captioned,
}: {
  row: BreakdownItem;
  max: number;
  /** Au moins une ligne a un budget chiffré : la colonne de reste est ouverte. */
  captioned: boolean;
}) {
  const caption =
    row.budget?.amount == null
      ? null
      : budgetCaption(row.budget.covered, row.budget.amount);
  // La barre « à classer » garde sa trame dans la teinte du poste — c'est le
  // segment que la parente porte encore en propre. Quand un budget est en jeu
  // elle n'a plus de segment consommé du tout (`covered: 0`) et ce sont les
  // hachures grises du hors-budget qui prennent toute la longueur.
  const fill = row.aClasser
    ? `repeating-linear-gradient(90deg, ${row.color} 0 3px, transparent 3px 6px)`
    : row.color;
  return (
    // **Toujours un `<button>`**, désactivé quand la ligne ne se creuse pas, et
    // jamais un `<div>` selon le cas : React ne réutilise pas un nœud dont le
    // type d'élément change, et descendre dans un poste fait justement passer
    // toutes les lignes de cliquables à lecture seule. Le nœud était donc
    // reconstruit à sa largeur finale et la transition de la barre, pourtant
    // posée, ne se déclenchait jamais.
    //
    // `Toolbar.Button` plutôt qu'un `<button>` nu : c'est lui qui inscrit la
    // ligne dans le parcours aux flèches de `Toolbar.Root`. Il ne pose **pas**
    // l'attribut natif `disabled` (il resterait hors du parcours) mais
    // `aria-disabled` — d'où `not-aria-disabled:` sur le survol, `enabled:` ne
    // distinguant plus rien ici.
    <Toolbar.Button
      type="button"
      title={row.title}
      disabled={!row.onSelect}
      onClick={row.onSelect}
      className={cn(
        "not-aria-disabled:hover:bg-accent focus-visible:ring-accent-soft flex flex-none flex-col justify-center gap-1.5 rounded-lg p-2 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-inset motion-reduce:transition-none",
      )}
    >
      <div className="flex items-baseline gap-2">
        {row.aClasser ? (
          <span className={ICON_SLOT}>
            <TriangleAlertIcon className="text-warn size-3" aria-hidden />
          </span>
        ) : (
          row.icon !== undefined && (
            <span className={ICON_SLOT} style={{ color: row.color }}>
              <CategoryIcon name={row.icon} className="size-3.5" />
            </span>
          )
        )}
        <span
          className={cn(
            "text-subheading min-w-0 flex-1 truncate leading-[1.15] font-normal",
            // Une ligne de poste et un reste à ranger pèsent leur plein poids ;
            // seules les sous-catégories rangées s'allègent.
            row.aClasser || row.icon !== undefined
              ? "font-semibold"
              : "font-[450]",
          )}
        >
          {row.name}
        </span>
        <span className="num text-body flex-none leading-[1.15] tracking-[-0.02em]">
          {euro.format(row.total)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {/* Boîte de 11 px : la piste en fait 7 et le repère de budget la déborde
            d'en haut et d'en bas, il ne peut donc pas vivre dedans (elle
            découpe). Elle est plate quand la colonne ne parle pas budget. */}
        <div className={cn("relative flex h-3 min-w-0 flex-1 items-center")}>
          {row.budget ? (
            <BudgetGauge
              covered={row.budget.covered}
              budget={row.budget.amount}
              uncovered={row.total - row.budget.covered}
              // L'échelle de la colonne, jamais celle de la ligne : c'est toute
              // la raison d'être du prop (voir `breakdownScale`).
              scale={max}
              fill={fill}
              className="absolute inset-x-0"
            />
          ) : (
            <div
              className={cn(
                "bg-border-strong/60 absolute inset-x-0 h-2 overflow-hidden rounded-full",
              )}
            >
              <span
                className="block h-full min-w-1 rounded-full transition-[width] duration-[260ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"
                style={{
                  width: `${((row.total / max) * 100).toFixed(2)}%`,
                  background: fill,
                }}
              />
            </div>
          )}
          {/* Le budget : sur l'axe partagé de la colonne il n'est plus le bord
              droit de la piste, plus rien ne dirait où il se trouve. */}
          {row.budget?.amount != null && (
            <span
              title="Budget"
              className="bg-foreground absolute inset-y-0 w-[1.5px] rounded-xs opacity-55 transition-[left] duration-[460ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"
              style={{
                left: `${((row.budget.amount / max) * 100).toFixed(2)}%`,
              }}
            />
          )}
        </div>
        {/* Colonne de reste : ouverte dès qu'une ligne a un budget chiffré, vide
            sur celles qui n'en ont pas — sinon leur jauge irait jusqu'au bord et
            les lignes ne s'aligneraient plus entre elles. */}
        {captioned && (
          <span
            className={cn(
              "num text-label w-19 flex-none overflow-hidden text-right tracking-[-0.01em] whitespace-nowrap",
              caption?.over
                ? "text-bad font-semibold"
                : "text-subtle font-medium",
            )}
          >
            {caption?.text}
          </span>
        )}
      </div>
    </Toolbar.Button>
  );
}
