"use client";

import { useState } from "react";

import type { ConnectionSummary } from "@budget/api";
import { toast } from "@budget/ui/toast";

import { useTRPCClient } from "~/lib/trpc";

/**
 * Relance l'autorisation d'une connexion existante (`connectionId` renseigné :
 * `completeAuth` met à jour la session au lieu d'en créer une seconde). La
 * bannière d'alerte et le bouton de chaque carte font le même geste.
 *
 * Redirection pleine page : le SCA se passe dans l'app bancaire, la banque nous
 * ramène ensuite sur /callback.
 */
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
      toast.error(
        err instanceof Error
          ? err.message
          : "Échec du lancement de l'autorisation.",
      );
      setBusy(false);
    }
  };

  return { renew, busy };
}
