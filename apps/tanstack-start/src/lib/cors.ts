import { env } from "~/env";

/**
 * En dev, l'app Expo tourne en web sur un port Metro variable (8081, 3001…) —
 * origine différente du serveur API (port 3000) donc soumise au CORS du
 * navigateur. En prod, l'app web tanstack-start sert son API en same-origin :
 * aucune origine cross-site n'est autorisée.
 */
function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin || env.NODE_ENV === "production") return false;
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

export function withCors(request: Request, response: Response): Response {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) return response;

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.append("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function corsPreflight(request: Request): Response {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) return new Response(null, { status: 403 });

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        request.headers.get("access-control-request-headers") ??
        "content-type, cookie",
      Vary: "Origin",
    },
  });
}
