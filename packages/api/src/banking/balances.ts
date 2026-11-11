import type { EbBalance } from "./domain";

import { z } from "zod/v4";

import { eq, sql } from "@budget/db";
import { db } from "@budget/db/client";
import { bankAccounts } from "@budget/db/schema";

import { appJwt, ebApi, requireSettings } from "./client";
import { pickBalance } from "./domain";

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

// Gate on the last attempt, not the last success: a bank answering 429 must not
// be called again on every screen opening. ponytail: process-local, like single-flight.
const lastAttempt = new Map<string, number>();

const accountSchema = z.object({ id: z.number(), uid: z.string() });

// Returns whether a balance was written, so callers only reload when something moved.
export async function refreshBalances(
  organizationId: string,
  psuHeaders: Record<string, string>,
  { force = false } = {},
): Promise<boolean> {
  if (!force) {
    // Without the PSU IP the call counts as unattended and eats the ~4/day quota
    // the sync button relies on.
    if (!psuHeaders["Psu-Ip-Address"]) return false;
    const last = lastAttempt.get(organizationId);
    if (last && Date.now() - last < REFRESH_INTERVAL_MS) return false;
  }
  lastAttempt.set(organizationId, Date.now());

  const result = await db.execute(sql`
    SELECT ba.id, ba.uid
    FROM bank_accounts ba
    JOIN bank_connections bc ON bc.id = ba.connection_id
    WHERE ba.organization_id = ${organizationId}
      AND ba.enabled
      AND bc.status = 'active'
  `);
  const accounts = accountSchema.array().parse(result.rows);
  if (accounts.length === 0) return false;

  const jwt = appJwt(await requireSettings());
  const written = await Promise.allSettled(
    accounts.map(async ({ id, uid }) => {
      const { balances } = (await ebApi(`/accounts/${uid}/balances`, jwt, {
        headers: psuHeaders,
      })) as { balances: EbBalance[] };
      const balance = pickBalance(balances);
      if (!balance) return false;
      await db
        .update(bankAccounts)
        .set({
          balance: balance.balance_amount.amount,
          balanceCurrency: balance.balance_amount.currency,
          // A closing balance can be a day old: show the bank's date when it gives one.
          balanceAt: new Date(balance.last_change_date_time ?? Date.now()),
        })
        .where(eq(bankAccounts.id, id));
      return true;
    }),
  );

  // Expired consents and rate limits surface through the sync button, not here.
  for (const outcome of written) {
    if (outcome.status === "rejected") {
      console.warn("⚠️  Solde non rafraîchi :", outcome.reason);
    }
  }
  return written.some((o) => o.status === "fulfilled" && o.value);
}

const balanceSchema = z.object({
  bank: z.string(),
  currency: z.string(),
  amount: z.number(),
  at: z.coerce.date(),
});

// Grouped by the same label as the account picker, which merges same-name accounts.
export async function listBalances(organizationId: string) {
  const result = await db.execute(sql`
    SELECT coalesce(display_name, bank_name) AS bank,
           balance_currency AS currency,
           sum(balance)::float8 AS amount,
           min(balance_at) AS at
    FROM bank_accounts
    WHERE organization_id = ${organizationId}
      AND enabled
      AND balance IS NOT NULL
    GROUP BY 1, 2
    ORDER BY 1, 2
  `);
  return balanceSchema.array().parse(result.rows);
}
