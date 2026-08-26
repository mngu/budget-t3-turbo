import type { ThemeMode } from "@budget/ui/theme";

import { Monitor, Moon, Sun } from "lucide-react";

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@budget/ui/dropdown-menu";
import { useTheme } from "@budget/ui/theme";

const THEME_OPTIONS: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: "auto", label: "Système", Icon: Monitor },
  { mode: "light", label: "Clair", Icon: Sun },
  { mode: "dark", label: "Sombre", Icon: Moon },
];

export function ThemePicker() {
  const { themeMode, setTheme } = useTheme();

  return (
    <DropdownMenuRadioGroup
      className="grid grid-cols-3 gap-0.5"
      value={themeMode}
      onValueChange={(mode) => setTheme(mode as ThemeMode)}
    >
      {THEME_OPTIONS.map(({ mode, label, Icon }) => (
        <DropdownMenuRadioItem key={mode} value={mode} variant="tile">
          <Icon className="size-4" />
          {label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}
