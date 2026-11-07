import { useIsMutating, useMutation } from "@tanstack/react-query";
import { useToast } from "heroui-native";

import { queryClient, trpc } from "./trpc";

const SYNC_TOAST = "sync";

// Run only on user action: bank synchronization may trigger strong authentication.
export function useSync() {
  const { toast } = useToast();
  const { mutate } = useMutation({
    ...trpc.sync.run.mutationOptions(),
    onSuccess: async ({ expired, rateLimited }) => {
      await queryClient.invalidateQueries();
      toast.hide(SYNC_TOAST);
      const issues = [
        expired.length > 0 &&
          `${expired.length} banque(s) à renouveler : ${expired.join(", ")}`,
        rateLimited.length > 0 &&
          `limite d'accès bancaire atteinte pour ${rateLimited.join(", ")}, réessayez dans ~6 h`,
      ].filter(Boolean);
      toast.show(
        issues.length > 0
          ? {
              variant: "warning",
              label: "Synchronisation terminée",
              description: `${issues.join(" ; ")}.`,
            }
          : { variant: "success", label: "Synchronisation terminée." },
      );
    },
    onError: (error) => {
      toast.hide(SYNC_TOAST);
      toast.show({ variant: "danger", label: error.message });
    },
  });
  // Every header has its own picker: the running state must be shared, or a
  // second tab would start another strong authentication.
  const running =
    useIsMutating({ mutationKey: trpc.sync.run.mutationKey() }) > 0;
  const sync = () => {
    toast.show({
      id: SYNC_TOAST,
      label: "Synchronisation des comptes en cours…",
      duration: "persistent",
    });
    mutate();
  };
  return { sync, running };
}
