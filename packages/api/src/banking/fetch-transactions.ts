import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { and, eq } from "@budget/db";
import { db } from "@budget/db/client";
import { bankAccounts, bankConnections } from "@budget/db/schema";

import { orgDataDir } from "../lib/data-dir";
import { appJwt, ebApi, EbApiError, requireSettings } from "./client";

const SYNC_DAYS = 90;

export interface SyncOutcome {
  expired: string[];
  rateLimited: string[];
}

// PSU headers identify user-present access, exempt from unattended PSD2 quotas.
export async function syncBanks(
  organizationId: string,
  psuHeaders: Record<string, string> = {},
): Promise<SyncOutcome> {
  const settings = await requireSettings();
  const jwt = appJwt(settings);
  const dateFrom = new Date(Date.now() - SYNC_DAYS * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  const dataDir = orgDataDir(organizationId);
  mkdirSync(dataDir, { recursive: true });

  const connections = await db
    .select()
    .from(bankConnections)
    .where(
      and(
        eq(bankConnections.organizationId, organizationId),
        eq(bankConnections.status, "active"),
      ),
    );

  const expired: string[] = [];
  const rateLimited: string[] = [];

  for (const conn of connections) {
    const enabledAccounts = await db
      .select({ uid: bankAccounts.uid })
      .from(bankAccounts)
      .where(
        and(
          eq(bankAccounts.connectionId, conn.id),
          eq(bankAccounts.enabled, true),
        ),
      );

    console.log(`🏦 ${conn.aspspName} (transactions depuis ${dateFrom})`);

    try {
      for (const account of enabledAccounts) {
        const transactions: any[] = [];
        let continuationKey: string | undefined;

        do {
          const params = new URLSearchParams({ date_from: dateFrom });
          if (continuationKey) params.set("continuation_key", continuationKey);

          const page = await ebApi(
            `/accounts/${account.uid}/transactions?${params}`,
            jwt,
            {
              headers: psuHeaders,
            },
          );
          transactions.push(...page.transactions);
          continuationKey = page.continuation_key ?? undefined;
        } while (continuationKey);

        const outPath = resolve(dataDir, `transactions-${account.uid}.json`);
        writeFileSync(outPath, JSON.stringify(transactions, null, 2), "utf-8");
        console.log(
          `   ✅ compte ${account.uid} : ${transactions.length} transactions`,
        );
      }
    } catch (err) {
      if (err instanceof EbApiError && err.status === 401) {
        await db
          .update(bankConnections)
          .set({ status: "expired" })
          .where(eq(bankConnections.id, conn.id));
        expired.push(conn.aspspName);
        console.warn(
          `   ⚠️  session expirée — ${conn.aspspName} est à renouveler`,
        );
        continue;
      }
      // Rate limits require waiting, not renewing consent.
      if (err instanceof EbApiError && err.status === 429) {
        rateLimited.push(conn.aspspName);
        console.warn(
          `   ⚠️  limite d'accès atteinte — ${conn.aspspName} : ${err.message}`,
        );
        continue;
      }
      throw err;
    }
  }

  return { expired, rateLimited };
}
