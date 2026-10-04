import { storeSessionCookie } from "~/lib/auth";

// Magic links come back with the session cookie in the query. It is stored here,
// before routing: a screen's own URL listener subscribes too late on Android,
// where the link event fires before the screen mounts, and router params decode
// the cookie a second time, which can corrupt its signature.
export async function redirectSystemPath({ path }: { path: string }) {
  try {
    const cookie = new URL(path, "jar://").searchParams.get("cookie");
    if (cookie) await storeSessionCookie(cookie);
  } catch {
    // Throwing here crashes the app; an unreadable link just lands on its route.
  }
  return path;
}
