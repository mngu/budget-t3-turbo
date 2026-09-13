import { useSyncExternalStore } from "react";

const formatCurrency = (maximumFractionDigits = 2, displaySign = false) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits,
    signDisplay: displaySign ? "exceptZero" : "never",
  });

const CENTS_KEY = "amount-cents";
const listeners = new Set<() => void>();

const readCents = () => {
  try {
    return localStorage.getItem(CENTS_KEY) !== "false";
  } catch {
    return true;
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function setCents(on: boolean) {
  try {
    localStorage.setItem(CENTS_KEY, String(on));
  } catch {
    // localStorage indisponible : le réglage ne survivra pas au rechargement.
  }
  listeners.forEach((listener) => listener());
}

export function useFormat() {
  const cents = useSyncExternalStore(subscribe, readCents, () => true);
  return {
    cents,
    euro: cents ? formatCurrency(2) : formatCurrency(0),
    signedEuro: cents ? formatCurrency(2, true) : formatCurrency(0, true),
  };
}
