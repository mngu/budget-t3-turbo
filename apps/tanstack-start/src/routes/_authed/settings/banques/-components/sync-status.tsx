"use client";

import { RefreshCwIcon } from "lucide-react";

import { cn } from "@budget/ui";
import { Button } from "@budget/ui/button";
import { dateFr } from "~/lib/format";
import { useSync } from "~/lib/sync-toast";

/**
 * Écart assumé avec la maquette, qui affiche « Synchronisé à 07:12 · aujourd'hui ».
 * Rien en base n'enregistre *qu'une synchronisation a eu lieu* : ni
 * `bank_connections` (validUntil / createdAt / status) ni `app_settings` n'ont de
 * `last_sync_at`, et `max(imported_at)` ne bouge que si la synchro a ramené
 * quelque chose — une synchro réussie sans nouveauté (cas courant) laisserait
 * l'écran affirmer « il y a 3 jours » alors que tout fonctionne.
 *
 * Le bloc ne montre donc que des faits vérifiables : l'état transitoire du
 * bouton lui-même, le total importé, et la date du dernier import (nommée comme
 * telle). Ne pas y réintroduire d'heure de synchronisation sans l'avoir d'abord
 * persistée — même règle que le score de confiance de la file « À revoir ».
 */
export function SyncStatus({
  totalTransactions,
  lastImportedAt,
}: {
  totalTransactions: number;
  lastImportedAt: string | null;
}) {
  const { sync, state } = useSync();

  const { value, meta, tone } = describe(
    state,
    totalTransactions,
    lastImportedAt,
  );

  return (
    <div className="flex items-center gap-4">
      <div className="border-border border-r pr-4 text-right">
        <div className={cn("num text-body font-medium", tone)}>{value}</div>
        <div className="label-caps mt-0.5">{meta}</div>
      </div>

      <Button variant="outline" disabled={state === "running"} onClick={sync}>
        <RefreshCwIcon className={cn(state === "running" && "animate-spin")} />
        Synchroniser
      </Button>
    </div>
  );
}

function describe(
  state: "idle" | "running" | "failed",
  totalTransactions: number,
  lastImportedAt: string | null,
) {
  if (state === "running") {
    return {
      value: "Synchronisation…",
      meta: "appels bancaires en cours",
      tone: "text-primary",
    };
  }
  if (state === "failed") {
    return {
      value: "Échec",
      meta: "dernière tentative — voir le message d'erreur",
      tone: "text-bad",
    };
  }
  return {
    value: `${totalTransactions} transaction${totalTransactions > 1 ? "s" : ""}`,
    meta: lastImportedAt
      ? `dernier import le ${dateFr.format(new Date(lastImportedAt))}`
      : "aucun import pour l'instant",
    tone: "text-muted-foreground",
  };
}
