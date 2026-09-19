"use client";

import { useState } from "react";

import { useTRPCClient } from "~/lib/trpc";
import { useRun } from "~/lib/use-run";

export function useSetCategory() {
  const trpcClient = useTRPCClient();
  const run = useRun();
  const [pending, setPending] = useState(false);

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
