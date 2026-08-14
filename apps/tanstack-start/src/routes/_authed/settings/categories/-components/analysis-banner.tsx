"use client";

import { CircleCheckIcon, SparklesIcon } from "lucide-react";

import { Button } from "@budget/ui/button";
import { Spinner } from "@budget/ui/spinner";

/**
 * Le bandeau de tête de l'écran, dans ses deux états : il reste des
 * transactions qu'aucune catégorie ne décrit, ou tout est rangé.
 *
 * C'est ici que vivent les deux traitements « avancés », et ils ne se
 * confondent pas : **catégoriser** classe avec l'arbre existant, **analyser**
 * propose ce qui manque. Le premier est l'étape la moins chère et c'est elle
 * qui dit si l'arbre suffit ; le second n'écrit rien tant qu'on n'a pas
 * répondu.
 *
 * L'appelant ne le monte que si aucun panneau d'analyse n'est à l'écran.
 */
export function AnalysisBanner({
  uncategorizedCount,
  categorizing,
  onCategorize,
  onAnalyze,
  onPreviewUncategorized,
}: {
  uncategorizedCount: number;
  categorizing: boolean;
  onCategorize: () => void;
  onAnalyze: () => void;
  onPreviewUncategorized: () => void;
}) {
  if (uncategorizedCount === 0) {
    return (
      <section className="bg-card mt-5 flex flex-wrap items-center gap-3.5 rounded-xl border px-4 py-3.5">
        <CircleCheckIcon className="text-ok size-4 flex-none" />
        <div className="min-w-65 flex-1">
          <h2 className="text-control font-medium">
            Toutes vos transactions sont catégorisées
          </h2>
          <p className="text-subtle text-control mt-0.5">
            Une analyse peut quand même proposer des branches plus fines que
            celles que vous avez.
          </p>
        </div>
        <Button variant="outline" onClick={onAnalyze}>
          Chercher des catégories
        </Button>
      </section>
    );
  }

  return (
    <section className="border-primary bg-accent-soft mt-5 flex flex-wrap items-center gap-4 rounded-xl border p-4">
      <span className="bg-card border-primary text-primary flex size-9 flex-none items-center justify-center rounded-md border">
        <SparklesIcon className="size-4" />
      </span>
      <div className="flex-1">
        <h2 className="text-subheading">Catégories manquantes</h2>
        <p className="text-muted-foreground text-control mt-1 text-pretty">
          <span className="text-foreground font-medium">
            {uncategorizedCount} transaction
            {uncategorizedCount > 1 ? "s" : ""}
          </span>{" "}
          qu'aucune de vos catégories ne décrit. Une analyse d'environ une
          minute propose ce qui manque, et n'écrit rien tant que vous n'avez pas
          répondu.
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <Button variant="outline" onClick={onPreviewUncategorized}>
          Voir les {uncategorizedCount}
        </Button>
        {/* Absent de la maquette, qui ne connaît que l'analyse : classer avec
            les catégories existantes reste l'étape la moins chère, et c'est
            elle qui dit si l'arbre suffit. */}
        <Button
          variant="outline"
          onClick={onCategorize}
          disabled={categorizing}
        >
          {categorizing && <Spinner />}
          Catégoriser
        </Button>
        <Button onClick={onAnalyze}>Lancer l&apos;analyse</Button>
      </div>
    </section>
  );
}
