"use client";

import { Link, useMatches, useNavigate } from "@tanstack/react-router";
import {
  LandmarkIcon,
  LogOutIcon,
  SettingsIcon,
  TagsIcon,
  UsersIcon,
} from "lucide-react";

import { cn } from "@budget/ui";
import { Button } from "@budget/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
import { setCents, useFormat } from "~/lib/use-format";
import { useRevueSearch } from "~/lib/use-revue-search";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    title?: string;
  }
}

const SETTINGS_PAGES = [
  {
    page: "categories",
    to: "/settings/categories",
    title: "Catégories",
    Icon: TagsIcon,
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

export function AppHeader({ title }: { title?: string }) {
  const isSettings = title !== undefined;

  // Check the layout match: selectors read its loader and throw outside it.
  const isRevue = useMatches({
    select: (m) => m.some((x) => x.routeId === "/_authed/_period-overview"),
  });

  // Only read this search on overview routes; other routes use different schemas.
  const { search } = useRevueSearch();
  const linkSearch = isRevue ? search : SEARCH_DEFAULTS;

  return (
    <header
      className={cn(
        "bg-background relative z-30 flex-none items-center gap-x-3 px-4 transition-shadow duration-200 sm:gap-x-3.5 sm:px-5",
        isRevue
          ? "grid h-26 grid-cols-2 grid-rows-2 md:h-13 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:grid-rows-1"
          : "flex h-13",
      )}
    >
      <Link
        to="/"
        search={linkSearch}
        title="Revue du mois"
        className="flex items-center gap-2.5 justify-self-start hover:opacity-60"
      >
        <div className="bg-primary size-2.5 rounded-xs" />
        <span className="text-body hidden font-semibold tracking-[-0.02em] sm:inline">
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

      {isRevue && (
        <div className="col-span-2 row-start-2 flex min-w-0 justify-center md:col-span-1 md:col-start-2 md:row-start-1">
          <PeriodPicker />
        </div>
      )}

      <div
        className={cn(
          "ml-auto flex items-center gap-3",
          isRevue && "col-start-2 row-start-1 md:col-start-3",
        )}
      >
        {isRevue && <BankPicker />}
        <SettingsMenu page={title} />
      </div>
    </header>
  );
}

function SettingsMenu({ page }: { page?: string }) {
  const navigate = useNavigate();
  const { cents } = useFormat();

  // Reload to discard loader data belonging to the signed-out user.
  const signOut = async () => {
    await authClient.signOut();
    await navigate({ to: "/login", reloadDocument: true });
  };

  return (
    <DropdownMenu>
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

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel>Affichage</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={cents} onCheckedChange={setCents}>
            Centimes
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>

        <SpacePicker />

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => void signOut()}>
          <LogOutIcon />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Switching spaces requires a document reload: organization scope lives in the
// session, so unchanged URLs would retain the previous space's loader data.
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
