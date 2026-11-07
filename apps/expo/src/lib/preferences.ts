import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";
import { Uniwind } from "uniwind";

export type ThemeMode = "system" | "light" | "dark";

// SecureStore is the only persistent store installed, and its synchronous read
// applies the theme before the first frame. Two short strings do not justify another.
function preference<T extends string>(key: string, fallback: T) {
  const storageKey = `jar_${key}`;
  let value = (SecureStore.getItem(storageKey) as T | null) ?? fallback;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: T) => {
      value = next;
      SecureStore.setItem(storageKey, next);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

const theme = preference<ThemeMode>("theme", "system");
Uniwind.setTheme(theme.get());

export const useThemeMode = () =>
  useSyncExternalStore(theme.subscribe, theme.get);

export function setThemeMode(mode: ThemeMode) {
  theme.set(mode);
  Uniwind.setTheme(mode);
}

const cents = preference<"on" | "off">("cents", "on");

export const useCents = () =>
  useSyncExternalStore(cents.subscribe, cents.get) === "on";

export const setCents = (on: boolean) => cents.set(on ? "on" : "off");
