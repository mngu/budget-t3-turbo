import type { SQL } from "@budget/db";

import { describe, expect, it, vi } from "vitest";

import { PgDialect } from "@budget/db";

import { transactionsSearchSchema } from "../transactions/schemas";
import { filterTransactions } from "./queries";

vi.mock("@budget/db/client", () => ({ db: {} }));

const render = (where: SQL<unknown> | undefined) => {
  if (!where) throw new Error("filtre vide");
  return new PgDialect().sqlToQuery(where).sql;
};

const search = transactionsSearchSchema.parse({});

// Le filtre de comptes a manqué à la première écriture, et rien à l'écran ne le
// réclame — la revue affichait des chiffres, juste faux : ceux de tous les
// comptes sous une sélection.
describe("filterTransactions (catégories) — périmètre", () => {
  it("écarte les lignes exclues à la main", () => {
    expect(render(filterTransactions("org_1", search))).toContain("excluded");
  });

  it("applique le filtre de comptes", () => {
    expect(
      render(filterTransactions("org_1", { ...search, bank: ["Revolut"] })),
    ).toContain("coalesce(ba.display_name, ba.bank_name)");
  });

  it("ne pose aucun filtre de comptes quand tous sont affichés", () => {
    expect(render(filterTransactions("org_1", search))).not.toContain(
      "display_name, ba.bank_name) in",
    );
  });

  // `direction && sql\`…\`` glissait `undefined` dans le gabarit : le sens est
  // optionnel, seul le loader de la revue le précise aujourd'hui.
  it("n'exige pas de sens", () => {
    expect(render(filterTransactions("org_1", search))).not.toContain(
      "direction",
    );
  });
});
