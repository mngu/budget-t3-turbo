"use client";

import { Link } from "@tanstack/react-router";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LandmarkIcon,
  SlidersHorizontalIcon,
  TagsIcon,
} from "lucide-react";

import { cn } from "@budget/ui";

import { HEADER_ICON_BUTTON, ThemeButton } from "~/component/theme-button";

// En-tête des écrans de réglages. `/categories` et `/banques` sont hors du
// layout `_revue` (leur search n'est pas `transactionsSearchSchema`, l'en-tête
// de la revue y casserait) : ils ont donc leur propre barre, qui reprend la
// marque et la rangée d'icônes sans les filtres de période.
export function SettingsHeader({
  section,
}: {
  section: "categories" | "banques";
}) {
  return (
    <header className="bg-card border-border flex h-[52px] flex-none items-center gap-3.5 border-b px-5">
      <div className="flex items-center gap-2.5">
        <div className="bg-primary size-2.5 rounded-[2px]" />
        <span className="text-[13.5px] font-semibold tracking-[-0.02em]">
          Budget
        </span>
      </div>

      <span className="bg-border h-5 w-px" />

      <Link
        to="/"
        search={{ page: 1, sort: "date", order: "desc" }}
        className="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs"
      >
        <ChevronLeftIcon className="size-3" />
        Revue du mois
      </Link>

      <div className="text-muted-foreground bg-sunken inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs">
        <SlidersHorizontalIcon className="text-subtle size-3.5" />
        Réglages
        <ChevronRightIcon className="text-subtle size-3" />
        <span className="text-foreground font-medium">
          {section === "categories" ? "Catégories" : "Banques"}
        </span>
      </div>

      <span className="flex-1" />

      <div className="flex items-center gap-1">
        <SectionLink
          to="/categories"
          label="Catégories"
          active={section === "categories"}
        >
          <TagsIcon className="size-3.5" />
        </SectionLink>
        <SectionLink
          to="/banques"
          label="Banques"
          active={section === "banques"}
        >
          <LandmarkIcon className="size-3.5" />
        </SectionLink>
        <ThemeButton />
      </div>
    </header>
  );
}

function SectionLink({
  to,
  label,
  active,
  children,
}: {
  to: "/categories" | "/banques";
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        HEADER_ICON_BUTTON,
        active && "bg-accent-soft text-primary border-transparent",
      )}
    >
      {children}
    </Link>
  );
}
