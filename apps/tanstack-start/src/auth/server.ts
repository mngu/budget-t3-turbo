import { reactStartCookies } from "better-auth/react-start";

import { initAuth } from "@budget/auth";

import { env } from "~/env";
import { getBaseUrl } from "~/lib/url";

export const auth = initAuth({
  baseUrl: getBaseUrl(),
  secret: env.AUTH_SECRET,

  // Autorise l'app Expo en mode web (Metro, port variable) à appeler l'API
  // d'auth en local — jamais en production, où seule l'origine du site compte.
  trustedOrigins:
    env.NODE_ENV === "production" ? undefined : ["http://localhost:*"],

  extraPlugins: [reactStartCookies()],
});
