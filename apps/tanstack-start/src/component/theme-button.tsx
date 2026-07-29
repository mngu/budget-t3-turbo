"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { useTheme } from "@budget/ui/theme";

// Gabarit 26 px des rangées d'icônes d'en-tête (revue et réglages). Celui du
// kit est dimensionné pour un Button `size="icon"`, 10 px plus haut, et cassait
// l'alignement de la rangée.
export const HEADER_ICON_BUTTON =
  "border-border text-muted-foreground hover:bg-accent hover:text-foreground flex size-[26px] items-center justify-center rounded-[7px] border disabled:opacity-50";

// Reprend le ThemeToggle de @budget/ui (même cycle auto → clair → sombre, même
// pilotage par les classes posées sur <html>) à ce gabarit.
export function ThemeButton() {
  const { toggleMode } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label="Basculer le thème"
      title="Basculer le thème"
      className={HEADER_ICON_BUTTON}
    >
      <SunIcon className="auto:hidden size-3.5 dark:hidden" />
      <MoonIcon className="not-auto:dark:block hidden size-3.5" />
      <MonitorIcon className="auto:block hidden size-3.5" />
    </button>
  );
}
