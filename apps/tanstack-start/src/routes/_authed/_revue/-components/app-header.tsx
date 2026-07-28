"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import {
  LandmarkIcon,
  MonitorIcon,
  MoonIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
  SunIcon,
} from "lucide-react";

import { REVIEW_QUEUE_LIMIT } from "@budget/shared";
import { cn } from "@budget/ui";
import { useTheme } from "@budget/ui/theme";
import { toast } from "@budget/ui/toast";

import { SearchInput } from "~/component/search-input";
import { toastSyncOutcome } from "~/lib/sync-toast";
import { reviewScope } from "~/lib/transactions-search";
import { useTRPC, useTRPCClient } from "~/lib/trpc";
import { useRevueSearch } from "~/lib/use-revue-search";
import { PeriodStepper } from "./period-stepper";

const TABS = [
  { to: "/", label: "Revue du mois" },
  { to: "/ventiler", label: "À revoir" },
  { to: "/transactions", label: "Toutes les transactions" },
] as const;

export function AppHeader() {
  const { search } = useRevueSearch();

  return (
    <header className="bg-card border-border flex h-[52px] flex-none items-center gap-4 border-b px-5">
      <div className="flex items-center gap-2.5">
        <div className="bg-primary size-2.5 rounded-[2px]" />
        <span className="text-[13.5px] font-semibold tracking-[-0.02em]">
          Budget
        </span>
      </div>

      <PeriodStepper />

      <nav className="bg-secondary border-border flex gap-[3px] rounded-[9px] border p-0.5">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            // La search est intégralement conservée d'un onglet à l'autre :
            // c'est le même périmètre vu de deux façons.
            search={search}
            activeOptions={{ exact: true }}
            className="flex items-center gap-1.5 rounded-[7px] px-3 py-1 text-xs data-[status=active]:bg-[var(--card)] data-[status=active]:font-semibold"
            activeProps={{ className: "text-foreground" }}
            inactiveProps={{ className: "text-muted-foreground" }}
          >
            {tab.label}
            {tab.to === "/ventiler" && <ReviewBadge />}
          </Link>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 justify-center">
        <div className="relative w-full max-w-80">
          <SearchIcon className="text-subtle pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <SearchInput
            param="q"
            resetParams={{ page: 1 }}
            className="bg-background h-[30px] rounded-lg pl-7 text-[12.5px]"
            placeholder="Rechercher un libellé, un montant…"
            aria-label="Recherche"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <IconLink to="/categories" label="Catégories">
          <SparklesIcon className="size-3.5" />
        </IconLink>
        <IconLink to="/banques" label="Banques">
          <LandmarkIcon className="size-3.5" />
        </IconLink>
        <SyncButton />
        <ThemeButton />
      </div>
    </header>
  );
}

// Compteur de l'onglet « À revoir ». Sans suspense et sans loader dédié : les
// quatre écrans amorcent `transactions.review` dans le cache react-query, le
// badge s'y sert. La file est plafonnée côté serveur, d'où le « + » : afficher
// « 40 » pour 400 transactions ferait passer un plafond pour un décompte.
function ReviewBadge() {
  const trpc = useTRPC();
  const { search } = useRevueSearch();
  const { data } = useQuery(
    trpc.transactions.review.queryOptions(reviewScope(search)),
  );
  if (!data?.length) return null;
  return (
    <span className="text-bad bg-bad-soft rounded-full px-1.5 text-[11px] font-semibold">
      {data.length}
      {data.length >= REVIEW_QUEUE_LIMIT && "+"}
    </span>
  );
}

const iconButton =
  "border-border text-muted-foreground hover:bg-accent hover:text-foreground flex size-[26px] items-center justify-center rounded-[7px] border disabled:opacity-50";

function IconLink({
  to,
  label,
  children,
}: {
  to: "/categories" | "/banques";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link to={to} aria-label={label} title={label} className={iconButton}>
      {children}
    </Link>
  );
}

// Reprend le ThemeToggle de @budget/ui (même cycle auto → clair → sombre, même
// pilotage par les classes posées sur <html>) au gabarit 26 px de l'en-tête ;
// celui du kit est dimensionné pour un Button `size="icon"`, 10 px plus haut,
// et cassait l'alignement de la rangée.
function ThemeButton() {
  const { toggleMode } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label="Basculer le thème"
      title="Basculer le thème"
      className={iconButton}
    >
      <SunIcon className="auto:hidden size-3.5 dark:hidden" />
      <MoonIcon className="not-auto:dark:block hidden size-3.5" />
      <MonitorIcon className="auto:block hidden size-3.5" />
    </button>
  );
}

// sync.run touche aux sessions bancaires réelles et déclenche une SCA : ce
// bouton est le seul déclencheur, jamais un effet de bord d'autre chose.
function SyncButton() {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [syncing, setSyncing] = useState(false);

  return (
    <button
      type="button"
      aria-label="Synchroniser"
      title="Synchroniser"
      disabled={syncing}
      className={iconButton}
      onClick={async () => {
        setSyncing(true);
        try {
          const outcome = await trpcClient.sync.run.mutate();
          await router.invalidate();
          toastSyncOutcome(outcome);
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Échec de la synchronisation.",
          );
        } finally {
          setSyncing(false);
        }
      }}
    >
      <RefreshCwIcon className={cn("size-3.5", syncing && "animate-spin")} />
    </button>
  );
}
