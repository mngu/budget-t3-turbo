import type { CategoryOverviewElementType } from "@budget/api/schemas";

import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { NO_CATEGORY_NAME } from "@budget/api/schemas";
import { CanvasContainer } from "@budget/ui/canvas-container";
import { Segment, SegmentDetail } from "@budget/ui/segment";
import { SegmentLabel } from "@budget/ui/segment-label";
import { CategoryIcon } from "~/component/category-icon";
import { useCategoryColor, useShadeCategoryColor } from "~/lib/category-color";
import { sharePercent } from "~/lib/format";
import { sumBy } from "~/lib/sum";
import { useFormat } from "~/lib/use-format";
import { useRevueSearch } from "~/lib/use-revue-search";

import { getCategoryLabel } from "./-lib/breakdown";

export const Route = createFileRoute("/_authed/_period-overview/")({
  component: RouteComponent,
});

type OverviewArc = Pick<
  CategoryOverviewElementType,
  "name" | "color" | "icon" | "totalAmount" | "id"
> & {
  rotationZ: number;
  arc: number;
};

function RouteComponent() {
  const { euro } = useFormat();
  const { overview } = useLoaderData({
    from: "/_authed/_period-overview",
  });
  const resolveColor = useCategoryColor();
  const shadeCategoryColor = useShadeCategoryColor();
  const { search, setSearch } = useRevueSearch();

  const selectedCategory = search.category;
  const selectedOverview =
    selectedCategory && overview.find(({ name }) => name === selectedCategory);

  const back = () => {
    setSearch({ category: undefined });
  };

  useHotkeys("esc", back);

  const total = selectedOverview
    ? (selectedOverview.totalAmount ?? 0)
    : sumBy(overview, ({ totalAmount }) => totalAmount ?? 0);
  const elements = selectedOverview
    ? (selectedOverview.children?.map((childElement, index) => ({
        ...childElement,
        color: shadeCategoryColor(
          resolveColor(selectedOverview.color),
          index,
          selectedOverview.children?.length ?? 0,
        ),
        icon: selectedOverview.icon,
      })) ?? [])
    : overview;

  // Les arcs se placent bout à bout, donc chacun a besoin du cumul de ceux qui
  // le précèdent. L'accumulateur reste dans cette boucle plutôt que dans un
  // `map` : réassigner depuis un callback fait échouer `react/immutability`,
  // le compilateur ne pouvant pas prouver qu'il ne survit pas au rendu.
  const overviewArcs: OverviewArc[] = [];
  let rotation = 0;
  for (const { id, totalAmount, name, color, icon } of elements) {
    if (!totalAmount) continue;
    const arc = (totalAmount / total) * 2 * Math.PI;
    overviewArcs.push({
      id,
      arc,
      rotationZ: rotation,
      totalAmount,
      name,
      color,
      icon,
    });
    rotation += arc;
  }
  const [currentHover, setCurrentHover] = useState<string | null>(
    overviewArcs[0]?.name ?? null,
  );

  return (
    <CanvasContainer>
      {overviewArcs.map((overviewArc) => {
        const { id, arc, rotationZ, color, icon, name, totalAmount } =
          overviewArc;
        const labelName = getCategoryLabel(name);
        // La teinte résolue vaut pour l'arc *et* pour son intitulé : la valeur
        // brute est le pas clair, faux sur surface sombre.
        const resolvedColor = resolveColor(color);
        const shouldDisplayName = arc > Math.PI / 32;

        return (
          <Segment
            key={id}
            rotationZ={rotationZ}
            arc={arc}
            color={resolvedColor}
            onPointerOver={() => {
              setCurrentHover(labelName);
            }}
            onClick={() =>
              name && name !== NO_CATEGORY_NAME && setSearch({ category: name })
            }
          >
            {shouldDisplayName && (
              <SegmentLabel
                angle={arc / 2}
                rotation={rotationZ}
                color={resolvedColor}
              >
                <div className="flex items-center gap-2">
                  <CategoryIcon
                    name={icon}
                    color={resolvedColor}
                    className="size-5"
                  />
                  <div
                    style={{ color: resolvedColor }}
                    className="whitespace-nowrap"
                  >
                    {labelName}
                  </div>
                </div>
              </SegmentLabel>
            )}
            {labelName === currentHover && (
              <SegmentDetail>
                <div className="flex flex-col items-center justify-center gap-2">
                  <CategoryIcon
                    name={icon}
                    color={resolvedColor}
                    className="size-5"
                  />
                  <div
                    style={{ color: resolvedColor }}
                    className="text-control mb-1 max-w-full truncate font-semibold tracking-[-0.015em]"
                  >
                    {labelName}
                  </div>
                  <div className="num text-title leading-none font-medium tracking-[-0.03em]">
                    {euro.format(totalAmount ?? 0)}
                  </div>
                  <div className="label-caps mt-1 whitespace-nowrap">
                    {sharePercent(totalAmount ?? 0, total)} du total
                  </div>
                  {selectedCategory && <RingBackButton onClick={back} />}
                </div>
              </SegmentDetail>
            )}
          </Segment>
        );
      })}
    </CanvasContainer>
  );
}

function RingBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      title="Revenir à toutes les catégories"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="border-border-strong bg-card text-muted-foreground hover:border-subtle hover:text-foreground text-control pointer-events-auto mt-3 flex h-6 items-center gap-1.5 rounded-full border pr-2.5 pl-2 font-semibold whitespace-nowrap"
    >
      <ArrowLeftIcon className="size-3" aria-hidden />
      Toutes catégories
      {/* La touche est *aussi* une voie de sortie, mais elle ne s'annonçait
          nulle part : la maquette la fait dire par le bouton plutôt que
          d'ajouter une mention à part. */}
      <kbd className="border-border bg-surface-2 num text-subtle text-label ml-0.5 flex h-4 items-center rounded-sm border px-1 font-medium tracking-[0.02em]">
        Esc
      </kbd>
    </button>
  );
}
