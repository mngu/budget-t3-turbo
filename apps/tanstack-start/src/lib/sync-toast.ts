import type { SyncOutcome } from "@budget/api";
import { toast } from "@budget/ui/toast";

// Toast de fin de synchronisation, commun au bouton Sync et au wizard.
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
