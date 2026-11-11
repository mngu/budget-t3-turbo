import { describe, expect, it, vi } from "vitest";

import { db } from "@budget/db/client";

import { refreshBalances } from "./balances";

// Explicit factory avoids loading the database client and requiring POSTGRES_URL.
vi.mock("@budget/db/client", () => ({ db: { execute: vi.fn() } }));

describe("refreshBalances", () => {
  it("n'appelle pas la banque sans IP PSU, pour ne pas consommer le quota non assisté", async () => {
    expect(await refreshBalances("org-1", {})).toBe(false);
    expect(db.execute).not.toHaveBeenCalled();
  });
});
