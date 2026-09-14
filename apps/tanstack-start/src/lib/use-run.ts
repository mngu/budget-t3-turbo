import { useRouter } from "@tanstack/react-router";

import { toast } from "@budget/ui/toast";

/**
 * Le geste commun à toutes les mutations de l'écran : jouer la mutation,
 * recharger le loader, transformer l'échec en toast plutôt qu'en exception
 * remontée dans le rendu.
 *
 * Rend `null` en cas d'échec — c'est ce que testent les appelants qui ont un
 * message de succès à afficher. L'`invalidate` est **dans** l'await : un
 * appelant qui pose un état « en cours » autour de `run` le tient donc jusqu'à
 * ce que la liste rechargée soit à l'écran, et non jusqu'au seul retour du
 * serveur.
 */
export function useRun() {
  const router = useRouter();

  return async <T>(
    action: () => Promise<T>,
    fallbackMessage: string,
  ): Promise<T | null> => {
    try {
      const result = await action();
      await router.invalidate();
      return result;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : fallbackMessage);
      return null;
    }
  };
}
