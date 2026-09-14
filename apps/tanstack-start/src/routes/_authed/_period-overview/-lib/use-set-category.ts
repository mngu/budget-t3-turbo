"use client";

import { useState } from "react";

import { useTRPCClient } from "~/lib/trpc";
import { useRun } from "~/lib/use-run";

/**
 * Écriture de la catégorie d'une transaction, partagée par les quatre écrans de
 * la revue (rail « À revoir », zoom catégorie, table).
 *
 * `updateCategory` passe `category_source` à `'manual'` : valider une catégorie
 * déjà proposée n'est donc pas un no-op — c'est ce qui la met à l'abri de la
 * prochaine passe de catégorisation LLM et la sort du rail de relecture.
 */
export function useSetCategory() {
  const trpcClient = useTRPCClient();
  const run = useRun();
  const [pending, setPending] = useState(false);

  // Sans le toast d'échec de `run`, l'erreur serait invisible : le loader
  // n'ayant pas été invalidé, l'écran retombe sur l'ancienne valeur sans rien dire.
  const setCategory = async (id: number, categoryId: number | null) => {
    setPending(true);
    await run(
      () => trpcClient.transactions.updateCategory.mutate({ id, categoryId }),
      "Échec de la mise à jour de la catégorie.",
    );
    setPending(false);
  };

  return { setCategory, pending };
}
