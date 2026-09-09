import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import { CanvasContainer } from "@budget/ui/canvas-container";
import { Segment } from "@budget/ui/segment";
import { SegmentLabel } from "@budget/ui/segment-label";
import { useCategoryColor } from "~/lib/category-color";
import { sumBy } from "~/lib/sum";

export const Route = createFileRoute("/_authed/_period-overview/test")({
  component: RouteComponent,
});

function RouteComponent() {
  const { newOverview } = useLoaderData({
    from: "/_authed/_period-overview",
  });
  const resolveColor = useCategoryColor();
  const total = sumBy(newOverview, ({ totalAmount }) => totalAmount ?? 0);

  // Les arcs se placent bout à bout, donc chacun a besoin du cumul de ceux qui
  // le précèdent. L'accumulateur reste dans cette boucle plutôt que dans un
  // `map` : réassigner depuis un callback fait échouer `react/immutability`,
  // le compilateur ne pouvant pas prouver qu'il ne survit pas au rendu.
  const arcs = [];
  let rotation = 0;
  for (const { id, totalAmount, color, name } of newOverview) {
    if (!totalAmount) continue;
    const arc = (totalAmount / total) * 2 * Math.PI;
    arcs.push({ id, name, color, arc, rotationZ: rotation });
    rotation += arc;
  }

  return (
    <CanvasContainer>
      {arcs.map(({ id, arc, rotationZ, color, name }) => {
        // La teinte résolue vaut pour l'arc *et* pour son intitulé : la valeur
        // brute est le pas clair, faux sur surface sombre.
        const resolved = resolveColor(color);
        const shouldDisplayName = arc > Math.PI / 32;

        return (
          <Segment key={id} rotationZ={rotationZ} arc={arc} color={resolved}>
            {name && shouldDisplayName && (
              <SegmentLabel angle={arc / 2} color={resolved} text={name} />
            )}
          </Segment>
        );
      })}
    </CanvasContainer>
  );
}
