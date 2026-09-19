import type { EbTransaction } from "./normalize";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { eq, sql } from "@budget/db";
import { db } from "@budget/db/client";
import { bankAccounts, transactions } from "@budget/db/schema";

import { orgDataDir } from "../lib/data-dir";
import { normalizeTransaction } from "./normalize";

// Scope both source files and destination accounts to the same organization.
export async function importTransactions(
  organizationId: string,
): Promise<boolean> {
  const DATA = orgDataDir(organizationId);

  const dbAccounts = await db
    .select({ id: bankAccounts.id, uid: bankAccounts.uid })
    .from(bankAccounts)
    .where(eq(bankAccounts.organizationId, organizationId));
  const uidToAccountId = new Map(dbAccounts.map((a) => [a.uid, a.id]));

  // A space with no prior sync has no directory yet.
  if (!existsSync(DATA)) return false;
  const txnFiles = readdirSync(DATA).filter(
    (f) => f.startsWith("transactions-") && f.endsWith(".json"),
  );
  let hadError = false;

  for (const file of txnFiles) {
    const uid = file.replace(/^transactions-/, "").replace(/\.json$/, "");
    const accountId = uidToAccountId.get(uid);
    if (!accountId) {
      console.warn(
        `⚠️  ${file} : compte inconnu en base — reconnectez la banque via le wizard`,
      );
      continue;
    }

    let rows;
    let skipped = 0;
    try {
      const rawTxns: EbTransaction[] = JSON.parse(
        readFileSync(resolve(DATA, file), "utf-8"),
      );
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

    // xmax = 0 distinguishes inserts from updates in the upsert result.
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
