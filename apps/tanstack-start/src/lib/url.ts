import { env } from "~/env";

export function getBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  // Déploiement autonome (VPS) : prioritaire sur les variables Vercel, qui n'y
  // sont pas posées.
  if (env.SITE_URL) {
    return env.SITE_URL;
  }
  if (env.VERCEL_ENV === "production") {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (env.VERCEL_ENV === "preview") {
    return `https://${env.VERCEL_URL}`;
  }

  // Doit rester aligné sur server.port de vite.config.ts (callback Enable Banking).
  // eslint-disable-next-line no-restricted-properties
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
