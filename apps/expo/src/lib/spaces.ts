import { authClient } from "./auth";
import { queryClient } from "./trpc";

// Query keys carry no space or user: what the cache holds belongs to the space left.
export async function switchSpace(organizationId: string) {
  await authClient.organization.setActive({ organizationId });
  queryClient.clear();
}

// Leaving or deleting the active space moves the session elsewhere on the
// server; reload it so the app follows, as the web reloads its document.
export function followActiveSpace() {
  authClient.$store.notify("$sessionSignal");
  queryClient.clear();
}
