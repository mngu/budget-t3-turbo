"use client";

import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftRightIcon,
  ChartPieIcon,
  LandmarkIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  PiggyBankIcon,
  SettingsIcon,
  SunIcon,
  TagsIcon,
  UsersIcon,
} from "lucide-react";

import type { TransactionsSearch } from "@budget/shared";
import type { ThemeMode } from "@budget/ui/theme";
import { cn } from "@budget/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@budget/ui/popover";
import { useTheme } from "@budget/ui/theme";

import { authClient } from "~/auth/client";
import { BankPicker } from "~/component/bank-picker";
import { PeriodPicker } from "~/component/period-picker";
import { SEARCH_DEFAULTS } from "~/lib/transactions-search";
import { useRevueSearch } from "~/lib/use-revue-search";

/**
 * Écran mis en avant dans l'en-tête. `undefined` est un état légitime :
 * `/classer` et `/categorie/$name` vivent bien dans la coque de la revue mais
 * n'ont pas d'icône, la rangée étant réduite à deux entrées — allumer celle de
 * la revue y ferait promettre « vous êtes ici » à un lien qui emmène ailleurs.
 */
export type HeaderPage =
  | "revue"
  | "transactions"
  | "categories"
  | "budgets"
  | "banques"
  | "espaces";

const SETTINGS_TITLES: Partial<Record<HeaderPage, string>> = {
  categories: "Catégories",
  budgets: "Budgets",
  banques: "Banques",
  espaces: "Espaces",
};

/**
 * En-tête unique de l'application — portage de `AppHeader.dc.html` (Claude
 * Design, projet fc13100e-7ea1-4dac-8d2f-6614e40a7209, importé le 2026-08-01).
 *
 * Il remplace les *deux* barres précédentes : celle de la revue et celle des
 * réglages (`SettingsHeader`, supprimée). C'est le sens de la maquette, qui
 * traite `categories` et `banques` comme deux valeurs de son `page` (`budgets`
 * s'y est ajoutée depuis, d'où `SETTINGS_TITLES` plutôt qu'un ternaire) : la rangée
 * de marque et d'utilitaires ne bouge plus d'un écran à l'autre, seul le milieu
 * change — période et comptes sur la revue, intitulé « Réglages › … » ailleurs.
 *
 * Deux éléments de la maquette ne sont pas portés. Le bouton « ◱ États » est un
 * commutateur d'états de maquette (`statesDisplay` suit la présence de la prop
 * `onStates`), sans objet ici. Et `monthOnly`, qui réduit les raccourcis à trois
 * mois entiers : un en-tête unique ne peut pas diverger d'une route à l'autre,
 * et `Transactions.dc.html` ne le pose pas non plus.
 */
export function AppHeader({ page }: { page?: HeaderPage }) {
  const settingsTitle = page ? SETTINGS_TITLES[page] : undefined;
  const isSettings = settingsTitle !== undefined;

  // Appelé inconditionnellement (règle des hooks) mais lu seulement hors des
  // écrans de réglages : là-bas, `useSearch({ strict: false })` renvoie la
  // search de *cette* route, qui n'est pas une `TransactionsSearch`.
  const { search } = useRevueSearch();
  // Sur les écrans de réglages, la search en vigueur n'est pas celle de la
  // revue : les liens de la rangée repartent donc des défauts, que
  // `stripSearchParams` retire de l'URL et que `defaultToCurrentMonth` complète
  // par le mois courant.
  const linkSearch = isSettings ? SEARCH_DEFAULTS : search;

  return (
    <header
      className={cn(
        "bg-background relative z-30 flex h-[52px] flex-none items-center gap-3.5 px-5 transition-shadow duration-200",
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="bg-primary size-2.5 rounded-[2px]" />
        <span className="text-[13.5px] font-semibold tracking-[-0.02em]">
          Budget
        </span>
      </div>

      <nav className="ml-2.5 flex items-center gap-4">
        <NavIcon
          to="/"
          search={linkSearch}
          label="Revue du mois"
          active={page === "revue"}
        >
          <ChartPieIcon className="size-[17px]" />
        </NavIcon>
        <NavIcon
          to="/transactions"
          search={linkSearch}
          label="Transactions"
          active={page === "transactions"}
        >
          <ArrowLeftRightIcon className="size-[17px]" />
        </NavIcon>
      </nav>

      {isSettings && (
        <div className="border-border ml-1.5 flex items-baseline gap-2.5 border-l pl-4">
          <span className="label-caps">Réglages</span>
          <span className="text-[13px] font-semibold tracking-[-0.01em]">
            {settingsTitle}
          </span>
        </div>
      )}

      {!isSettings && <PeriodPicker />}

      <div
        className={cn(
          "flex items-center gap-3",
          isSettings ? "ml-auto" : "ml-1",
        )}
      >
        {!isSettings && <BankPicker />}
        <SettingsMenu page={page} />
      </div>
    </header>
  );
}

function NavIcon({
  to,
  search,
  label,
  active,
  children,
}: {
  to: "/" | "/transactions";
  search: TransactionsSearch;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      // La search est intégralement conservée d'un écran à l'autre : c'est le
      // même périmètre vu de deux façons.
      search={search}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex",
        active
          ? "text-primary drop-shadow-[0_0_7px_color-mix(in_oklab,var(--primary)_55%,transparent)]"
          : "text-subtle hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

const THEME_OPTIONS: {
  mode: ThemeMode;
  label: string;
  Icon: typeof SunIcon;
}[] = [
  { mode: "auto", label: "Système", Icon: MonitorIcon },
  { mode: "light", label: "Clair", Icon: SunIcon },
  { mode: "dark", label: "Sombre", Icon: MoonIcon },
];

/**
 * Menu de l'engrenage : les deux écrans de réglages et le choix du thème.
 *
 * C'est le seul endroit de l'app qui *lit* `themeMode` plutôt que de se piloter
 * par les classes posées sur `<html>` — il doit désigner le mode actif, pas
 * seulement refléter le thème résolu. Sans risque de désaccord d'hydratation :
 * le panneau ne se monte qu'à l'ouverture, donc jamais au rendu serveur.
 */
function SettingsMenu({ page }: { page?: HeaderPage }) {
  const [open, setOpen] = useState(false);
  const { themeMode, setTheme } = useTheme();
  const navigate = useNavigate();
  const isSettings = page !== undefined && page in SETTINGS_TITLES;

  // `reloadDocument` comme à la connexion (`/login`) : la session est lue dans
  // le `beforeLoad` de `_authed` via le client tRPC, un rechargement complet est
  // le seul moyen sûr de repartir sans aucun cache de l'utilisateur sortant.
  const signOut = async () => {
    await authClient.signOut();
    await navigate({ to: "/login", reloadDocument: true });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(props) => (
          <button
            type="button"
            title="Réglages"
            aria-label="Réglages"
            className={cn(
              "flex",
              isSettings || open
                ? "text-foreground"
                : "text-subtle hover:text-foreground",
            )}
            {...props}
          >
            <SettingsIcon className="size-[15px]" />
          </button>
        )}
      />
      <PopoverContent align="end" className="w-[212px] gap-0 p-1.5">
        <div className="label-caps px-2.5 pt-1 pb-1.5">Réglages</div>
        <SettingsLink
          to="/categories"
          label="Catégories"
          active={page === "categories"}
          onNavigate={() => setOpen(false)}
        >
          <TagsIcon className="size-3.5" />
        </SettingsLink>
        <SettingsLink
          to="/budgets"
          label="Budgets"
          active={page === "budgets"}
          onNavigate={() => setOpen(false)}
        >
          <PiggyBankIcon className="size-3.5" />
        </SettingsLink>
        <SettingsLink
          to="/banques"
          label="Banques"
          active={page === "banques"}
          onNavigate={() => setOpen(false)}
        >
          <LandmarkIcon className="size-3.5" />
        </SettingsLink>
        <SettingsLink
          to="/espaces"
          label="Espaces"
          active={page === "espaces"}
          onNavigate={() => setOpen(false)}
        >
          <UsersIcon className="size-3.5" />
        </SettingsLink>

        <div className="bg-border mx-2.5 my-1.5 h-px" />

        <div className="label-caps px-2.5 pt-0.5 pb-1.5">Thème</div>
        <div className="flex gap-[3px] px-1 pb-0.5">
          {THEME_OPTIONS.map(({ mode, label, Icon }) => {
            const active = themeMode === mode;
            return (
              <button
                key={mode}
                type="button"
                title={label}
                onClick={() => setTheme(mode)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[10.5px]",
                  active
                    ? "bg-accent-soft text-primary font-semibold"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                <Icon className="size-[15px]" />
                {label}
              </button>
            );
          })}
        </div>

        <SpacePicker />

        <div className="bg-border mx-2.5 my-1.5 h-px" />

        <button
          type="button"
          onClick={() => void signOut()}
          className="hover:bg-accent flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-1.5 text-[12.5px]"
        >
          <span className="text-subtle flex">
            <LogOutIcon className="size-3.5" />
          </span>
          Se déconnecter
        </button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Bascule d'espace — un espace personnel, ou un foyer partagé.
 *
 * Ne s'affiche qu'à partir de deux espaces : tant qu'il n'y en a qu'un, la
 * liste ne proposerait que l'endroit où l'on est déjà. Ce composant vit sous
 * `PopoverContent`, qui ne se monte qu'à l'ouverture — ses requêtes ne partent
 * donc pas au rendu de chaque page.
 *
 * Le changement d'espace **recharge le document**. Le périmètre ne vit pas dans
 * l'URL mais dans la session : sans rechargement, react-query servirait les
 * transactions déjà en cache pour les mêmes clés, c'est-à-dire celles de
 * l'espace qu'on vient de quitter. Même geste qu'à la connexion et à la
 * déconnexion, pour la même raison.
 */
function SpacePicker() {
  const { data: spaces } = authClient.useListOrganizations();
  const { data: active } = authClient.useActiveOrganization();

  if (!spaces || spaces.length < 2) return null;

  const select = async (organizationId: string) => {
    if (organizationId === active?.id) return;
    await authClient.organization.setActive({ organizationId });
    window.location.reload();
  };

  return (
    <>
      <div className="bg-border mx-2.5 my-1.5 h-px" />
      <div className="label-caps px-2.5 pt-0.5 pb-1.5">Espace</div>
      {spaces.map((space) => (
        <button
          key={space.id}
          type="button"
          onClick={() => void select(space.id)}
          aria-current={space.id === active?.id ? "true" : undefined}
          className={cn(
            "hover:bg-accent flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-1.5 text-left text-[12.5px]",
            space.id === active?.id && "bg-surface-2 font-semibold",
          )}
        >
          <span
            className={cn(
              "flex",
              space.id === active?.id ? "text-primary" : "text-subtle",
            )}
          >
            <UsersIcon className="size-3.5" />
          </span>
          {space.name}
        </button>
      ))}
    </>
  );
}

function SettingsLink({
  to,
  label,
  active,
  onNavigate,
  children,
}: {
  to: "/categories" | "/budgets" | "/banques" | "/espaces";
  label: string;
  active: boolean;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "hover:bg-accent flex items-center gap-2.5 rounded-[7px] px-2.5 py-1.5 text-[12.5px]",
        active && "bg-surface-2 font-semibold",
      )}
    >
      <span className={cn("flex", active ? "text-primary" : "text-subtle")}>
        {children}
      </span>
      {label}
    </Link>
  );
}
