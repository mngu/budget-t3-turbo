"use client";

import { RefreshCwIcon } from "lucide-react";

import { cn } from "@budget/ui";
import { Button } from "@budget/ui/button";
import { dateFr } from "~/lib/format";
import { useSync } from "~/lib/sync-toast";

// Last import is not last sync: successful syncs without new transactions leave
// imported_at unchanged, and no sync timestamp is persisted.
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
