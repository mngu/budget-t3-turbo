import { describe, expect, it, vi } from "vitest";

import type { SQL } from "@budget/db";
import { PgDialect } from "@budget/db";
import { transactionsSearchSchema } from "@budget/shared";

import { transactionsFilterQuery } from "./queries";

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

// La garde qui compte : le défaut écarte les transactions exclues à la main,
// pour qu'un agrégat écrit demain les écarte sans y penser. Seuls le relevé et
// les pastilles de comptes redemandent explicitement à les voir.
describe("transactionsFilterQuery — exclusions manuelles", () => {
  it("les écarte par défaut", () => {
    expect(render(transactionsFilterQuery("org_1", search))).toContain(
      '"excluded" = ',
    );
  });

  it("les garde sur demande explicite", () => {
    expect(
      render(
        transactionsFilterQuery("org_1", search, { includeExcluded: true }),
      ),
    ).not.toContain('"excluded"');
  });
});
