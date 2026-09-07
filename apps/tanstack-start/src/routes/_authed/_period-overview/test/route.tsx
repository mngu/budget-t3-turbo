import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import { CanvasContainer } from "@budget/ui/canvas-container";
import { Point } from "@budget/ui/point";
import { Segment } from "@budget/ui/segment";
import { CategoryIcon } from "~/component/category-icon";
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

  let currentRotation = 0;

  return (
    <CanvasContainer>
      {newOverview.map(({ id, totalAmount, color, name, icon }) => {
        if (!totalAmount) return null;
        const arcSize = ((totalAmount ?? 0) / total) * 2 * Math.PI;
        const rotationZ = currentRotation;
        currentRotation += arcSize;
        // Milieu de l'arc, déporté hors de l'anneau (rayon du tore : 5).
        const mid = arcSize / 2;
        const shouldDisplayName = arcSize > Math.PI / 32;

        return (
          <Segment
            key={id}
            position={[0, 0, 0]}
            rotationZ={rotationZ}
            arc={arcSize}
            color={resolveColor(color)}
          >
            {shouldDisplayName && (
              <Point coordinates={[7 * Math.cos(mid), 7 * Math.sin(mid), 0]}>
                <div
                  className="flex items-center gap-1 rounded p-2"
                  style={{ color }}
                >
                  <CategoryIcon name={icon} color={color} /> {name}
                </div>
              </Point>
            )}
          </Segment>
        );
      })}
    </CanvasContainer>
  );
}
