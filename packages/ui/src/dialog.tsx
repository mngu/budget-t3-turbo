"use client";

import type * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

import { cn } from "@budget/ui";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogBackdrop({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-backdrop"
      className={cn(
        "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 bg-overlay fixed inset-0 z-50 duration-150",
        className,
      )}
      {...props}
    />
  );
}

// variant "modal" : boîte centrée classique (confirmations, formulaires courts).
// variant "drawer" : panneau latéral, adapté à la prévisualisation de listes
// longues (transactions) sans quitter le contexte de la page.
function DialogContent({
  className,
  children,
  variant = "modal",
  padded = true,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  variant?: "modal" | "drawer";
  /**
   * `false` retire la marge intérieure et l'écart entre blocs : le dialogue
   * compose alors ses propres bandes (en-tête bordé, corps déroulant,
   * `DialogFooter`) qui doivent toucher les bords. C'est le cas de tous les
   * dialogues un peu longs de l'app, qui répétaient `gap-0 p-0`.
   */
  padded?: boolean;
  /**
   * La croix de fermeture. `CommandDialog` la masque : son champ de recherche
   * occupe le coin, et Échap ferme déjà la palette.
   */
  showCloseButton?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogBackdrop />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-variant={variant}
        className={cn(
          "bg-popover text-popover-foreground fixed z-50 flex flex-col shadow-modal duration-150",
          padded && "gap-4 p-6",
          variant === "drawer"
            ? "data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right inset-y-0 right-0 h-full w-full max-w-md border-l"
            : // §4.9 : rayon 16, contour marqué, **aligné en haut à 92 px**
              // (`top-23`) et non centré, pour que la liste derrière reste
              // lisible. Le plafond de hauteur va avec l'alignement et non aux
              // appelants : un dialogue centré partageait son dépassement en
              // deux, celui-ci le renvoie *entier* sous le pli — sans barre de
              // défilement, le bas devenait inatteignable en silence. 116 px =
              // les 92 du haut plus une marge de page de 24 en bas.
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 border-border-strong top-23 left-1/2 max-h-[calc(100dvh-116px)] w-full max-w-md -translate-x-1/2 overflow-y-auto rounded-xl border",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogClose className="ring-offset-background focus:ring-ring data-open:bg-accent absolute top-4 right-4 rounded-md opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden">
            <XIcon className="size-4" />
            <span className="sr-only">Fermer</span>
          </DialogClose>
        )}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

/**
 * Bande de pied d'un dialogue `padded={false}` : elle touche les bords, se
 * détache par un filet et une surface en creux, et porte une mention et/ou des
 * actions. Neutre en alignement — une mention seule se lit à gauche, une paire
 * de boutons se cale à droite avec `justify-end`.
 */
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "bg-sunken text-subtle flex flex-none items-center gap-2.5 text-meta border-t px-4 py-2.5",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-subheading leading-none", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-control", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
