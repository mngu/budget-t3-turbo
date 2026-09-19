import { useRouter } from "@tanstack/react-router";

import { toast } from "@budget/ui/toast";

/** Returns null on failure; resolves only after loaders refresh so pending UI stays visible. */
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
