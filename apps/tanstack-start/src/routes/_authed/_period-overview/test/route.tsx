import type { NewCategoryOverviewElementType } from "@budget/api/schemas";

import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { useState } from "react";

import { CanvasContainer } from "@budget/ui/canvas-container";
import { Segment } from "@budget/ui/segment";
import { SegmentDetail } from "@budget/ui/segment-detail";
import { SegmentLabel } from "@budget/ui/segment-label";
import { CategoryIcon } from "~/component/category-icon";
import { useCategoryColor } from "~/lib/category-color";
import { euro0, sharePercent } from "~/lib/format";
import { sumBy } from "~/lib/sum";

export const Route = createFileRoute("/_authed/_period-overview/test")({
  component: RouteComponent,
});

type NewOverviewArc = NewCategoryOverviewElementType & {
  rotationZ: number;
  arc: number;
};

function RouteComponent() {
  const { newOverview } = useLoaderData({
    from: "/_authed/_period-overview",
  });
  const resolveColor = useCategoryColor();
  const [currentHover, setCurrentHover] = useState<string | null>(null);
  const total = sumBy(newOverview, ({ totalAmount }) => totalAmount ?? 0);

  // Les arcs se placent bout à bout, donc chacun a besoin du cumul de ceux qui
  // le précèdent. L'accumulateur reste dans cette boucle plutôt que dans un
  // `map` : réassigner depuis un callback fait échouer `react/immutability`,
  // le compilateur ne pouvant pas prouver qu'il ne survit pas au rendu.
  const overviewArcs: NewOverviewArc[] = [];
  let rotation = 0;
  for (const { totalAmount, ...restOverview } of newOverview) {
    if (!totalAmount) continue;
    const arc = (totalAmount / total) * 2 * Math.PI;
    overviewArcs.push({
      arc,
      rotationZ: rotation,
      totalAmount,
      ...restOverview,
    });
    rotation += arc;
  }

  return (
    <CanvasContainer>
      {overviewArcs.map((overviewArc) => {
        const { id, arc, rotationZ, color, icon, name, totalAmount } =
          overviewArc;
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
              setCurrentHover(name);
            }}
            onPointerOut={() => {
              setCurrentHover(null);
            }}
          >
            {name && shouldDisplayName && (
              <SegmentLabel angle={arc / 2} color={resolvedColor} text={name}>
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
                    {name}
                  </div>
                </div>
              </SegmentLabel>
            )}
            {Boolean(currentHover) && name === currentHover && (
              <SegmentDetail>
                <div className="flex flex-col items-center justify-center gap-2">
                  <CategoryIcon
                    name={icon}
                    color={resolvedColor}
                    className="size-5"
                  />
                  <div className="text-control mb-1 max-w-full truncate font-semibold tracking-[-0.015em]">
                    {name}
                  </div>
                  <div className="num text-title leading-none font-medium tracking-[-0.03em]">
                    {euro0.format(totalAmount ?? 0)}
                  </div>
                  <div className="label-caps mt-1 whitespace-nowrap">
                    {sharePercent(totalAmount ?? 0, total)} du total
                  </div>
                </div>
              </SegmentDetail>
            )}
          </Segment>
        );
      })}
    </CanvasContainer>
  );
}
