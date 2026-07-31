"use client";

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LandmarkIcon, SearchIcon, SparklesIcon } from "lucide-react";

import { REVIEW_QUEUE_LIMIT } from "@budget/shared";

import { SearchInput } from "~/component/search-input";
import { HEADER_ICON_BUTTON, ThemeButton } from "~/component/theme-button";
import { reviewScope } from "~/lib/transactions-search";
import { useTRPC } from "~/lib/trpc";
import { useRevueSearch } from "~/lib/use-revue-search";
import { BankPicker } from "./bank-picker";
import { PeriodStepper } from "./period-stepper";

const TABS = [
  { to: "/", label: "Revue du mois" },
  { to: "/classer", label: "À revoir" },
  { to: "/transactions", label: "Toutes les transactions" },
  // Page de test (portage de la maquette « Revue du mois épurée »). Elle est
  // ici et non dans la rangée d'icônes à droite parce qu'elle partage la search
  // des autres onglets : y arriver doit conserver la période et les filtres,
  // ce que `/categories` et `/banques` ne sauraient pas faire.
  { to: "/revue-epuree", label: "Revue épurée" },
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
            {tab.to === "/classer" && <ReviewBadge />}
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
        <BankPicker />
        {/* Absents de la maquette, qui n'a que ces quatre écrans : ce sont les
            seuls accès de l'app aux pages Banques et Catégories. */}
        <IconLink to="/categories" label="Catégories">
          <SparklesIcon className="size-3.5" />
        </IconLink>
        <IconLink to="/banques" label="Banques">
          <LandmarkIcon className="size-3.5" />
        </IconLink>
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
    <Link
      to={to}
      aria-label={label}
      title={label}
      className={HEADER_ICON_BUTTON}
    >
      {children}
    </Link>
  );
}
