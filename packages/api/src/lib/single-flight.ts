// Verrou en mémoire process : empêche deux exécutions concurrentes d'une même
// opération longue (elles écrivent toutes dans `transactions`). Suffisant pour
// ce MVP mono-utilisateur mono-process — aucune coordination entre instances.
const inFlight = new Set<string>();

export async function withSingleFlight<T>(
  key: string,
  busyMessage: string,
  run: () => Promise<T>,
): Promise<T> {
  if (inFlight.has(key)) throw new Error(busyMessage);
  inFlight.add(key);
  try {
    return await run();
  } finally {
    inFlight.delete(key);
  }
}
