import type { AccountSummary, AspspOption } from "@budget/api";

import { Button, Checkbox, Input, Spinner, toast } from "@heroui/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ExternalLinkIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod/v4";

import { cn } from "@budget/ui";
import { SearchInput } from "~/component/search-input";
import { toastSyncOutcome } from "~/lib/sync-toast";
import { useTRPCClient } from "~/lib/trpc";

import { BankLogo } from "./-components/bank-logo";

const wizardSearchSchema = z.object({
  step: z.enum(["banque", "comptes"]).catch("banque"),
  q: z.string().optional().catch(undefined),
  connexion: z.coerce.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/_authed/settings/banques/ajouter")({
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
  staticData: { title: "Ajouter une banque" },
  component: AjouterBanquePage,
});

function AjouterBanquePage() {
  const { step } = Route.useSearch();

  return (
    <section className="border-border bg-surface mt-5 overflow-hidden rounded-lg border">
      <header className="bg-background-secondary flex items-center gap-3 border-b px-4.5 py-3">
        <Link
          to="/settings/banques"
          className="text-muted hover:text-foreground text-control"
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
        current ? "text-foreground font-semibold" : "text-muted",
      )}
    >
      <span
        className={cn(
          "num text-label flex size-4 items-center justify-center rounded-full border",
          current
            ? "border-accent bg-accent text-accent-foreground"
            : "border-border text-muted",
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
      const { url } = await trpcClient.connections.start.mutate({
        name: aspsp.name,
        country: aspsp.country,
      });
      // Intentional document navigation, not a mutation of React state.
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = url;
    } catch (err) {
      toast.danger(
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

      <SearchInput
        param="q"
        placeholder="Rechercher une banque (ex : Caisse d'Epargne, Revolut…)"
        className="mt-3 max-w-120"
      />

      {aspsps.length === 0 ? (
        <div className="border-border mt-3.5 rounded-xl border border-dashed px-4.5 py-6 text-center">
          <p className="text-control font-medium">Aucune banque trouvée</p>
          <p className="text-muted text-control mt-1">
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
                className="hover:bg-surface-secondary grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0"
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
                  <div className="text-muted text-meta">{aspsp.country}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={connecting !== null}
                  onPress={() => void connect(aspsp)}
                >
                  {connecting === key && <Spinner color="current" size="sm" />}
                  Connecter
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-muted text-control mt-3.5 flex max-w-160 items-center gap-2.5 text-pretty">
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
        search: { page: 1, sort: "date", order: "desc" },
      });
    } catch (err) {
      toast.danger(
        err instanceof Error
          ? err.message
          : "Échec de la synchronisation initiale.",
      );
      void navigate({ to: "/settings/banques" });
    }
  };

  // Sync has no progress stream, so the pending indicator is indeterminate.
  if (phase === "syncing") {
    return (
      <div className="px-5 py-8">
        <div className="flex items-center justify-center gap-2.5">
          <RefreshCwIcon className="text-accent size-4 animate-spin" />
          <span className="text-subheading">
            Synchronisation initiale en cours…
          </span>
        </div>
        <p className="text-muted text-control mx-auto mt-2 max-w-125 text-center text-pretty">
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
      <p className="text-muted text-control mt-1">
        Comptes découverts — nommez-les et choisissez lesquels suivre.
      </p>

      <div className="mt-3.5 overflow-hidden rounded-xl border">
        {rows.map((account) => (
          <div
            key={account.id}
            className="hover:bg-surface-secondary grid grid-cols-[20px_minmax(120px,1fr)_max-content] items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0"
          >
            <Checkbox
              isSelected={account.enabled}
              onChange={(enabled) => setRow(account.id, { enabled })}
              aria-label={`Suivre ${account.displayName ?? account.iban ?? account.uid}`}
            >
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
            </Checkbox>

            <Input
              value={account.displayName ?? ""}
              placeholder="Nom du compte (ex : Compte courant)"
              aria-label="Nom du compte"
              onChange={(e) =>
                setRow(account.id, { displayName: e.target.value || null })
              }
            />

            <span
              className={cn(
                "text-muted num text-meta whitespace-nowrap",
                account.enabled ? "" : "line-through",
              )}
            >
              {account.iban ?? account.uid}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-muted text-control min-w-0 flex-1">
          {kept} compte{kept > 1 ? "s" : ""} suivi{kept > 1 ? "s" : ""} sur{" "}
          {rows.length} · les comptes décochés restent visibles mais ne sont pas
          importés
        </span>
        <Button className="flex-none" onPress={() => void save()}>
          Enregistrer et synchroniser
        </Button>
      </div>
    </div>
  );
}
