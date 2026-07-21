import { reactStartCookies } from "better-auth/react-start";

import { initAuth } from "@budget/auth";

import { env } from "~/env";
import { getBaseUrl } from "~/lib/url";

export const auth = initAuth({
  baseUrl: getBaseUrl(),
  secret: env.AUTH_SECRET,

  extraPlugins: [reactStartCookies()],
});
