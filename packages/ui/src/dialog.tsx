"use client";

import { Drawer, Modal } from "@heroui/react";
import * as React from "react";

import { cn } from "@budget/ui";

interface DialogState {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}

const DialogStateContext = React.createContext<DialogState>({ open: false });
// Header, title and footer exist on both; each must come from the family its content was rendered with.
const PartsContext = React.createContext<{
  Parts: typeof Modal | typeof Drawer;
  padded: boolean;
}>({ Parts: Modal, padded: true });

function Dialog({
  open = false,
  onOpenChange,
  children,
}: Partial<DialogState> & { children: React.ReactNode }) {
  return (
    <DialogStateContext value={{ open, onOpenChange }}>
      {children}
    </DialogStateContext>
  );
}

function DialogContent({
  className,
  children,
  variant = "modal",
  padded = true,
  showCloseButton = true,
}: {
  className?: string;
  children: React.ReactNode;
  variant?: "modal" | "drawer";
  /** Disable for edge-to-edge header, body and footer sections. */
  padded?: boolean;
  showCloseButton?: boolean;
}) {
  const { open, onOpenChange } = React.use(DialogStateContext);
  const Parts = variant === "drawer" ? Drawer : Modal;
  const dialogClassName = cn(!padded && "gap-0 p-0", className);
  const content = (
    <PartsContext value={{ Parts, padded }}>
      {showCloseButton && <Parts.CloseTrigger aria-label="Fermer" />}
      {children}
    </PartsContext>
  );

  if (variant === "drawer")
    return (
      <Drawer isOpen={open} onOpenChange={onOpenChange}>
        <Drawer.Backdrop>
          <Drawer.Content placement="right">
            <Drawer.Dialog className={dialogClassName}>{content}</Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    );

  return (
    <Modal isOpen={open} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className={dialogClassName}>{content}</Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function DialogHeader(props: React.ComponentProps<"div">) {
  const { Parts } = React.use(PartsContext);
  return <Parts.Header {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  const { Parts, padded } = React.use(PartsContext);
  // Unpadded dialogs pad their own sections; the footer is the one screens never pad.
  return (
    <Parts.Footer
      className={cn(
        !padded && "text-subtle text-meta border-t px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle(props: React.ComponentProps<"h2">) {
  const { Parts } = React.use(PartsContext);
  return <Parts.Heading {...props} />;
}

function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-muted text-sm", className)} {...props} />;
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
};
