"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import {
  LandmarkIcon,
  LogOutIcon,
  PiggyBankIcon,
  SettingsIcon,
  TagsIcon,
  UsersIcon,
} from "lucide-react";

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

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    title?: string;
  }
}

/**
 * Les écrans de réglages, dans l'ordre du menu de l'engrenage. Une seule table
 * pour les trois usages : l'intitulé « Réglages › … » de l'en-tête, les entrées
 * du menu, et le test « suis-je sur un écran de réglages ». La route est
 * toujours `/<page>`, il n'y a donc rien de plus à déclarer.
 */
const SETTINGS_PAGES = [
  {
    page: "categories",
    to: "/settings/categories",
    title: "Catégories",
    Icon: TagsIcon,
  },
  {
    page: "budgets",
    to: "/settings/budgets",
    title: "Budgets",
    Icon: PiggyBankIcon,
  },
  {
    page: "banques",
    to: "/settings/banques",
    title: "Banques",
    Icon: LandmarkIcon,
  },
  {
    page: "espaces",
    to: "/settings/espaces",
    title: "Espaces",
    Icon: UsersIcon,
  },
] as const;

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
export function AppHeader({ title }: { title?: string }) {
  const isSettings = title !== undefined;

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
      {/* La marque *est* le retour à la revue. C'est le seul lien de la barre
          depuis que la rangée de navigation en est partie : les liens entre les
          deux écrans de la revue vivent maintenant dans la zone centrale, mais
          les quatre écrans de réglages n'ont rien d'autre pour rentrer. La
          search est intégralement conservée — c'est le même périmètre. */}
      <Link
        to="/"
        search={linkSearch}
        title="Revue du mois"
        className="flex items-center gap-2.5 hover:opacity-60"
      >
        <div className="bg-primary size-2.5 rounded-xs" />
        <span className="text-body font-semibold tracking-[-0.02em]">
          Budget
        </span>
      </Link>

      {isSettings && (
        <div className="border-border ml-1.5 flex items-baseline gap-2.5 border-l pl-4">
          <span className="label-caps">Réglages</span>
          <span className="text-body font-semibold tracking-[-0.01em]">
            {title}
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
        <SettingsMenu page={title} />
      </div>
    </header>
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
function SettingsMenu({ page }: { page?: string }) {
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
