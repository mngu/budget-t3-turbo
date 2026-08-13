import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod/v4";

import { Button } from "@budget/ui/button";
import { Spinner } from "@budget/ui/spinner";
import { toast } from "@budget/ui/toast";

import { useTRPCClient } from "~/lib/trpc";

// Cible de la redirection Enable Banking (déclarée dans le Control Panel).
export const Route = createFileRoute("/_authed/callback")({
  validateSearch: z.object({
    code: z.string().optional().catch(undefined),
    state: z.string().optional().catch(undefined),
    error: z.string().optional().catch(undefined),
  }),
  component: CallbackPage,
});

function CallbackPage() {
  const { code, state, error } = Route.useSearch();
  const navigate = useNavigate();
  const trpcClient = useTRPCClient();
  const ran = useRef(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (error || !code || !state) {
      toast.error(
        error
          ? `Autorisation refusée par la banque (${error}).`
          : "Autorisation incomplète — aucun code reçu.",
      );
      void navigate({
        to: "/settings/banques/ajouter",
        search: { step: "banque" },
      });
      return;
    }

    trpcClient.connections.complete
      .mutate({ code, state })
      .then(({ connectionId, renewed }) => {
        if (renewed) {
          toast.success("Consentement renouvelé.");
          void navigate({ to: "/settings/banques" });
        } else {
          void navigate({
            to: "/settings/banques/ajouter",
            search: { step: "comptes", connexion: connectionId },
          });
        }
      })
      .catch((err) => {
        setFailure(err instanceof Error ? err.message : "Erreur inconnue.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-4 p-16 text-center">
      {failure ? (
        <>
          <p className="text-red-600">❌ La connexion à la banque a échoué.</p>
          <p className="text-muted-foreground text-body">{failure}</p>
          <Button render={<Link to="/settings/banques" />}>
            Retour aux banques
          </Button>
        </>
      ) : (
        <>
          <Spinner />
          <p>Finalisation de la connexion avec votre banque…</p>
        </>
      )}
    </main>
  );
}
