"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftRightIcon,
  ChartPieIcon,
  LandmarkIcon,
  LogOutIcon,
  PiggyBankIcon,
  SettingsIcon,
  TagsIcon,
  UsersIcon,
} from "lucide-react";

import type { TransactionsSearch } from "@budget/shared";
import { cn } from "@budget/ui";
import { Button } from "@budget/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@budget/ui/dropdown-menu";

import { authClient } from "~/auth/client";
import { BankPicker } from "~/component/bank-picker";
import { PeriodPicker } from "~/component/period-picker";
import { ThemePicker } from "~/component/theme-picker";
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

/**
 * Les écrans de réglages, dans l'ordre du menu de l'engrenage. Une seule table
 * pour les trois usages : l'intitulé « Réglages › … » de l'en-tête, les entrées
 * du menu, et le test « suis-je sur un écran de réglages ». La route est
 * toujours `/<page>`, il n'y a donc rien de plus à déclarer.
 */
const SETTINGS_PAGES = [
  {
    page: "categories",
    to: "/categories",
    title: "Catégories",
    Icon: TagsIcon,
  },
  { page: "budgets", to: "/budgets", title: "Budgets", Icon: PiggyBankIcon },
  { page: "banques", to: "/banques", title: "Banques", Icon: LandmarkIcon },
  { page: "espaces", to: "/espaces", title: "Espaces", Icon: UsersIcon },
] as const;

const settingsPage = (page?: HeaderPage) =>
  SETTINGS_PAGES.find((entry) => entry.page === page);

/**
 * En-tête unique de l'application — portage de `AppHeader.dc.html` (Claude
 * Design, projet fc13100e-7ea1-4dac-8d2f-6614e40a7209, importé le 2026-08-01).
 *
 * Il remplace les *deux* barres précédentes : celle de la revue et celle des
 * réglages (`SettingsHeader`, supprimée). C'est le sens de la maquette, qui
 * traite `categories` et `banques` comme deux valeurs de son `page` (`budgets`
 * s'y est ajoutée depuis, d'où `SETTINGS_PAGES` plutôt qu'un ternaire) : la rangée
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
  const settingsTitle = settingsPage(page)?.title;
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
        "bg-background relative z-30 flex h-13 flex-none items-center gap-3.5 px-5 transition-shadow duration-200",
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="bg-primary size-2.5 rounded-xs" />
        <span className="text-body font-semibold tracking-[-0.02em]">
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
          <ChartPieIcon className="size-4" />
        </NavIcon>
        <NavIcon
          to="/transactions"
          search={linkSearch}
          label="Transactions"
          active={page === "transactions"}
        >
          <ArrowLeftRightIcon className="size-4" />
        </NavIcon>
      </nav>

      {isSettings && (
        <div className="border-border ml-1.5 flex items-baseline gap-2.5 border-l pl-4">
          <span className="label-caps">Réglages</span>
          <span className="text-body font-semibold tracking-[-0.01em]">
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

/**
 * Menu de l'engrenage : les écrans de réglages, le choix du thème, l'espace
 * actif et la déconnexion.
 *
 * **Aucun `className` ici** : la mise en forme des menus appartient à
 * `@budget/ui/dropdown-menu`, y compris le marquage de l'écran courant
 * (`aria-current`) et celui de l'option retenue. Le sélecteur de thème est
 * `ThemePicker`, monté nu — il porte son propre gabarit.
 * Voir `docs/adr/0001-le-design-appartient-au-package-ui.md`.
 *
 * L'ouverture n'est pas dupliquée dans un `useState` (le déclencheur porte
 * `aria-expanded`, dont la variante `ghost` du bouton se sert) et une entrée
 * referme le menu d'elle-même, d'où la disparition des `onNavigate`.
 */
function SettingsMenu({ page }: { page?: HeaderPage }) {
  const navigate = useNavigate();

  // `reloadDocument` comme à la connexion (`/login`) : la session est lue dans
  // le `beforeLoad` de `_authed` via le client tRPC, un rechargement complet est
  // le seul moyen sûr de repartir sans aucun cache de l'utilisateur sortant.
  const signOut = async () => {
    await authClient.signOut();
    await navigate({ to: "/login", reloadDocument: true });
  };

  return (
    <DropdownMenu>
      {/* `render` est l'équivalent Base UI d'`asChild` : il *remplace* l'élément
          du composant. Sous sa forme élément, les enfants restent portés par le
          composant et les props sont fusionnées automatiquement — la forme
          fonction `(props) => …` oblige à les réétaler soi-même. */}
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            title="Réglages"
            aria-label="Réglages"
          />
        }
      >
        <SettingsIcon />
      </DropdownMenuTrigger>
      {/* Chaque intitulé est *dans* son groupe : `DropdownMenuLabel` est un
          `Menu.GroupLabel`, que Base UI associe au groupe qui l'entoure et qui
          lève sans lui. Radix tolérait un intitulé isolé, pas Base UI. */}
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Réglages</DropdownMenuLabel>
          {SETTINGS_PAGES.map(({ page: target, to, title, Icon }) => (
            <DropdownMenuItem
              key={to}
              aria-current={page === target ? "page" : undefined}
              render={<Link to={to} />}
            >
              <Icon />
              {title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel>Thème</DropdownMenuLabel>
          <ThemePicker />
        </DropdownMenuGroup>

        <SpacePicker />

        <DropdownMenuSeparator />

        {/* Base UI n'a pas d'`onSelect` : l'entrée est cliquable, c'est `onClick`. */}
        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOutIcon />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Bascule d'espace — un espace personnel, ou un foyer partagé.
 *
 * Ne s'affiche qu'à partir de deux espaces : tant qu'il n'y en a qu'un, la
 * liste ne proposerait que l'endroit où l'on est déjà. Ce composant vit sous
 * `DropdownMenuContent`, qui ne se monte qu'à l'ouverture — ses requêtes ne
 * partent donc pas au rendu de chaque page.
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
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup
        value={active?.id ?? ""}
        // `Menu.RadioItem.value` est typé `any` chez Base UI : on annote plutôt
        // que de laisser un `any` traverser jusqu'à l'appel réseau.
        onValueChange={(id: string) => void select(id)}
      >
        <DropdownMenuLabel>Espace</DropdownMenuLabel>
        {spaces.map((space) => (
          <DropdownMenuRadioItem key={space.id} value={space.id}>
            {space.name}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}
