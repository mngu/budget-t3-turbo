import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ExternalLinkIcon, RefreshCwIcon } from "lucide-react";
import { z } from "zod/v4";

import type { AccountSummary, AspspOption } from "@budget/api";
import { cn } from "@budget/ui";
import { Button } from "@budget/ui/button";
import { Input } from "@budget/ui/input";
import { Spinner } from "@budget/ui/spinner";
import { toast } from "@budget/ui/toast";

import { AppHeader } from "~/component/app-header";
import { SearchInput } from "~/component/search-input";
import { toastSyncOutcome } from "~/lib/sync-toast";
import { useTRPCClient } from "~/lib/trpc";
import { BankLogo } from "./-components/bank-logo";

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
    <div className="flex h-dvh flex-col overflow-hidden text-[13px] leading-[1.45]">
      <AppHeader page="banques" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto max-w-[1010px] px-6 pt-5 pb-12">
          <h1 className="text-2xl font-semibold tracking-tight">
            Ajouter une banque
          </h1>

          <section className="border-border-strong bg-card mt-5 overflow-hidden rounded-2xl border">
            <header className="bg-sunken flex items-center gap-3 border-b px-4.5 py-3">
              <Link
                to="/banques"
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ‹ Retour
              </Link>
              <span className="bg-border h-4 w-px" />
              <WizardStep
                n="1"
                label="Choisissez votre banque"
                current={step === "banque"}
              />
              <WizardStep
                n="2"
                label="Vos comptes"
                current={step === "comptes"}
              />
            </header>

            {step === "comptes" ? <StepComptes /> : <StepBanque />}
          </section>
        </main>
      </div>
    </div>
  );
}

function WizardStep({
  n,
  label,
  current,
}: {
  n: string;
  label: string;
  current: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        current ? "text-foreground font-semibold" : "text-subtle",
      )}
    >
      <span
        className={cn(
          "num flex size-[18px] items-center justify-center rounded-full border text-[10px]",
          current
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border-strong text-subtle",
        )}
      >
        {n}
      </span>
      {label}
    </span>
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
      // (redirection immédiate de toute la page). Le même pattern dans use-renew.ts n'est pas
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
    <div className="px-5 pt-4.5 pb-5">
      <h2 className="text-[13.5px] font-semibold">Choisissez votre banque</h2>

      <SearchInput
        param="q"
        placeholder="Rechercher une banque (ex : Caisse d'Epargne, Revolut…)"
        className="mt-3 h-8.5 max-w-[480px] rounded-[9px] text-[12.5px]"
      />

      {aspsps.length === 0 ? (
        <div className="border-border-strong mt-3.5 rounded-xl border border-dashed px-4.5 py-6 text-center">
          <p className="text-[12.5px] font-medium">Aucune banque trouvée</p>
          <p className="text-muted-foreground mt-1 text-[11.5px]">
            Aucun établissement ne correspond à votre recherche. Essayez le nom
            officiel de l'établissement.
          </p>
        </div>
      ) : (
        <div className="mt-3.5 overflow-hidden rounded-xl border">
          {aspsps.map((aspsp) => {
            const key = `${aspsp.name}-${aspsp.country}`;
            return (
              <div
                key={key}
                className="hover:bg-surface-2 grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0"
              >
                <BankLogo
                  name={aspsp.name}
                  logoUrl={aspsp.logo}
                  className="size-8 text-xs"
                />
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-medium">
                    {aspsp.name}
                  </div>
                  <div className="text-subtle text-[11px]">{aspsp.country}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={connecting !== null}
                  onClick={() => connect(aspsp)}
                >
                  {connecting === key && <Spinner />}
                  Connecter
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-subtle mt-3.5 flex max-w-[640px] items-center gap-2.5 text-[11.5px] text-pretty">
        <ExternalLinkIcon className="size-3.5 flex-none" />
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
        search: { page: 1, sort: "date", order: "desc", internes: "toutes" },
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

  // `sync.run` est une seule mutation attendue, sans flux de progression : la
  // maquette montre un compteur de transactions et une barre à 58 %, qui
  // n'auraient aucune source. Attente indéterminée, donc.
  if (phase === "syncing") {
    return (
      <div className="px-5 py-8">
        <div className="flex items-center justify-center gap-2.5">
          <RefreshCwIcon className="text-primary size-4 animate-spin" />
          <span className="text-sm font-semibold">
            Synchronisation initiale en cours…
          </span>
        </div>
        <p className="text-muted-foreground mx-auto mt-2 max-w-[500px] text-center text-xs text-pretty">
          Nous récupérons l'historique des comptes suivis. Comptez une à deux
          minutes la première fois.
        </p>
      </div>
    );
  }

  const kept = rows.filter((r) => r.enabled).length;

  return (
    <div className="px-5 pt-4.5 pb-5">
      <h2 className="text-[13.5px] font-semibold">Vos comptes</h2>
      <p className="text-muted-foreground mt-1 text-[11.5px]">
        Comptes découverts — nommez-les et choisissez lesquels suivre.
      </p>

      <div className="mt-3.5 overflow-hidden rounded-xl border">
        {rows.map((account) => (
          <div
            key={account.id}
            className="hover:bg-surface-2 grid grid-cols-[20px_minmax(120px,1fr)_max-content] items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0"
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={account.enabled}
              aria-label={`Suivre ${account.displayName ?? account.iban ?? account.uid}`}
              onClick={() => setRow(account.id, { enabled: !account.enabled })}
              className={cn(
                "text-primary-foreground flex size-[17px] items-center justify-center rounded-[5px] border-[1.5px] text-[10px]",
                account.enabled
                  ? "border-primary bg-primary"
                  : "border-border-strong",
              )}
            >
              {account.enabled ? "✓" : ""}
            </button>

            <Input
              value={account.displayName ?? ""}
              placeholder="Nom du compte (ex : Compte courant)"
              onChange={(e) =>
                setRow(account.id, { displayName: e.target.value || null })
              }
            />

            <span
              className={cn(
                "text-subtle num text-[11.5px] whitespace-nowrap",
                account.enabled ? "" : "line-through",
              )}
            >
              {account.iban ?? account.uid}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-subtle min-w-0 flex-1 text-[11.5px]">
          {kept} compte{kept > 1 ? "s" : ""} suivi{kept > 1 ? "s" : ""} sur{" "}
          {rows.length} · les comptes décochés restent visibles mais ne sont pas
          importés
        </span>
        <Button className="flex-none" onClick={save}>
          Enregistrer et synchroniser
        </Button>
      </div>
    </div>
  );
}
