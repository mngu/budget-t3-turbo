"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";

import { toast } from "@budget/ui/toast";

import { useTRPCClient } from "./trpc";

/**
 * Écriture de la catégorie d'une transaction, partagée par les quatre écrans de
 * la revue (rail « À revoir », zoom catégorie, table).
 *
 * `updateCategory` passe `category_source` à `'manual'` : valider une catégorie
 * déjà proposée n'est donc pas un no-op — c'est ce qui la met à l'abri de la
 * prochaine passe de catégorisation LLM et la sort du rail de relecture.
 */
export function useSetCategory() {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [pending, setPending] = useState(false);

  const setCategory = async (id: number, category: string) => {
    setPending(true);
    try {
      await trpcClient.transactions.updateCategory.mutate({ id, category });
      await router.invalidate();
    } catch (err) {
      // Sans ce toast l'échec est invisible : le loader n'ayant pas été
      // invalidé, l'écran retombe sur l'ancienne valeur sans rien dire.
      toast.error(
        err instanceof Error
          ? err.message
          : "Échec de la mise à jour de la catégorie.",
      );
    } finally {
      setPending(false);
    }
  };

  return { setCategory, pending };
}
