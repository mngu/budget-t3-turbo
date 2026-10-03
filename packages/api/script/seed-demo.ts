// Rebuilds the « Démo » space with six months of realistic data, then prints a
// one-off sign-in link. Only demo-owned rows are touched; users and other spaces
// are never read or written.

import type { EbTransaction } from "../src/transactions/normalize";

import { randomUUID } from "node:crypto";

import { fakerFR as faker } from "@faker-js/faker";

import { and, eq, inArray, isNotNull } from "@budget/db";
import { db } from "@budget/db/client";
import {
  bankAccounts,
  categories,
  member,
  organization,
  transactions,
  user,
  verification,
} from "@budget/db/schema";
import { CATEGORY_COLOR_PALETTE } from "@budget/shared";

import { normalizeTransaction } from "../src/transactions/normalize";

const DEMO = {
  userId: "demo-user",
  organizationId: "demo-org",
  email: "demo@jar.test",
  name: "Camille Martin",
};
const MONTHS = 6;
// Empty .env assignments must fall back too.
const BASE_URL = process.env.SITE_URL || "http://localhost:3000";

// The production database is also named budget_t3 and is reachable through the
// deploy tunnel on 127.0.0.1:15432, so the name alone proves nothing.
const target = new URL(process.env.POSTGRES_URL ?? "");
if (
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  target.port !== "5436"
) {
  throw new Error(
    `Seed refusé : ${target.host} n'est pas la base Docker locale (localhost:5436).`,
  );
}

const color = (name: string) => {
  const found = CATEGORY_COLOR_PALETTE.find((c) => c.name === name);
  if (!found) throw new Error(`Couleur inconnue : ${name}`);
  return found.light;
};

interface CategorySeed {
  icon: string;
  color: string;
  budget?: number;
  // Child budgets make the parent "detailed"; the CHECK forbids a parent amount then.
  children: Record<string, number | null>;
}

// Covers the UI edge states: an over-budget family (Restauration), a detailed
// budget (Alimentation), a parent without children (Enfants) and a long name.
const CATEGORIES: Record<string, CategorySeed> = {
  Revenus: {
    icon: "receipt",
    color: color("Vert"),
    children: { Salaire: null, Remboursements: null },
  },
  Logement: {
    icon: "key-round",
    color: color("Ambre"),
    budget: 1400,
    children: {
      Loyer: null,
      Énergie: null,
      Internet: null,
      "Assurance habitation": null,
    },
  },
  Alimentation: {
    icon: "shopping-cart",
    color: color("Citron vert"),
    children: { Supermarché: 450, Boulangerie: 40, Marché: 80 },
  },
  Restauration: {
    icon: "utensils",
    color: color("Fuchsia"),
    budget: 150,
    children: { Restaurant: null, Café: null, Livraison: null },
  },
  Transport: {
    icon: "train-front",
    color: color("Bleu ciel"),
    budget: 120,
    children: { "Pass Navigo": null, VTC: null, Train: null },
  },
  Santé: {
    icon: "heart-pulse",
    color: color("Rouge"),
    children: { Pharmacie: null, Médecin: null, Mutuelle: null },
  },
  Loisirs: {
    icon: "ferris-wheel",
    color: color("Violet"),
    budget: 200,
    children: { "Cinéma & spectacles": null, Sport: null, Livres: null },
  },
  Abonnements: {
    icon: "tv",
    color: color("Turquoise"),
    budget: 60,
    children: { Streaming: null, Téléphone: null },
  },
  Enfants: { icon: "baby", color: color("Rose"), budget: 100, children: {} },
  Épargne: {
    icon: "piggy-bank",
    color: color("Cyan"),
    children: { "Livret A": null, "Assurance vie": null },
  },
  "Impôts & frais bancaires": {
    icon: "banknote",
    color: color("Pourpre"),
    children: { "Impôt sur le revenu": null, "Frais bancaires": null },
  },
  "Cadeaux & occasions spéciales en famille": {
    icon: "gift",
    color: color("Bleu"),
    children: {},
  },
};

const ACCOUNTS = {
  courant: { bankName: "Boursorama", displayName: "Compte courant" },
  joint: {
    bankName: "Crédit Agricole",
    displayName: "Compte joint Crédit Agricole Île-de-France",
  },
  revolut: { bankName: "Revolut", displayName: "Revolut" },
} as const;
type AccountKey = keyof typeof ACCOUNTS;

interface Draft {
  account: AccountKey;
  date: Date;
  amount: number;
  direction: "debit" | "credit";
  label: string;
  // Revolut exposes the merchant as creditor; French banks only put it in the label.
  party?: string;
  category: string | null;
  excluded?: boolean;
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
// The local calendar day: in UTC, the first hours of a month would still belong
// to the previous one and leave the new month empty.
const today = new Date(`${new Date().toLocaleDateString("sv-SE")}T00:00:00Z`);
const money = (min: number, max: number) =>
  faker.number.float({ min, max, fractionDigits: 2 });

function monthDays(offset: number) {
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1),
  );
  const last = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const day = (d: number) =>
    new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), Math.min(d, last)),
    );
  return { day, last };
}

function cardLabel(account: AccountKey, merchant: string, date: Date) {
  if (account === "revolut") return merchant;
  const dd = isoDate(date).slice(8, 10);
  const mm = isoDate(date).slice(5, 7);
  return `CB ${merchant.toUpperCase()} ${dd}/${mm}`;
}

function drafts(): Draft[] {
  const employer = faker.company.name().toUpperCase();
  const out: Draft[] = [];

  for (let offset = MONTHS - 1; offset >= 0; offset--) {
    const { day, last } = monthDays(offset);
    const fixed = (
      d: number,
      account: AccountKey,
      amount: number,
      label: string,
      category: string,
      direction: Draft["direction"] = "debit",
    ) =>
      out.push({ account, date: day(d), amount, direction, label, category });

    fixed(1, "courant", 200, "VIR SEPA LIVRET A", "Livret A");
    fixed(2, "courant", 86.4, "PRLV NAVIGO ANNUEL", "Pass Navigo");
    fixed(3, "courant", 42, "PRLV ALAN SA MUTUELLE", "Mutuelle");
    fixed(5, "joint", 1150, "PRLV FONCIA PARIS LOYER", "Loyer");
    fixed(8, "joint", 39.99, "PRLV FREE TELECOM FREEBOX", "Internet");
    fixed(
      10,
      "joint",
      28.5,
      "PRLV MAIF ASSURANCE HABITATION",
      "Assurance habitation",
    );
    fixed(
      12,
      "joint",
      money(55, 95),
      "PRLV EDF CLIENTS PARTICULIERS",
      "Énergie",
    );
    fixed(
      15,
      "courant",
      184,
      "PRLV DGFIP IMPOT PRELEVEMENT A LA SOURCE",
      "Impôt sur le revenu",
    );
    fixed(20, "courant", 19.99, "PRLV FREE MOBILE", "Téléphone");
    fixed(
      last,
      "courant",
      3.5,
      "COTISATION CARTE VISA PREMIER",
      "Frais bancaires",
    );
    fixed(
      27,
      "courant",
      money(3650, 3750),
      `VIR SEPA ${employer} SALAIRE`,
      "Salaire",
      "credit",
    );
    if (offset % 3 === 0)
      fixed(
        18,
        "courant",
        100,
        "VIR SEPA SPIRICA ASSURANCE VIE",
        "Assurance vie",
      );

    const subscription = (d: number, merchant: string, amount: number) =>
      out.push({
        account: "revolut",
        date: day(d),
        amount,
        direction: "debit",
        label: merchant,
        party: merchant,
        category: "Streaming",
      });
    subscription(6, "Netflix.com", 13.49);
    subscription(14, "Spotify", 11.12);

    const card = (
      count: [number, number],
      merchants: string[],
      range: [number, number],
      category: string | null,
      accounts: AccountKey[] = ["courant", "courant", "revolut"],
    ) => {
      for (
        let i = faker.number.int({ min: count[0], max: count[1] });
        i > 0;
        i--
      ) {
        const account = faker.helpers.arrayElement(accounts);
        const merchant = faker.helpers.arrayElement(merchants);
        const date = day(faker.number.int({ min: 1, max: last }));
        out.push({
          account,
          date,
          amount: money(...range),
          direction: "debit",
          label: cardLabel(account, merchant, date),
          party: account === "revolut" ? merchant : undefined,
          category,
        });
      }
    };

    card(
      [6, 9],
      ["Carrefour City", "Monoprix", "Franprix", "Lidl", "Picard"],
      [18, 140],
      "Supermarché",
      ["joint", "joint", "courant"],
    );
    card(
      [6, 10],
      ["Boulangerie Julien", "Maison Landemaine", "Du Pain et des Idées"],
      [1.3, 14],
      "Boulangerie",
    );
    card([2, 4], ["Marché d'Aligre", "Primeur du Marché"], [8, 35], "Marché");
    card(
      [3, 6],
      [
        "Le Petit Cambodge",
        "Big Mamma",
        "Pizzeria Popolare",
        "Chez Gladines",
        "Bistrot Paul Bert",
      ],
      [18, 78],
      "Restaurant",
    );
    card(
      [4, 8],
      ["Café Kitsuné", "Starbucks", "Fringe Coffee"],
      [2.5, 9],
      "Café",
    );
    card([1, 3], ["Deliveroo", "Uber Eats"], [17, 42], "Livraison", [
      "revolut",
    ]);
    card([0, 2], ["Uber", "G7 Taxi"], [11, 28], "VTC");
    card([0, 1], ["SNCF Connect"], [45, 160], "Train");
    card(
      [0, 2],
      ["Pharmacie de la Bastille", "Pharmacie Monge"],
      [6, 32],
      "Pharmacie",
    );
    card([0, 1], ["Doctolib Dr Bernard"], [26.5, 60], "Médecin");
    card(
      [1, 2],
      ["UGC Ciné Cité", "MK2 Bibliothèque"],
      [11, 14.9],
      "Cinéma & spectacles",
      ["revolut"],
    );
    card([1, 1], ["Basic-Fit"], [29.99, 29.99], "Sport");
    card([0, 2], ["Fnac", "Librairie Gallimard"], [9, 32], "Livres");
    card(
      [1, 3],
      ["Cyrillus", "Okaïdi", "Nature et Découvertes"],
      [15, 60],
      "Enfants",
    );
    card(
      [0, 1],
      ["Galeries Lafayette", "Rituals"],
      [25, 90],
      "Cadeaux & occasions spéciales en famille",
    );
    // Nothing describes these yet: they feed the « Sans catégorie » row.
    card(
      [1, 3],
      ["SumUp *Atelier Victor", "PayPal *Vinted", "Zettle *Kiosque"],
      [4, 48],
      null,
    );

    if (faker.datatype.boolean())
      fixed(
        25,
        "courant",
        money(18, 45),
        "VIR CPAM PARIS REMBOURSEMENT",
        "Remboursements",
        "credit",
      );

    // Paid for a friend, then reimbursed: the user leaves it out of the totals.
    out.push({
      account: "revolut",
      date: day(9),
      amount: 48,
      direction: "debit",
      label: "PayPal *Billetterie",
      party: "PayPal *Billetterie",
      category: "Cinéma & spectacles",
      excluded: true,
    });
  }

  // Today's card payment is still an authorization, so « en attente » always shows.
  out.push({
    account: "revolut",
    date: today,
    amount: 4.2,
    direction: "debit",
    label: "Café Kitsuné",
    party: "Café Kitsuné",
    category: "Café",
  });

  return out.filter((d) => d.date <= today);
}

function toRaw(d: Draft): EbTransaction {
  const reference = faker.string.alphanumeric({ length: 16, casing: "upper" });
  // Card payments from the last two days are still authorizations.
  const recent = today.getTime() - d.date.getTime() < 2 * 86_400_000;
  const party = d.party ? { name: d.party } : null;
  return {
    entry_reference: reference,
    transaction_amount: { currency: "EUR", amount: d.amount.toFixed(2) },
    credit_debit_indicator: d.direction === "debit" ? "DBIT" : "CRDT",
    status: recent && d.party ? "PDNG" : "BOOK",
    booking_date: isoDate(d.date),
    value_date: isoDate(d.date),
    transaction_date: isoDate(d.date),
    remittance_information: [d.label],
    creditor: d.direction === "debit" ? party : null,
    debtor: d.direction === "credit" ? party : null,
    bank_transaction_code: {
      code: d.account === "revolut" ? "CARD_PAYMENT" : null,
    },
    merchant_category_code: null,
  };
}

async function seed() {
  faker.seed(20260101);
  const rows = drafts();

  await db.transaction(async (tx) => {
    await tx
      .insert(user)
      .values({
        id: DEMO.userId,
        email: DEMO.email,
        name: DEMO.name,
        emailVerified: true,
      })
      .onConflictDoNothing();
    await tx
      .insert(organization)
      .values({
        id: DEMO.organizationId,
        name: "Démo",
        slug: "demo",
        isPersonal: true,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
    await tx
      .insert(member)
      .values({
        id: "demo-member",
        organizationId: DEMO.organizationId,
        userId: DEMO.userId,
        role: "owner",
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    const inDemo = eq(bankAccounts.organizationId, DEMO.organizationId);
    const oldAccounts = tx
      .select({ id: bankAccounts.id })
      .from(bankAccounts)
      .where(inDemo);
    await tx
      .delete(transactions)
      .where(inArray(transactions.accountId, oldAccounts));
    await tx
      .delete(categories)
      .where(
        and(
          eq(categories.organizationId, DEMO.organizationId),
          isNotNull(categories.parentId),
        ),
      );
    await tx
      .delete(categories)
      .where(eq(categories.organizationId, DEMO.organizationId));
    await tx.delete(bankAccounts).where(inDemo);

    const accounts = await tx
      .insert(bankAccounts)
      .values(
        Object.entries(ACCOUNTS).map(([uid, account]) => ({
          organizationId: DEMO.organizationId,
          uid,
          ...account,
        })),
      )
      .returning({ uid: bankAccounts.uid, id: bankAccounts.id });
    const accountIds = Object.fromEntries(
      accounts.map((a) => [a.uid, a.id]),
    ) as Record<AccountKey, number>;

    const families = Object.entries(CATEGORIES);
    const parents = await tx
      .insert(categories)
      .values(
        families.map(([name, cat]) => ({
          organizationId: DEMO.organizationId,
          name,
          icon: cat.icon,
          color: cat.color,
          budgetAmount: cat.budget?.toFixed(2),
          budgetDetailed: Object.values(cat.children).some((b) => b !== null),
        })),
      )
      .returning({ name: categories.name, id: categories.id });
    const parentIds = new Map(parents.map((p) => [p.name, p.id]));
    const children = await tx
      .insert(categories)
      .values(
        families.flatMap(([parent, cat]) =>
          Object.entries(cat.children).map(([name, budget]) => ({
            organizationId: DEMO.organizationId,
            name,
            parentId: parentIds.get(parent),
            budgetAmount: budget?.toFixed(2),
          })),
        ),
      )
      .returning({ name: categories.name, id: categories.id });
    const categoryIds = new Map(
      [...parents, ...children].map((c) => [c.name, c.id]),
    );

    await tx.insert(transactions).values(
      rows.map((d) => {
        const categoryId =
          d.category === null ? null : categoryIds.get(d.category);
        if (categoryId === undefined)
          throw new Error(`Catégorie inconnue : ${d.category}`);
        return {
          ...normalizeTransaction(toRaw(d), accountIds[d.account]),
          categoryId,
          categorySource:
            categoryId === null
              ? null
              : faker.helpers.weightedArrayElement([
                  { weight: 7, value: "llm" as const },
                  { weight: 2, value: "manual" as const },
                  { weight: 1, value: "auto" as const },
                ]),
          excluded: d.excluded ?? false,
        };
      }),
    );
  });

  // Same row the magic-link plugin stores ("plain" tokens), so its verify
  // endpoint signs the session cookie itself and no email is sent.
  const token = randomUUID();
  await db.insert(verification).values({
    id: randomUUID(),
    identifier: token,
    value: JSON.stringify({ email: DEMO.email }),
    expiresAt: new Date(Date.now() + 15 * 60_000),
  });

  console.log(`Espace « Démo » : ${rows.length} transactions.`);
  console.log(
    `Connexion (15 min) : ${BASE_URL}/api/auth/magic-link/verify?token=${token}&callbackURL=%2F`,
  );
}

await seed();
process.exit(0);
