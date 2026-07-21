import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error(
    "POSTGRES_URL manquante — copiez .env.example vers .env (voir docker-compose.yml).",
  );
}

export const db = drizzle({
  client: new Pool({ connectionString }),
  schema,
  casing: "snake_case",
});
