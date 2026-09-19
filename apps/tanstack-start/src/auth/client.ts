import {
  magicLinkClient,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Password methods remain in the client types, but the server only supports magic links.
export const authClient = createAuthClient({
  plugins: [magicLinkClient(), organizationClient()],
});
