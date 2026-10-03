"use client";

import type { ConnectionSummary } from "@budget/api";

import { toast } from "@heroui/react";
import { useState } from "react";

import { useTRPCClient } from "~/lib/trpc";

export function useRenewConnection() {
  const trpcClient = useTRPCClient();
  const [busy, setBusy] = useState(false);

  const renew = async (connection: ConnectionSummary) => {
    setBusy(true);
    try {
      const { url } = await trpcClient.connections.start.mutate({
        name: connection.aspspName,
        country: connection.aspspCountry,
        connectionId: connection.id,
      });
      window.location.href = url;
    } catch (err) {
      toast.danger(
        err instanceof Error
          ? err.message
          : "Échec du lancement de l'autorisation.",
      );
      setBusy(false);
    }
  };

  return { renew, busy };
}
