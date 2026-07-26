// Synchronisation des transactions : connexions actives (DB) → data/transactions-*.json.
// Le pipeline aval (import → categorize) reste inchangé.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { and, eq } from "@budget/db";
import { db } from "@budget/db/client";
import { accounts, bankConnections } from "@budget/db/schema";

import { appJwt, ebApi, EbApiError, requireSettings } from "./client";
import { DATA_DIR } from "../lib/data-dir";

const SYNC_DAYS = 90;

export interface SyncOutcome {
  expired: string[];
  rateLimited: string[];
}

// psuHeaders (Psu-Ip-Address, Psu-User-Agent) : présents quand le sync est déclenché
// par l'utilisateur dans l'app — la requête est alors classée « PSU présent » et
// échappe au plafond PSD2 des accès non-assistés (~4/jour par banque). Le CLI/cron
// n'en envoie pas (accès en arrière-plan assumé).
export async function syncBanks(
  psuHeaders: Record<string, string> = {},
): Promise<SyncOutcome> {
  const settings = await requireSettings();
  const jwt = appJwt(settings);
  const dateFrom = new Date(Date.now() - SYNC_DAYS * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  const dataDir = DATA_DIR;
  mkdirSync(dataDir, { recursive: true });

  const connections = await db
    .select()
    .from(bankConnections)
    .where(eq(bankConnections.status, "active"));

  const expired: string[] = [];
  const rateLimited: string[] = [];

  for (const conn of connections) {
    const enabledAccounts = await db
      .select({ uid: accounts.uid })
      .from(accounts)
      .where(
        and(eq(accounts.connectionId, conn.id), eq(accounts.enabled, true)),
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
      // 401 = session PSD2 expirée ou invalidée : la connexion passe en expired,
      // le sync continue pour les autres banques.
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
      // 429 (ASPSP_RATE_LIMIT_EXCEEDED) = quota d'accès de la banque atteint :
      // rien à renouveler, réessayer plus tard (~6 h recommandées par Enable Banking).
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
