#!/usr/bin/env tsx
// Import idempotent des JSON Enable Banking (data/) vers PostgreSQL.
// Usage : npm run import

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "@budget/db";
import { db } from "@budget/db/client";
import { accounts, transactions } from "@budget/db/schema";
import { DATA_DIR } from "../src/lib/data-dir";
import { normalizeTransaction, type EbTransaction } from "./normalize";

const DATA = DATA_DIR;

export async function main(): Promise<boolean> {
  // 1. Comptes connus (créés par le wizard de connexion, ou import historique)
  const dbAccounts = await db.select({ id: accounts.id, uid: accounts.uid }).from(accounts);
  const uidToAccountId = new Map(dbAccounts.map((a) => [a.uid, a.id]));

  // 2. Transactions
  const txnFiles = readdirSync(DATA).filter(
    (f) => f.startsWith("transactions-") && f.endsWith(".json"),
  );
  let hadError = false;

  for (const file of txnFiles) {
    const uid = file.replace(/^transactions-/, "").replace(/\.json$/, "");
    const accountId = uidToAccountId.get(uid);
    if (!accountId) {
      console.warn(`⚠️  ${file} : compte inconnu en base — reconnectez la banque via le wizard`);
      continue;
    }

    let rows;
    let skipped = 0;
    try {
      const rawTxns: EbTransaction[] = JSON.parse(readFileSync(resolve(DATA, file), "utf-8"));
      rows = rawTxns.flatMap((t) => {
        try {
          return [normalizeTransaction(t, accountId)];
        } catch (err: any) {
          console.warn(`   ⚠️  transaction ignorée : ${err.message}`);
          skipped++;
          return [];
        }
      });
    } catch (err: any) {
      console.error(`❌ ${file} : JSON illisible (${err.message})`);
      hadError = true;
      continue;
    }

    if (rows.length === 0) {
      console.log(`   ${file} : rien à importer`);
      continue;
    }

    // Upsert : ON CONFLICT met à jour uniquement si un champ significatif a changé
    // (ex. pending → booked). xmax = 0 distingue insertion et mise à jour.
    const result = await db
      .insert(transactions)
      .values(rows)
      .onConflictDoUpdate({
        target: [transactions.accountId, transactions.entryReference],
        set: {
          status: sql`excluded.status`,
          amount: sql`excluded.amount`,
          bookingDate: sql`excluded.booking_date`,
          valueDate: sql`excluded.value_date`,
          description: sql`excluded.description`,
          counterparty: sql`excluded.counterparty`,
          raw: sql`excluded.raw`,
          importedAt: sql`now()`,
        },
        setWhere: sql`${transactions.status} is distinct from excluded.status
          or ${transactions.amount} is distinct from excluded.amount
          or ${transactions.bookingDate} is distinct from excluded.booking_date
          or ${transactions.description} is distinct from excluded.description`,
      })
      .returning({ isInsert: sql<boolean>`(xmax = 0)` });

    const inserted = result.filter((r) => r.isInsert).length;
    const updated = result.length - inserted;
    const unchanged = rows.length - result.length;
    const skippedNote = skipped > 0 ? `, ${skipped} ignorées` : "";
    console.log(
      `   ✅ ${inserted} insérées, ${updated} mises à jour, ${unchanged} inchangées${skippedNote}`,
    );
  }

  return hadError;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .then((hadError) => process.exit(hadError ? 1 : 0))
    .catch((err) => {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    });
}
