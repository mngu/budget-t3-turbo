import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ExternalLinkIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import { z } from "zod/v4";

import type { AccountSummary, AspspOption } from "@budget/api";
import { cn } from "@budget/ui";
import { Button } from "@budget/ui/button";
import { Checkbox } from "@budget/ui/checkbox";
import { Input } from "@budget/ui/input";
import { InputGroup, InputGroupAddon } from "@budget/ui/input-group";
import { Spinner } from "@budget/ui/spinner";
import { toast } from "@budget/ui/toast";

import { SearchInput } from "~/component/search-input";
import { SettingsPage } from "~/component/settings-page";
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
    <SettingsPage page="banques" title="Ajouter une banque">
      <section className="border-border-strong bg-card mt-5 overflow-hidden rounded-lg border">
        <header className="bg-sunken flex items-center gap-3 border-b px-4.5 py-3">
          <Link
            to="/banques"
            className="text-muted-foreground hover:text-foreground text-control"
          >
            ‹ Retour
          </Link>
          <span className="bg-border h-4 w-px" />
          <WizardStep
            n="1"
            label="Choisissez votre banque"
            current={step === "banque"}
          />
          <WizardStep n="2" label="Vos comptes" current={step === "comptes"} />
        </header>

        {step === "comptes" ? <StepComptes /> : <StepBanque />}
      </section>
    </SettingsPage>
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
        "text-control inline-flex items-center gap-1.5",
        current ? "text-foreground font-semibold" : "text-subtle",
      )}
    >
      <span
        className={cn(
          "num text-label flex size-4 items-center justify-center rounded-full border",
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
      <h2 className="text-body font-semibold">Choisissez votre banque</h2>

      <InputGroup className="mt-3 max-w-120">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <SearchInput
          param="q"
          placeholder="Rechercher une banque (ex : Caisse d'Epargne, Revolut…)"
        />
      </InputGroup>

      {aspsps.length === 0 ? (
        <div className="border-border-strong mt-3.5 rounded-xl border border-dashed px-4.5 py-6 text-center">
          <p className="text-control font-medium">Aucune banque trouvée</p>
          <p className="text-muted-foreground text-control mt-1">
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
                  className="text-control size-8"
                />
                <div className="min-w-0">
                  <div className="text-control truncate font-medium">
                    {aspsp.name}
                  </div>
                  <div className="text-subtle text-meta">{aspsp.country}</div>
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

      <p className="text-subtle text-control mt-3.5 flex max-w-160 items-center gap-2.5 text-pretty">
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
          <span className="text-subheading">
            Synchronisation initiale en cours…
          </span>
        </div>
        <p className="text-muted-foreground text-control mx-auto mt-2 max-w-125 text-center text-pretty">
          Nous récupérons l'historique des comptes suivis. Comptez une à deux
          minutes la première fois.
        </p>
      </div>
    );
  }

  const kept = rows.filter((r) => r.enabled).length;

  return (
    <div className="px-5 pt-4.5 pb-5">
      <h2 className="text-body font-semibold">Vos comptes</h2>
      <p className="text-muted-foreground text-control mt-1">
        Comptes découverts — nommez-les et choisissez lesquels suivre.
      </p>

      <div className="mt-3.5 overflow-hidden rounded-xl border">
        {rows.map((account) => (
          <div
            key={account.id}
            className="hover:bg-surface-2 grid grid-cols-[20px_minmax(120px,1fr)_max-content] items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0"
          >
            <Checkbox
              checked={account.enabled}
              onCheckedChange={(enabled) => setRow(account.id, { enabled })}
              aria-label={`Suivre ${account.displayName ?? account.iban ?? account.uid}`}
            />

            <Input
              value={account.displayName ?? ""}
              placeholder="Nom du compte (ex : Compte courant)"
              onChange={(e) =>
                setRow(account.id, { displayName: e.target.value || null })
              }
            />

            <span
              className={cn(
                "text-subtle num text-meta whitespace-nowrap",
                account.enabled ? "" : "line-through",
              )}
            >
              {account.iban ?? account.uid}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-subtle text-control min-w-0 flex-1">
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
