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
        "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-50 bg-black/50 duration-150",
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
          "bg-popover text-popover-foreground fixed z-50 flex flex-col shadow-lg duration-150",
          padded && "gap-4 p-6",
          variant === "drawer"
            ? "data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right inset-y-0 right-0 h-full w-full max-w-md border-l"
            : "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogClose className="ring-offset-background focus:ring-ring data-open:bg-accent absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden">
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
        "bg-sunken text-subtle flex flex-none items-center gap-2.5 border-t px-4 py-2.5 text-[11.5px]",
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
      className={cn("text-lg leading-none font-semibold", className)}
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
      className={cn("text-muted-foreground text-sm", className)}
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
