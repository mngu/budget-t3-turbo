import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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

import { organization, user } from "./auth-schema";

const organizationId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

// Installation-wide Enable Banking credentials, not organization-owned.
export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  applicationId: text("application_id").notNull(),
  privateKeyPem: text("private_key_pem").notNull(),
  redirectUrl: text("redirect_url").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const bankConnections = pgTable("bank_connections", {
  id: serial("id").primaryKey(),
  organizationId: organizationId(),
  // Renewal requires the person who originally authenticated with the bank.
  createdByUserId: text("created_by_user_id").references(() => user.id),
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

export const authRequests = pgTable("auth_requests", {
  state: text("state").primaryKey(),
  // The callback uses this scope, since the session's active space may change during authorization.
  organizationId: organizationId(),
  createdByUserId: text("created_by_user_id").references(() => user.id),
  aspspName: text("aspsp_name").notNull(),
  aspspCountry: text("aspsp_country").notNull(),
  connectionId: integer("connection_id").references(() => bankConnections.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: serial("id").primaryKey(),
    // Transactions inherit organization ownership through this account.
    organizationId: organizationId(),
    uid: text("uid").notNull(),
    bankName: text("bank_name").notNull(),
    // IBAN preserves account identity when Enable Banking changes UIDs on renewal.
    iban: text("iban"),
    // Null for legacy accounts without a bank connection.
    connectionId: integer("connection_id").references(() => bankConnections.id),
    displayName: text("display_name"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // The same joint account UID may exist independently in multiple spaces.
    uniqueIndex("bank_accounts_org_uid_uq").on(t.organizationId, t.uid),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    color: text("color"),
    // Parent-only Lucide name from CATEGORY_ICON_NAMES; children inherit it.
    icon: text("icon"),
    parentId: integer("parent_id").references((): AnyPgColumn => categories.id),
    budgetAmount: numeric("budget_amount", { precision: 12, scale: 2 }),
    // Detailed budgets are derived from children; the CHECK forbids a competing parent amount.
    budgetDetailed: boolean("budget_detailed").notNull().default(false),
  },
  (t) => [
    check(
      "categories_detailed_no_amount",
      sql`NOT ${t.budgetDetailed} OR ${t.budgetAmount} IS NULL`,
    ),
    uniqueIndex("categories_org_name_uq").on(t.organizationId, t.name),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => bankAccounts.id),
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
    categorySource: text("category_source", {
      enum: ["llm", "manual", "auto"],
    }),
    // User-controlled exclusion from aggregates; the transaction remains in the statement.
    excluded: boolean("excluded").notNull().default(false),
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
  ],
);

export type NewTransaction = typeof transactions.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;

export * from "./auth-schema";
