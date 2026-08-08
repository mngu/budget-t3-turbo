"use client";

import { SparklesIcon, XIcon } from "lucide-react";

import { Button } from "@budget/ui/button";

const dateTimeFr = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

// Ce que fait l'analyse, dans l'ordre. Décrit l'opération — ce n'est PAS un
// suivi d'avancement : `generateSuggestions` est un unique await côté serveur,
// qui ne rapporte aucune étape. La maquette affiche une barre chiffrée et un
// « ≈ 38 s restantes » que rien en base ne peut alimenter ; les remettre
// reviendrait à inventer une mesure, comme le score de confiance écarté de la
// file « À revoir » (voir CLAUDE.md).
const STEPS = [
  "Lecture des transactions sans catégorie",
  "Regroupement des libellés proches",
  "Rattachement de chaque groupe à une de vos catégories",
  "Propositions posées dans votre liste",
];

export function SuggestionsWaitPanel({ onClose }: { onClose: () => void }) {
  return (
    <PanelShell title="Recherche des catégories manquantes" onClose={onClose}>
      <div className="px-4 pt-5 pb-5">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="text-[13px] font-semibold">Analyse en cours</span>
          <span className="num text-muted-foreground text-xs">
            environ une minute
          </span>
        </div>

        {/* Barre indéterminée : elle dit « ça travaille », jamais « on en est
            à x % ». */}
        <div className="bg-track my-3.5 h-[5px] overflow-hidden rounded-full">
          <div className="bg-primary h-full w-1/3 animate-[pulse_1.6s_ease-in-out_infinite] rounded-full" />
        </div>

        <ul className="flex max-w-[760px] flex-col gap-2.5">
          {STEPS.map((step) => (
            <li
              key={step}
              className="text-muted-foreground grid grid-cols-[16px_minmax(0,1fr)] items-center gap-2.5 text-xs"
            >
              <span className="border-border-strong size-3.5 rounded-full border-[1.5px]" />
              <span>{step}</span>
            </li>
          ))}
        </ul>

        <p className="text-subtle mt-4 max-w-[760px] border-t pt-3.5 text-[11.5px] text-pretty">
          Rien n'est écrit en base pendant l'analyse : elle ne fait que
          proposer. Les propositions vous attendront dans la liste, sous la
          catégorie concernée.
        </p>
      </div>
    </PanelShell>
  );
}

export function SuggestionsReviewPanel({
  generatedAt,
  branchCount,
  touchedExistingParents,
  newParentCount,
  onClose,
}: {
  generatedAt: Date;
  branchCount: number;
  touchedExistingParents: number;
  newParentCount: number;
  onClose: () => void;
}) {
  return (
    <PanelShell
      title="Catégories manquantes"
      tagline={`analyse du ${dateTimeFr.format(generatedAt)}`}
      onClose={onClose}
    >
      <div className="flex flex-wrap items-center gap-3.5 px-4 py-3.5">
        <p className="text-muted-foreground max-w-[560px] text-xs text-pretty">
          {branchCount === 0 ? (
            <>
              Aucune branche à ajouter : tout ce que l'analyse propose existe
              déjà dans votre liste.
            </>
          ) : (
            <>
              <span className="text-foreground font-medium">
                {branchCount} sous-catégorie{branchCount > 1 ? "s" : ""}{" "}
                proposée
                {branchCount > 1 ? "s" : ""}
              </span>{" "}
              {touchedExistingParents > 0 && (
                <>
                  sous {touchedExistingParents} de vos catégories
                  {newParentCount > 0 && ", "}
                </>
              )}
              {newParentCount > 0 && (
                <>
                  et{" "}
                  <span className="text-foreground font-medium">
                    {newParentCount} nouvelle{newParentCount > 1 ? "s" : ""}{" "}
                    catégorie{newParentCount > 1 ? "s" : ""}
                  </span>
                </>
              )}
              . Elles sont posées dans votre liste, sous la catégorie concernée
              — chaque « Ajouter » ne range que les transactions montrées.
            </>
          )}
        </p>
        <Button size="sm" className="ml-auto" onClick={onClose}>
          Voir dans ma liste ↓
        </Button>
      </div>
    </PanelShell>
  );
}

function PanelShell({
  title,
  tagline,
  onClose,
  children,
}: {
  title: string;
  tagline?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border-strong bg-card mt-4 overflow-hidden rounded-[14px] border shadow-lg">
      <div className="bg-sunken flex flex-wrap items-center gap-2.5 border-b px-3.5 py-2.5">
        <SparklesIcon className="text-primary size-3.5" />
        <h2 className="text-[12.5px] font-semibold">{title}</h2>
        {tagline && (
          <span className="text-subtle text-[11.5px]">{tagline}</span>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Fermer"
          className="ml-auto"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>
      {children}
    </section>
  );
}
