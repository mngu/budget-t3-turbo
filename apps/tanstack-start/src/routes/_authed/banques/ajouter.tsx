import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import { z } from "zod/v4";

import type { AccountSummary, AspspOption } from "@budget/api";
import { Button } from "@budget/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/ui/card";
import { Input } from "@budget/ui/input";
import { toast } from "@budget/ui/toast";

import { SearchInput } from "~/component/search-input";
import { toastSyncOutcome } from "~/lib/sync-toast";
import { useTRPCClient } from "~/lib/trpc";

const wizardSearchSchema = z.object({
  step: z.enum(["banque", "comptes"]).catch("banque"),
  q: z.string().optional().catch(undefined),
  connexion: z.coerce.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/_authed/banques/ajouter")({
  validateSearch: wizardSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    if (deps.step === "comptes" && deps.connexion) {
      return {
        aspsps: [] as AspspOption[],
        accounts: await context.trpcClient.connections.accounts.query({
          connectionId: deps.connexion,
        }),
      };
    }
    return {
      aspsps: await context.trpcClient.connections.searchAspsps.query({
        q: deps.q,
      }),
      accounts: [] as AccountSummary[],
    };
  },
  component: AjouterBanquePage,
});

function AjouterBanquePage() {
  const { step } = Route.useSearch();
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Retour aux banques"
          render={<Link to="/banques" />}
        >
          <ArrowLeftIcon />
        </Button>
        <h1 className="text-2xl font-bold">
          {step === "comptes" ? "Vos comptes" : "Choisissez votre banque"}
        </h1>
      </div>
      {step === "comptes" ? <StepComptes /> : <StepBanque />}
    </main>
  );
}

function StepBanque() {
  const { aspsps } = Route.useLoaderData();
  const trpcClient = useTRPCClient();
  const [connecting, setConnecting] = useState<string | null>(null);

  const connect = async (aspsp: AspspOption) => {
    setConnecting(`${aspsp.name}-${aspsp.country}`);
    try {
      // Redirection pleine page vers la banque : le SCA se fait dans l'app bancaire,
      // puis la banque nous ramène sur /callback.
      const { url } = await trpcClient.connections.start.mutate({
        name: aspsp.name,
        country: aspsp.country,
      });
      // Faux positif du compilateur React (react-hooks/immutability) : l'assignation est sans risque
      // (redirection immédiate de toute la page). Le même pattern dans connection-card.tsx n'est pas
      // signalé ; ici le handler est enveloppé dans un .map(), ce qui change l'heuristique de l'analyse
      // de mémoïsation. Comportement runtime inchangé vs la source.
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = url;
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Échec du lancement de l'autorisation.",
      );
      setConnecting(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SearchInput
        param="q"
        placeholder="Rechercher une banque (ex : Caisse d'Epargne, Revolut…)"
      />
      <Card>
        <CardContent className="flex flex-col divide-y p-0">
          {aspsps.length === 0 ? (
            <p className="text-muted-foreground p-4 text-sm">
              Aucune banque trouvée.
            </p>
          ) : (
            aspsps.map((a) => {
              const key = `${a.name}-${a.country}`;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="flex items-center gap-3">
                    {a.logo && (
                      <img
                        src={a.logo}
                        alt=""
                        className="size-8 rounded object-contain"
                      />
                    )}
                    <span className="font-medium">{a.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {a.country}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    disabled={connecting !== null}
                    onClick={() => connect(a)}
                  >
                    {connecting === key && (
                      <Loader2Icon className="animate-spin" />
                    )}
                    Connecter
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-xs">
        Vous serez redirigé vers votre banque pour autoriser l'accès
        (authentification forte), puis ramené ici automatiquement.
      </p>
    </div>
  );
}

function StepComptes() {
  const { accounts } = Route.useLoaderData();
  const navigate = useNavigate();
  const trpcClient = useTRPCClient();
  const [rows, setRows] = useState<AccountSummary[]>(accounts);
  const [phase, setPhase] = useState<"edit" | "syncing">("edit");

  const setRow = (id: number, patch: Partial<AccountSummary>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const save = async () => {
    setPhase("syncing");
    try {
      await trpcClient.connections.updateAccounts.mutate({
        accounts: rows.map((r) => ({
          id: r.id,
          displayName: r.displayName,
          enabled: r.enabled,
        })),
      });
      const outcome = await trpcClient.sync.run.mutate();
      toastSyncOutcome(
        outcome,
        "Banque connectée et transactions synchronisées !",
      );
      void navigate({
        to: "/",
        search: { page: 1, sort: "date", order: "desc" },
      });
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Échec de la synchronisation initiale.",
      );
      void navigate({ to: "/banques" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Comptes découverts — nommez-les et choisissez lesquels suivre
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((a) => (
          <div key={a.id} className="flex items-center gap-3">
            <input
              type="checkbox"
              className="accent-primary size-4"
              aria-label="Inclure ce compte"
              checked={a.enabled}
              onChange={(e) => setRow(a.id, { enabled: e.target.checked })}
            />
            <Input
              value={a.displayName ?? ""}
              placeholder="Nom du compte (ex : Compte courant)"
              onChange={(e) =>
                setRow(a.id, { displayName: e.target.value || null })
              }
            />
            <span className="text-muted-foreground shrink-0 text-xs">
              {a.iban ?? a.uid}
            </span>
          </div>
        ))}
        <Button onClick={save} disabled={phase === "syncing"} className="mt-2">
          {phase === "syncing" && <Loader2Icon className="animate-spin" />}
          {phase === "syncing"
            ? "Synchronisation initiale en cours…"
            : "Enregistrer et synchroniser"}
        </Button>
      </CardContent>
    </Card>
  );
}
