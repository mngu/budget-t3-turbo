import {
  expoClient,
  getSetCookie,
  storageAdapter,
} from "@better-auth/expo/client";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

function apiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  // In development the API runs next to Metro, on the web app's port.
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (!host) throw new Error("EXPO_PUBLIC_API_URL manquant.");
  return `http://${host}:3000`;
}

export const API_URL = apiUrl();

const STORAGE_PREFIX = "jar";

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: "jar",
      storagePrefix: STORAGE_PREFIX,
      storage: SecureStore,
    }),
    magicLinkClient(),
  ],
});

// A magic link verifies in the browser, so the session reaches the app as the
// `cookie` parameter of the deep link rather than through the client's fetch.
export async function storeSessionCookie(setCookie: string) {
  const storage = storageAdapter(SecureStore);
  const key = `${STORAGE_PREFIX}_cookie`;
  const previous = (await storage.getItemAsync(key)) ?? undefined;
  await storage.setItemAsync(key, getSetCookie(setCookie, previous));
  authClient.$store.notify("$sessionSignal");
}
