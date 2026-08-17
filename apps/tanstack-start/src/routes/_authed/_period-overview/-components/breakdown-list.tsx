import { LayersIcon } from "lucide-react";

import type { BreakdownByCategories } from "@budget/shared";
import { Toolbar } from "@budget/ui/toolbar";

import { shadeCategoryColor, useCategoryColor } from "~/lib/category-color";
import { euro } from "~/lib/format";
import { useRevueSearch } from "~/lib/use-revue-search";
import { breakdownLevel } from "../-lib/breakdown";
import { BudgetGauge } from "./budget-gauge";

/**
 * La colonne des postes : le même niveau que l'anneau de `/`, en lecture. Les
 * deux sortent de `breakdownLevel` — c'est ce qui leur interdit de se
 * contredire, et ce qui fait qu'un clic ici et un clic sur l'arc correspondant
 * mènent au même endroit.
 */
export function BreakdownList({
  breakdownByCategories,
}: {
  breakdownByCategories: BreakdownByCategories[];
}) {
  const { search, setSearch } = useRevueSearch();
  const resolveColor = useCategoryColor();

  const level = breakdownLevel(breakdownByCategories, search.category);
  const parent = level.parent;
  const parentColor = parent ? resolveColor(parent.color) : null;

  // L'échelle est commune à toute la colonne : une jauge calée sur son propre
  // budget peindrait un poste à 10 € aussi long qu'un poste à 1 700 € juste
  // au-dessus, et la colonne cesserait de se lire de haut en bas.
  const max = Math.max(
    level.total,
    ...level.slices.map((slice) => slice.budget ?? 0),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="h-28 px-2">
        {parent ? (
          <BudgetGauge
            value={level.total}
            max={Math.max(level.total, parent.budget ?? 0)}
            label={parent.name}
            iconName={parent.icon}
            color={parentColor}
            budget={parent.budget}
            valueSize="xl"
          />
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayersIcon aria-hidden />
                <span className="text-subheading">Toutes les catégories</span>
              </div>
              <strong className="num text-amount">
                {euro.format(level.total)}
              </strong>
            </div>
            <div className="text-subtle text-meta flex justify-end">
              {level.postes} poste{level.postes > 1 ? "s" : ""} de dépense ·{" "}
              {breakdownByCategories.length} sous-catégorie
              {breakdownByCategories.length > 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <hr className="w-64" />
      </div>

      <Toolbar.Root
        orientation="vertical"
        aria-label="Répartition par poste"
        className="flex min-h-0 flex-1 scrollbar-thin flex-col overflow-y-auto"
      >
        {level.slices.map((slice, index) => (
          <Toolbar.Button
            // Clé positionnelle, contrairement aux arcs : le nom change à chaque
            // niveau, et c'est la *ligne* qui doit glisser d'une largeur à
            // l'autre plutôt que d'être remontée.
            key={index}
            type="button"
            // Un poste sans sous-catégorie n'ouvre aucun niveau ; au niveau du
            // bas, plus rien ne se creuse.
            disabled={slice.subs === 0}
            className="not-aria-disabled:hover:bg-accent focus-visible:ring-accent-soft flex flex-none cursor-pointer flex-col justify-center gap-1.5 rounded-lg p-2 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-inset motion-reduce:transition-none"
            onClick={() => setSearch({ category: slice.filter })}
          >
            <BudgetGauge
              value={slice.total}
              budget={slice.budget}
              // Une sous-catégorie n'a pas d'icône à elle : elle se lit dans la
              // famille de sa parente, dont elle reprend l'icône. Sans ce repli
              // la colonne se remplirait de pastilles creuses (l'état « aucune
              // icône choisie » de `CategoryIcon`).
              iconName={parent ? parent.icon : slice.icon}
              label={slice.name}
              // Une sous-catégorie n'a pas de teinte propre : c'est un palier de
              // celle de sa parente, dérivé de son rang.
              color={
                parentColor
                  ? shadeCategoryColor(parentColor, index, level.slices.length)
                  : resolveColor(slice.color)
              }
              max={max}
            />
          </Toolbar.Button>
        ))}
      </Toolbar.Root>
    </div>
  );
}
