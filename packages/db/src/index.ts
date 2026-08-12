export * from "drizzle-orm/sql";
// `PgDialect` sert à rendre un fragment SQL en texte sans connexion — les tests
// de `@budget/api` n'ont pas de POSTGRES_URL et mockent `@budget/db/client`.
export { alias, PgDialect } from "drizzle-orm/pg-core";
