import { describe, expect, it, vi } from "vitest";

import type { SQL } from "@budget/db";
import { PgDialect } from "@budget/db";
import { transactionsSearchSchema } from "@budget/shared";

import { filterTransactions, transactionsFilterQuery } from "./queries";

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

// Le périmètre des agrégats de la revue. Il ne passe pas par
// `transactionsFilterQuery` — c'est du SQL brut, sur des tables aliasées — et
// porte donc ses deux conditions à la main. C'est exactement le défaut que ce
// test verrouille : elles ont manqué à la première écriture, et rien à l'écran
// ne les réclame (un agrégat sans elles affiche des chiffres, juste faux).
describe("filterTransactions — périmètre des agrégats", () => {
  it("écarte les virements internes dont les deux jambes sont dans le périmètre", () => {
    const rendered = render(filterTransactions("org_1", search));
    expect(rendered).toContain("NOT EXISTS");
    expect(rendered).toContain("tw.id = t.transfer_pair_id");
  });

  it("applique le filtre de comptes à la transaction *et* à sa jumelle", () => {
    const rendered = render(
      filterTransactions("org_1", { ...search, bank: ["Revolut"] }),
    );
    expect(rendered).toContain("coalesce(ba.display_name, ba.bank_name)");
    // Sans elle, une paire dont une seule jambe est affichée serait neutralisée
    // et le solde cesserait d'égaler la variation des comptes affichés.
    expect(rendered).toContain("coalesce(twa.display_name, twa.bank_name)");
  });

  it("ne pose aucun filtre de comptes quand tous sont affichés", () => {
    expect(render(filterTransactions("org_1", search))).not.toContain(
      "display_name, ba.bank_name) in",
    );
  });
});
