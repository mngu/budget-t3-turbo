import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";

import { getBaseUrl } from "./base-url";

/**
 * expo-secure-store n'a pas d'implémentation web. Le plugin expo de
 * better-auth ignore le storage sur web (le navigateur gère les cookies
 * lui-même) partout sauf dans `getCookie()`, qui le lit inconditionnellement —
 * on fournit donc un adaptateur localStorage pour éviter le crash.
 */
const storage =
  Platform.OS === "web"
    ? {
        getItem: (key: string) => globalThis.localStorage.getItem(key),
        setItem: (key: string, value: string) =>
          globalThis.localStorage.setItem(key, value),
      }
    : SecureStore;

export const authClient = createAuthClient({
  baseURL: getBaseUrl(),
  // En dev web, l'app (port Metro) et l'API (port 3000) sont cross-origin :
  // sans credentials "include", le navigateur n'envoie pas les cookies.
  fetchOptions: Platform.OS === "web" ? { credentials: "include" } : undefined,
  plugins: [
    expoClient({
      scheme: "expo",
      storagePrefix: "expo",
      storage,
    }),
  ],
});
