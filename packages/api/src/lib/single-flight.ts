// Process-local locking only; multiple server instances would need shared coordination.
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
