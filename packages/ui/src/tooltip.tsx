"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@budget/ui";

/**
 * Crée un handle à passer à un `Tooltip` et à ses `TooltipTrigger`. C'est ce
 * qui permet à N déclencheurs de partager une seule bulle — le cas des
 * segments d'un graphique, où un `Tooltip` par segment multiplierait les
 * stores pour rien. Le contenu est alors une fonction de rendu qui reçoit le
 * `payload` du déclencheur actif.
 *
 * À appeler une fois par instance de composant (`useState(createTooltipHandle)`
 * et non au niveau du module) : un handle partagé entre deux graphiques ferait
 * s'ouvrir la bulle de l'un sur le survol de l'autre.
 */
export const createTooltipHandle = TooltipPrimitive.createHandle;

/** Délai partagé : une fois une bulle ouverte, les voisines suivent sans attente. */
function TooltipProvider({
  delay = 150,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider delay={delay} {...props} />;
}

function Tooltip<Payload>(props: TooltipPrimitive.Root.Props<Payload>) {
  return <TooltipPrimitive.Root {...props} />;
}

function TooltipTrigger<Payload>(
  props: TooltipPrimitive.Trigger.Props<Payload>,
) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  align = "center",
  side = "top",
  sideOffset = 6,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 origin-(--transform-origin) rounded-lg px-2.5 py-1.5 text-xs shadow-md ring-1 duration-100",
            className,
          )}
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
