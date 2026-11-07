import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

import { createTRPCRouter, publicProcedure } from "./trpc";

// Explicit factory avoids loading the database client and requiring POSTGRES_URL.
vi.mock("@budget/db/client", () => ({ db: {} }));

const router = createTRPCRouter({
  invite: publicProcedure
    .input(z.object({ email: z.email({ error: "Adresse email invalide." }) }))
    .mutation(() => null),
});

describe("errorFormatter", () => {
  // The apps toast the message as is: the issue list would reach the user as JSON.
  it("renvoie le message de la première erreur de validation", async () => {
    const response = await fetchRequestHandler({
      endpoint: "/trpc",
      router,
      createContext: () => ({ session: null, headers: new Headers() }),
      req: new Request("http://localhost/trpc/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: { email: "pas-une-adresse" } }),
      }),
    });
    const body = (await response.json()) as {
      error: { json: { message: string } };
    };
    expect(body.error.json.message).toBe("Adresse email invalide.");
  });
});
