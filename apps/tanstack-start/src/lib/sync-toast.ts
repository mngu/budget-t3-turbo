import type { SyncOutcome } from "@budget/api";

import { useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { toast } from "@budget/ui/toast";
import { useTRPCClient } from "~/lib/trpc";

export function toastSyncOutcome(
  { expired, rateLimited }: SyncOutcome,
  successMessage = "Synchronisation terminée.",
): void {
  const issues: string[] = [];
  if (expired.length > 0) {
    issues.push(
      `${expired.length} banque(s) à renouveler : ${expired.join(", ")}`,
    );
  }
  if (rateLimited.length > 0) {
    issues.push(
      `limite d'accès bancaire atteinte pour ${rateLimited.join(", ")} — réessayez dans ~6 h`,
    );
  }
  if (issues.length > 0)
    toast.warning(`Synchronisation terminée — ${issues.join(" ; ")}.`);
  else toast.success(successMessage);
}

// Run only on user action: bank synchronization may trigger strong authentication.
export function useSync() {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [state, setState] = useState<"idle" | "running" | "failed">("idle");

  const sync = async () => {
    setState("running");
    try {
      const outcome = await trpcClient.sync.run.mutate();
      await router.invalidate();
      toastSyncOutcome(outcome);
      setState("idle");
      return true;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de la synchronisation.",
      );
      setState("failed");
      return false;
    }
  };

  return { sync, state };
}
