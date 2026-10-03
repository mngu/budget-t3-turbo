"use client";

import type { ThemeMode } from "@budget/ui/theme";

import { Button, Dropdown, Header, Label } from "@heroui/react";
import { Link, useMatches, useNavigate } from "@tanstack/react-router";
import {
  LandmarkIcon,
  LogOutIcon,
  Monitor,
  Moon,
  SettingsIcon,
  Sun,
  TagsIcon,
  UsersIcon,
} from "lucide-react";

import { cn } from "@budget/ui";
import { useTheme } from "@budget/ui/theme";
import { authClient } from "~/auth/client";
import { BankPicker } from "~/component/bank-picker";
import { Logo } from "~/component/logo";
import { PeriodPicker } from "~/component/period-picker";
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
    to: "/settings/categories",
    title: "Catégories",
    Icon: TagsIcon,
  },
  {
    to: "/settings/banques",
    title: "Banques",
    Icon: LandmarkIcon,
  },
  {
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
        "bg-background relative z-30 flex h-13 flex-none items-center gap-x-2 px-4 transition-shadow duration-200 sm:gap-x-3.5 sm:px-5",
        // Centre the picker on the page once the side clusters have room to balance.
        isRevue && "md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
      )}
    >
      <Link
        to="/"
        search={linkSearch}
        title="Revue du mois"
        className="flex items-center gap-2.5 justify-self-start hover:opacity-60"
      >
        <Logo className="size-4" />
        <span className="text-body hidden font-semibold tracking-[-0.02em] sm:inline">
          Jar
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
        <div className="flex min-w-0 flex-1 justify-center">
          <PeriodPicker />
        </div>
      )}

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {isRevue && <BankPicker />}
        <SettingsMenu />
      </div>
    </header>
  );
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: "auto", label: "Système", Icon: Monitor },
  { mode: "light", label: "Clair", Icon: Sun },
  { mode: "dark", label: "Sombre", Icon: Moon },
];

function SettingsMenu() {
  const navigate = useNavigate();
  const { cents } = useFormat();
  const { themeMode, setTheme } = useTheme();
  const { data: spaces } = authClient.useListOrganizations();
  const { data: active } = authClient.useActiveOrganization();

  // Reload to discard loader data belonging to the signed-out user.
  const signOut = async () => {
    await authClient.signOut();
    await navigate({ to: "/login", reloadDocument: true });
  };

  // Switching spaces requires a document reload: organization scope lives in the
  // session, so unchanged URLs would retain the previous space's loader data.
  const selectSpace = async (organizationId: string) => {
    if (organizationId === active?.id) return;
    await authClient.organization.setActive({ organizationId });
    window.location.reload();
  };

  return (
    <Dropdown>
      <Button variant="ghost" size="sm" isIconOnly aria-label="Réglages">
        <SettingsIcon />
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label="Réglages">
          <Dropdown.Section>
            <Header>Réglages</Header>
            {SETTINGS_PAGES.map(({ to, title, Icon }) => (
              <Dropdown.Item key={to} textValue={title} href={to}>
                <Icon />
                <Label>{title}</Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Section>

          <Dropdown.Section
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[themeMode]}
            onSelectionChange={(keys) => {
              const [mode] = keys === "all" ? [] : keys;
              if (mode) setTheme(mode as ThemeMode);
            }}
          >
            <Header>Thème</Header>
            {THEME_OPTIONS.map(({ mode, label, Icon }) => (
              <Dropdown.Item key={mode} id={mode} textValue={label}>
                <Icon />
                <Label>{label}</Label>
                <Dropdown.ItemIndicator />
              </Dropdown.Item>
            ))}
          </Dropdown.Section>

          <Dropdown.Section
            selectionMode="multiple"
            selectedKeys={cents ? ["cents"] : []}
            onSelectionChange={(keys) =>
              setCents(keys === "all" || keys.has("cents"))
            }
          >
            <Header>Affichage</Header>
            <Dropdown.Item id="cents" textValue="Centimes">
              <Label>Centimes</Label>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
          </Dropdown.Section>

          {spaces && spaces.length > 1 ? (
            <Dropdown.Section
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={active ? [active.id] : []}
              onSelectionChange={(keys) => {
                const [id] = keys === "all" ? [] : keys;
                if (id) void selectSpace(String(id));
              }}
            >
              <Header>Espace</Header>
              {spaces.map((space) => (
                <Dropdown.Item
                  key={space.id}
                  id={space.id}
                  textValue={space.name}
                >
                  <Label>{space.name}</Label>
                  <Dropdown.ItemIndicator />
                </Dropdown.Item>
              ))}
            </Dropdown.Section>
          ) : null}

          <Dropdown.Section>
            <Dropdown.Item
              textValue="Se déconnecter"
              onAction={() => void signOut()}
            >
              <LogOutIcon />
              <Label>Se déconnecter</Label>
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
