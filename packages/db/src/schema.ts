import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Configuration Enable Banking (ligne unique, id=1) — alimentée par l'onboarding.
export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  applicationId: text("application_id").notNull(),
  privateKeyPem: text("private_key_pem").notNull(),
  redirectUrl: text("redirect_url").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Une session PSD2 par banque — remplace data/session-*.json.
export const bankConnections = pgTable("bank_connections", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  aspspName: text("aspsp_name").notNull(),
  aspspCountry: text("aspsp_country").notNull(),
  logoUrl: text("logo_url"),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  status: text("status", { enum: ["active", "expired", "revoked"] })
    .notNull()
    .default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Flux d'autorisation en cours (anti-CSRF via state, survit à un redémarrage).
// connectionId renseigné = renouvellement d'une connexion existante.
export const authRequests = pgTable("auth_requests", {
  state: text("state").primaryKey(),
  aspspName: text("aspsp_name").notNull(),
  aspspCountry: text("aspsp_country").notNull(),
  connectionId: integer("connection_id").references(() => bankConnections.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  bankName: text("bank_name").notNull(),
  // L'uid Enable Banking peut changer à la ré-authentification (~180 j) ;
  // l'IBAN sert de pivot de continuité le moment venu.
  iban: text("iban"),
  // Connexion Enable Banking d'origine (null pour les comptes historiques pré-wizard).
  connectionId: integer("connection_id").references(() => bankConnections.id),
  // Nom d'affichage choisi par l'utilisateur ; bank_name garde le nom ASPSP.
  displayName: text("display_name"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color"),
  // Nom Lucide en kebab-case, membre de CATEGORY_ICON_NAMES (@budget/shared).
  // Comme `color`, ne concerne que les catégories parentes : une
  // sous-catégorie se lit dans la famille de son parent, sans identité propre.
  icon: text("icon"),
  // NULL = catégorie parente ; sinon sous-catégorie. Les deux niveaux sont
  // assignables à une transaction ; choisir un parent dans le filtre de liste
  // inclut aussi ses sous-catégories (voir transactionsFilterQuery).
  parentId: integer("parent_id").references((): AnyPgColumn => categories.id),
});

// Budget mensuel d'une catégorie (onglet « Budgets » de /categories). Une ligne
// par catégorie budgétée, sans dimension de mois : un budget se reconduit tel
// quel chaque mois et le non consommé n'est pas reporté.
//
// `amount` nul avec `detailed` vrai est l'état normal d'une parente qui vient
// de passer en « Détaillé » : ce sont alors ses sous-catégories qui portent les
// montants, et la parente n'affiche que leur somme. Les montants des
// sous-catégories d'une parente repassée en « Global » sont conservés — ils ne
// comptent plus nulle part, mais un aller-retour ne les perd pas.
export const categoryBudgets = pgTable("category_budgets", {
  // Cascade plutôt qu'un nettoyage dans `removeCategory` : c'est la seule
  // manière que la ligne ne survive pas à une suppression faite ailleurs.
  categoryId: integer("category_id")
    .primaryKey()
    .references(() => categories.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  detailed: boolean("detailed").notNull().default(false),
});

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id),
    entryReference: text("entry_reference").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    direction: text("direction", { enum: ["debit", "credit"] }).notNull(),
    status: text("status", { enum: ["booked", "pending"] }).notNull(),
    bookingDate: date("booking_date").notNull(),
    valueDate: date("value_date"),
    description: text("description").notNull(),
    counterparty: text("counterparty"),
    bankCode: text("bank_code"),
    mcc: text("mcc"),
    categoryId: integer("category_id").references(() => categories.id),
    // 'manual' : corrigé par l'utilisateur — jamais écrasé.
    // 'auto'   : court-circuit déterministe (≥2 similaires même contrepartie).
    // 'llm'    : catégorisé par le LLM (few-shot ou générique).
    categorySource: text("category_source", {
      enum: ["llm", "manual", "auto"],
    }),
    // L'autre jambe d'un virement entre deux comptes suivis : les deux lignes
    // se pointent mutuellement. Une paire n'est neutralisée dans les agrégats
    // que si ses *deux* jambes sont dans les comptes sélectionnés — voir
    // `internalTransferOutOfScope` (transactions/queries.ts).
    transferPairId: integer("transfer_pair_id").references(
      (): AnyPgColumn => transactions.id,
    ),
    // Même contrat que `category_source` : 'manual' n'est jamais écrasé par la
    // détection. Un `transfer_pair_id` nul avec une source 'manual' est un
    // « ce n'est pas un virement interne » — la paire ne sera plus reformée.
    transferSource: text("transfer_source", { enum: ["auto", "manual"] }),
    raw: jsonb("raw").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("transactions_account_entry_ref_uq").on(
      t.accountId,
      t.entryReference,
    ),
    index("transactions_booking_date_idx").on(t.bookingDate),
    index("transactions_direction_idx").on(t.direction),
    index("transactions_status_idx").on(t.status),
    index("transactions_category_id_idx").on(t.categoryId),
    index("transactions_transfer_pair_id_idx").on(t.transferPairId),
  ],
);

export type NewAccount = typeof accounts.$inferInsert;
export type NewTransaction = typeof transactions.$inferInsert;
export type NewCategory = typeof categories.$inferInsert;
export type AppSettingsRow = typeof appSettings.$inferSelect;
export type BankConnection = typeof bankConnections.$inferSelect;
export type AuthRequest = typeof authRequests.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;

export * from "./auth-schema";
