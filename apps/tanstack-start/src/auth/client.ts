import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// `organizationClient` donne l'espace courant et la bascule d'un espace à
// l'autre (`setActive`). L'espace vit dans la session, pas dans l'URL : c'est
// pour ça qu'aucune route n'a de segment d'espace.
export const authClient = createAuthClient({
  plugins: [organizationClient()],
});
