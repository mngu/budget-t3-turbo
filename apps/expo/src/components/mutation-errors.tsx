import { useToast } from "heroui-native";
import { useEffect } from "react";

import { queryClient } from "~/lib/trpc";

// Every failed write says why, as the web's useRun: the server's message is
// written for the user (« Une catégorie nommée … existe déjà. »).
export function MutationErrors() {
  const { toast } = useToast();
  useEffect(
    () =>
      queryClient.getMutationCache().subscribe((event) => {
        if (event.type === "updated" && event.action.type === "error") {
          toast.show({ variant: "danger", label: event.action.error.message });
        }
      }),
    [toast],
  );
  return null;
}
