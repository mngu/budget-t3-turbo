"use client";

import { cn } from "@budget/ui";
import { Button } from "@budget/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@budget/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@budget/ui/field";
import { Input } from "@budget/ui/input";
import { Spinner } from "@budget/ui/spinner";

/**
 * Le dialogue **unique** de l'écran Espaces : dix gestes (créer, partager,
 * inviter, retirer, quitter, annuler, renommer, supprimer, basculer, refus de
 * supprimer le personnel) passent par cette coque, comme dans la maquette.
 *
 * Ce n'est pas une économie de composants : ces dialogues se ressemblent parce
 * qu'ils disent tous la même chose dans le même ordre — ce que le geste change,
 * ce qu'il ne change pas, et ce qui ne se défait pas. Une coque commune est ce
 * qui garantit qu'aucun n'oublie une de ces trois lignes.
 */
export interface SpaceDialogSpec {
  icon: React.ReactNode;
  tone: "primary" | "warn" | "bad";
  title: string;
  body: string;
  /** Choix exclusifs (création d'espace) — la seule variante à deux chemins. */
  choices?: {
    key: string;
    label: string;
    description: string;
    warning?: string;
  }[];
  choice?: string;
  onChoice?: (key: string) => void;
  /** Chiffres de l'impact, avant la phrase : c'est ce qui décide. */
  facts?: { value: string; label: string }[];
  input?: { label: string; placeholder?: string; value: string };
  onInput?: (value: string) => void;
  hint?: string;
  footnote?: string;
  cta: string;
  /** Absent = pas de bouton d'annulation (dialogue purement informatif). */
  cancel?: string;
  disabled?: boolean;
}

// La sévérité tient dans la pastille du dialogue ; le bouton, lui, prend une
// *variante* du composant plutôt qu'une teinte écrite ici. « warn » n'en a pas
// (l'action est irréversible sans être destructrice) et retombe sur la variante
// par défaut — voir `docs/adr/0001-le-design-appartient-au-package-ui.md`.
const TONE: Record<
  "primary" | "warn" | "bad",
  { chip: string; cta: "default" | "destructive" }
> = {
  primary: { chip: "bg-accent-soft text-primary", cta: "default" },
  warn: { chip: "bg-warn-soft text-warn", cta: "default" },
  bad: { chip: "bg-bad-soft text-bad", cta: "destructive" },
};

export function SpaceDialog({
  spec,
  busy,
  onConfirm,
  onClose,
}: {
  spec: SpaceDialogSpec | null;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!spec) return null;
  const tone = TONE[spec.tone];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        padded={false}
        className="border-border-strong max-w-130 overflow-hidden"
      >
        <div className="px-5 pt-4 pb-4">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex size-8 flex-none items-center justify-center rounded-md",
                tone.chip,
              )}
            >
              {spec.icon}
            </span>
            <DialogTitle className="min-w-0 text-heading text-pretty">
              {spec.title}
            </DialogTitle>
          </div>
          <div className="text-muted-foreground mt-2.5 text-control text-pretty">
            {spec.body}
          </div>

          {spec.choices && (
            <div className="mt-3.5 flex flex-col gap-2.5">
              {spec.choices.map((choice) => {
                const active = spec.choice === choice.key;
                return (
                  <button
                    key={choice.key}
                    type="button"
                    onClick={() => spec.onChoice?.(choice.key)}
                    className={cn(
                      "grid w-full grid-cols-[16px_minmax(0,1fr)] items-start gap-2.5 rounded-md border p-3 text-left",
                      active
                        ? "border-primary bg-accent-soft"
                        : "border-border",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 size-3.5 rounded-full border-[1.5px]",
                        active
                          ? "border-primary bg-primary ring-card ring-2 ring-inset"
                          : "border-border-strong",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block text-control font-semibold tracking-[-0.01em]">
                        {choice.label}
                      </span>
                      <span className="text-muted-foreground mt-1 block text-control text-pretty">
                        {choice.description}
                      </span>
                      {active && choice.warning && (
                        <span className="text-warn mt-1.5 block text-control text-pretty">
                          {choice.warning}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {spec.facts && spec.facts.length > 0 && (
            <div className="border-border mt-3.5 flex flex-col overflow-hidden rounded-md border">
              {spec.facts.map((fact) => (
                <div
                  key={fact.label}
                  className="border-border bg-surface-2 flex items-center gap-2.5 border-b px-3 py-2 last:border-b-0"
                >
                  <span
                    className={cn(
                      "num min-w-11 text-meta font-medium",
                      spec.tone === "bad" ? "text-bad" : "text-foreground",
                    )}
                  >
                    {fact.value}
                  </span>
                  <span className="text-muted-foreground min-w-0 text-control">
                    {fact.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {spec.input && (
            <Field className="mt-3.5">
              <FieldLabel htmlFor="space-name">{spec.input.label}</FieldLabel>
              <Input
                id="space-name"
                autoFocus
                value={spec.input.value}
                onChange={(e) => spec.onInput?.(e.target.value)}
                placeholder={spec.input.placeholder}
              />
              {spec.hint && <FieldDescription>{spec.hint}</FieldDescription>}
            </Field>
          )}
        </div>

        <DialogFooter>
          <span className="min-w-0 flex-1 text-pretty">{spec.footnote}</span>
          {spec.cancel && (
            <Button variant="ghost" className="flex-none" onClick={onClose}>
              {spec.cancel}
            </Button>
          )}
          <Button
            variant={tone.cta}
            className="flex-none"
            disabled={spec.disabled ?? busy}
            onClick={onConfirm}
          >
            {busy && <Spinner />}
            {spec.cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
