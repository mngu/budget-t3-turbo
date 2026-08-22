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

import { organization, user } from "./auth-schema";

// L'« espace » : un utilisateur seul ou un foyer. Tout ce qui suit lui
// appartient, sauf `app_settings` — voir le commentaire de cette table.
// Colonne plutôt que schéma Postgres par espace : le cloisonnement se fait dans
// le `WHERE`, au point de passage unique de chaque domaine.
const organizationId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

// Configuration Enable Banking (ligne unique, id=1) — alimentée par l'onboarding.
// **Hors espace, volontairement** : c'est l'application Enable Banking de
// l'installation (une par déploiement), pas une par foyer. Sa mutation est
// réservée aux admins (`adminProcedure`, packages/api/src/trpc.ts).
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
  organizationId: organizationId(),
  // Le consentement PSD2 appartient à la personne qui s'est authentifiée à la
  // banque : sur un espace partagé, c'est elle — et elle seule — qui pourra le
  // renouveler dans ~180 jours.
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

// Flux d'autorisation en cours (anti-CSRF via state, survit à un redémarrage).
// connectionId renseigné = renouvellement d'une connexion existante.
export const authRequests = pgTable("auth_requests", {
  state: text("state").primaryKey(),
  // C'est cette ligne qui décide dans quel espace atterrit la connexion créée
  // au retour de la banque : le callback OAuth n'a pas d'autre contexte que le
  // `state`, et l'espace actif de la session peut avoir changé entre-temps.
  organizationId: organizationId(),
  createdByUserId: text("created_by_user_id").references(() => user.id),
  aspspName: text("aspsp_name").notNull(),
  aspspCountry: text("aspsp_country").notNull(),
  connectionId: integer("connection_id").references(() => bankConnections.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Compte bancaire suivi. `bank_accounts` et non `accounts` : better-auth a déjà
// une table `account` (les identifiants de connexion d'un utilisateur), et les
// deux se ressemblaient assez pour qu'on lise l'une en croyant l'autre.
export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: serial("id").primaryKey(),
    // C'est ce compte qui porte l'espace de ses transactions : elles n'ont pas
    // de colonne à elles, leur espace se lit par cette jointure. Une seule
    // vérité, qui ne peut pas diverger du compte.
    organizationId: organizationId(),
    uid: text("uid").notNull(),
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
  },
  (t) => [
    // Unicité *par espace* et non globale : deux membres d'un couple qui
    // connectent chacun le même compte joint dans leur propre espace peuvent
    // se voir attribuer le même uid par Enable Banking — une unicité globale
    // ferait échouer la connexion du second sans rien expliquer.
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
    // Nom Lucide en kebab-case, membre de CATEGORY_ICON_NAMES (@budget/shared).
    // Comme `color`, ne concerne que les catégories parentes : une
    // sous-catégorie se lit dans la famille de son parent, sans identité propre.
    icon: text("icon"),
    // NULL = catégorie parente ; sinon sous-catégorie. Les deux niveaux sont
    // assignables à une transaction ; choisir un parent dans le filtre de liste
    // inclut aussi ses sous-catégories (voir transactionsFilterQuery).
    parentId: integer("parent_id").references((): AnyPgColumn => categories.id),
    budgetAmount: numeric("budget_amount", { precision: 12, scale: 2 }),
  },
  (t) => [
    // Le nom est unique *dans l'espace*, plus sur toute la table. Deux espaces
    // ont chacun leur « Alimentation » sans se voir. Tout ce qui résout une
    // catégorie par son nom (`upsertCategory`, `setTransactionCategory`, le
    // filtre `category` de l'URL) doit donc porter l'espace, sans quoi la
    // résolution devient ambiguë.
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
    // « Cette ligne ne me concerne pas » : posé à la main, jamais par un
    // traitement. Voisin des virements internes dans son effet (la ligne sort
    // des agrégats et reste dans le relevé), mais **inconditionnel** : un
    // virement interne dépend des comptes affichés, une exclusion non.
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
    index("transactions_transfer_pair_id_idx").on(t.transferPairId),
  ],
);

export type NewBankAccount = typeof bankAccounts.$inferInsert;
export type NewTransaction = typeof transactions.$inferInsert;
export type NewCategory = typeof categories.$inferInsert;
export type AppSettingsRow = typeof appSettings.$inferSelect;
export type BankConnection = typeof bankConnections.$inferSelect;
export type AuthRequest = typeof authRequests.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;

export * from "./auth-schema";
