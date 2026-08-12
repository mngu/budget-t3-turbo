import type { Config } from "drizzle-kit";

if (!process.env.POSTGRES_URL) {
  throw new Error("Missing POSTGRES_URL");
}

const nonPoolingUrl = process.env.POSTGRES_URL.replace(":6543", ":5432");

export default {
  schema: "./src/schema.ts",
  // Migrations versionnées (`db:generate` puis `db:migrate`), et non `push` :
  // le déploiement applique le même SQL que celui relu ici, sans TTY ni
  // comparaison de schéma sur la base de prod.
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: nonPoolingUrl },
  casing: "snake_case",
} satisfies Config;
