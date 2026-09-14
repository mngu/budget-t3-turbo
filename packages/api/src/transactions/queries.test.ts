import type { SQL } from "@budget/db";

import { describe, expect, it, vi } from "vitest";

import { PgDialect } from "@budget/db";

import { filterTransactions } from "./queries";
import { transactionsSearchSchema } from "./schemas";

// Le vrai client exige POSTGRES_URL au chargement. `vi.mock` est hissé au-dessus
// des imports : l'import statique de `./queries` reçoit donc bien le double —
// pas besoin du `await import()` de internal-transfers.test.ts, dont la forme
// venait d'un besoin que ce fichier n'a pas.
vi.mock("@budget/db/client", () => ({ db: {} }));

const render = (where: SQL<unknown> | undefined) => {
  // Le filtre pose toujours au moins la condition d'espace : `undefined` serait
  // déjà un échec, et le test suivant lirait une chaîne vide sans rien voir.
  if (!where) throw new Error("filtre vide");
  return new PgDialect().sqlToQuery(where).sql;
};

const search = transactionsSearchSchema.parse({});

// Le périmètre des agrégats de la revue, en SQL brut sur des tables aliasées :
// il porte ses conditions à la main. C'est exactement le défaut que ce test
// verrouille : le filtre de comptes a manqué à la première écriture, et rien à
// l'écran ne le réclame (un agrégat sans lui affiche des chiffres, juste faux).
describe("filterTransactions — périmètre des agrégats", () => {
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

  // La garde qui compte : le défaut écarte les exclues, pour qu'un agrégat
  // écrit demain les écarte sans y penser. Seuls le relevé et les pastilles
  // de comptes redemandent explicitement à les voir.
  it("écarte les lignes exclues à la main", () => {
    expect(render(filterTransactions("org_1", search))).toContain("excluded");
  });

  it("les garde sur demande explicite", () => {
    expect(
      render(filterTransactions("org_1", search, { includeExcluded: true })),
    ).not.toContain("excluded");
  });

  // `direction && sql\`…\`` glissait `undefined` dans le gabarit : le sens est
  // optionnel, seul le loader de la revue le précise aujourd'hui.
  it("n'exige pas de sens", () => {
    expect(render(filterTransactions("org_1", search))).not.toContain(
      "direction",
    );
  });
});
