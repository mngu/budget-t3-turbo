"use client";

import { Loader2Icon } from "lucide-react";

import { cn } from "@budget/ui";
import { Dialog, DialogContent, DialogTitle } from "@budget/ui/dialog";

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

const TONE = {
  primary: { chip: "bg-accent-soft text-primary", cta: "bg-primary" },
  warn: { chip: "bg-warn-soft text-warn", cta: "bg-warn" },
  bad: { chip: "bg-bad-soft text-bad", cta: "bg-bad" },
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
      <DialogContent className="border-border-strong max-w-[520px] gap-0 overflow-hidden p-0">
        <div className="px-5 pt-4 pb-4">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex size-[30px] flex-none items-center justify-center rounded-[9px]",
                tone.chip,
              )}
            >
              {spec.icon}
            </span>
            <DialogTitle className="min-w-0 text-[15px] font-semibold tracking-[-0.02em] text-pretty">
              {spec.title}
            </DialogTitle>
          </div>
          <div className="text-muted-foreground mt-2.5 text-[12.5px] text-pretty">
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
                      "grid w-full grid-cols-[16px_minmax(0,1fr)] items-start gap-2.5 rounded-[11px] border p-3 text-left",
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
                      <span className="block text-[12.5px] font-semibold tracking-[-0.01em]">
                        {choice.label}
                      </span>
                      <span className="text-muted-foreground mt-[3px] block text-xs text-pretty">
                        {choice.description}
                      </span>
                      {active && choice.warning && (
                        <span className="text-warn mt-1.5 block text-[11.5px] text-pretty">
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
            <div className="border-border mt-3.5 flex flex-col overflow-hidden rounded-[11px] border">
              {spec.facts.map((fact) => (
                <div
                  key={fact.label}
                  className="border-border bg-surface-2 flex items-center gap-2.5 border-b px-3 py-2 last:border-b-0"
                >
                  <span
                    className={cn(
                      "num min-w-[44px] text-[12.5px] font-medium",
                      spec.tone === "bad" ? "text-bad" : "text-foreground",
                    )}
                  >
                    {fact.value}
                  </span>
                  <span className="text-muted-foreground min-w-0 text-xs">
                    {fact.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {spec.input && (
            <div className="mt-3.5 flex flex-col">
              <div className="label-caps mb-1.5">{spec.input.label}</div>
              <input
                autoFocus
                value={spec.input.value}
                onChange={(e) => spec.onInput?.(e.target.value)}
                placeholder={spec.input.placeholder}
                className="border-border-strong bg-background focus:border-primary h-[33px] w-full rounded-[9px] border px-3 text-[12.5px] outline-none"
              />
              {spec.hint && (
                <div className="text-subtle mt-1.5 text-[11.5px] text-pretty">
                  {spec.hint}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-border bg-surface-2 flex items-center gap-2.5 border-t px-5 py-3">
          <span className="text-subtle min-w-0 flex-1 text-[11.5px] text-pretty">
            {spec.footnote}
          </span>
          {spec.cancel && (
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-8 flex-none items-center justify-center rounded-[9px] px-3 text-xs font-medium"
            >
              {spec.cancel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={spec.disabled ?? busy}
            className={cn(
              "text-primary-foreground flex h-8 flex-none items-center justify-center gap-2 rounded-[9px] px-4 text-[12.5px] font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-45",
              tone.cta,
            )}
          >
            {busy && <Loader2Icon className="size-3.5 animate-spin" />}
            {spec.cta}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
