import { describe, expect, it } from "vitest";

import type { SimilarTxn } from "./similar";
import {
  buildCategorizationOutputSchema,
  partitionResults,
  resolveShortcut,
} from "./results";

const CATEGORY_NAMES = ["Alimentation", "Transport"];

const similarTxn = (overrides: Partial<SimilarTxn> = {}): SimilarTxn => ({
  id: 1,
  description: "CARTE 05/07 CARREFOUR CITY",
  counterparty: "Carrefour",
  amount: "38.50",
  direction: "debit",
  categoryName: "Alimentation",
  categorySource: "manual",
  ...overrides,
});

describe("buildCategorizationOutputSchema", () => {
  it("valide la forme (id + categorie) sans imposer l'énumération des catégories connues", () => {
    // Le filtrage des catégories inconnues (ex. si le LLM invente ou répète
    // un nom de catégorie qui n'existe plus après un remplacement) est
    // délégué à partitionResults, pas au schéma — un z.enum() ici ferait
    // planter le parsing structured-output de tout le lot au lieu d'ignorer
    // juste la transaction concernée (voir partitionResults ci-dessous).
    const schema = buildCategorizationOutputSchema();
    expect(
      schema.safeParse({ resultats: [{ id: 1, categorie: "Alimentation" }] })
        .success,
    ).toBe(true);
    expect(
      schema.safeParse({ resultats: [{ id: 1, categorie: "Cryptomonnaie" }] })
        .success,
    ).toBe(true);
    expect(
      schema.safeParse({ resultats: [{ id: "1", categorie: "Alimentation" }] })
        .success,
    ).toBe(false);
  });

  it("accepte categorie: null (aucune catégorie ne convient)", () => {
    expect(
      buildCategorizationOutputSchema().safeParse({
        resultats: [{ id: 1, categorie: null }],
      }).success,
    ).toBe(true);
  });
});

describe("resolveShortcut", () => {
  it("court-circuite quand 2 similaires partagent contrepartie et catégorie", () => {
    expect(
      resolveShortcut([similarTxn(), similarTxn({ id: 2 })], "Carrefour"),
    ).toBe("Alimentation");
  });

  it("ne court-circuite pas sur une seule occurrence", () => {
    expect(resolveShortcut([similarTxn()], "Carrefour")).toBeNull();
  });

  it("ignore les similaires sans contrepartie", () => {
    expect(
      resolveShortcut(
        [
          similarTxn({ counterparty: null }),
          similarTxn({ id: 2, counterparty: null }),
        ],
        "Carrefour",
      ),
    ).toBeNull();
  });

  // La liste fusionnée mélange tous les tiers de findSimilar : deux candidats
  // remontés par trigramme peuvent partager une contrepartie entre eux sans
  // avoir le moindre rapport avec la transaction à classer.
  it("ignore les similaires dont la contrepartie n'est pas celle de la transaction", () => {
    expect(
      resolveShortcut(
        [
          similarTxn({ counterparty: "Monoprix" }),
          similarTxn({ id: 2, counterparty: "Monoprix" }),
        ],
        "Carrefour",
      ),
    ).toBeNull();
  });

  it("ne court-circuite jamais une transaction sans contrepartie", () => {
    expect(
      resolveShortcut([similarTxn(), similarTxn({ id: 2 })], null),
    ).toBeNull();
  });

  it("exige que les similaires s'accordent sur la catégorie", () => {
    expect(
      resolveShortcut(
        [similarTxn(), similarTxn({ id: 2, categoryName: "Transport" })],
        "Carrefour",
      ),
    ).toBeNull();
  });
});

describe("partitionResults", () => {
  it("sépare les catégorisations valides, les refus assumés et les réponses aberrantes", () => {
    const { valid, declined, rejected } = partitionResults(
      [
        { id: 1, categorie: "Alimentation" },
        { id: 2, categorie: null }, // aucune catégorie ne convient → assumé
        { id: 3, categorie: "Cryptomonnaie" }, // catégorie inventée → aberrant
        { id: 99, categorie: "Transport" }, // id hors lot → aberrant
      ],
      new Set([1, 2, 3]),
      CATEGORY_NAMES,
    );
    expect(valid).toEqual([{ id: 1, categorie: "Alimentation" }]);
    expect(declined).toEqual([2]);
    expect(rejected).toEqual([
      { id: 3, categorie: "Cryptomonnaie" },
      { id: 99, categorie: "Transport" },
    ]);
  });
});
