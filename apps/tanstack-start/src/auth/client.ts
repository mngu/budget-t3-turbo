import { magicLinkClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// `organizationClient` donne l'espace courant et la bascule d'un espace à
// l'autre (`setActive`). L'espace vit dans la session, pas dans l'URL : c'est
// pour ça qu'aucune route n'a de segment d'espace.
//
// `magicLinkClient` expose `signIn.magicLink`, la seule voie de connexion.
// Attention : ce client n'est pas typé d'après la config serveur — `signIn.email`
// et `signUp.email` restent visibles dans son type alors que le serveur ne les
// sert plus. Un appel oublié compile et échoue à l'exécution.
export const authClient = createAuthClient({
  plugins: [magicLinkClient(), organizationClient()],
});
