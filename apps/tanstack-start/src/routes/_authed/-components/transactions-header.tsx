import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { LandmarkIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";

import { Button } from "@budget/ui/button";
import { ThemeToggle } from "@budget/ui/theme";
import { toast } from "@budget/ui/toast";

import { toastSyncOutcome } from "~/lib/sync-toast";
import { useTRPCClient } from "~/lib/trpc";
import { CalendarFilter } from "./calendar-filter";

export function TransactionsHeader() {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">💰 Transactions</h1>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Catégories"
          render={<Link to="/categories" />}
        >
          <SparklesIcon />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Banques"
          render={<Link to="/banques" />}
        >
          <LandmarkIcon />
        </Button>
        <SyncButton />
        <ThemeToggle />
        <CalendarFilter />
      </div>
    </div>
  );
}

// sync.run touche aux sessions bancaires réelles et déclenche une SCA : ce
// bouton est le seul déclencheur, jamais un effet de bord d'autre chose.
function SyncButton() {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [syncing, setSyncing] = useState(false);

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Synchroniser"
      disabled={syncing}
      onClick={async () => {
        setSyncing(true);
        try {
          const outcome = await trpcClient.sync.run.mutate();
          await router.invalidate();
          toastSyncOutcome(outcome);
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Échec de la synchronisation.",
          );
        } finally {
          setSyncing(false);
        }
      }}
    >
      <RefreshCwIcon className={syncing ? "animate-spin" : ""} />
    </Button>
  );
}
