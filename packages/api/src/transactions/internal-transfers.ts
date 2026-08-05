// Détection des virements entre deux comptes suivis. Un tel virement produit
// deux transactions — un débit sur le compte source, un crédit sur le compte
// destinataire — que rien ne relie en base : les deux entrent dans les agrégats
// et gonflent entrées *et* sorties du mois d'un montant qui n'a jamais quitté
// le foyer (~20 % des flux affichés, mesuré sur la base réelle).
//
// L'appariement est une propriété de la *paire*, jamais d'une ligne isolée :
// c'est pourquoi il ne peut pas venir de la catégorisation, qui regarde une
// transaction à la fois. Voir docs/superpowers/specs/2026-08-03-virements-internes-design.md.
import { and, eq, inArray, isNull, or, sql } from "@budget/db";
import { db } from "@budget/db/client";
import { bankAccounts, transactions } from "@budget/db/schema";

import { ownedByOrganization } from "./queries";

// Écart maximal entre les deux jambes. Au-delà de UNCONFIRMED_MAX_GAP, seule
// une confirmation par IBAN autorise l'appariement : sur les données réelles,
// les seuls candidats à 3 jours sans confirmation sont des faux positifs (un
// salaire et un virement de la conjointe, de même montant par coïncidence).
const MAX_DATE_GAP = 3;
const UNCONFIRMED_MAX_GAP = 1;

// Codes d'opération qui ne peuvent pas être un virement : carte, retrait,
// prélèvement. C'est un **veto**, jamais une liste blanche — Société Générale
// ne renseigne pas `bank_code` du tout, une liste blanche l'exclurait
// entièrement de la détection.
//
// `mcc` jouerait ce rôle ailleurs ; ici la colonne est vide sur 100 % des
// lignes, les trois banques ne la renseignent pas.
const NON_TRANSFER_BANK_CODES = new Set([
  "CARD_PAYMENT", // Revolut — paiement par carte
  "CARD_REFUND", // Revolut — remboursement carte
  "REV_PAYMENT", // Revolut — paiement interne Revolut
  "28", // Caisse d'Épargne — paiement CB
  "29", // Caisse d'Épargne — retrait DAB
  "30", // Caisse d'Épargne — remboursement CB
  "62", // Caisse d'Épargne — cotisation
  "B1", // Caisse d'Épargne — prélèvement
]);

export interface TransferLeg {
  id: number;
  accountId: number;
  direction: "debit" | "credit";
  /** Montant positif, tel que stocké (`numeric(12,2)` → chaîne). */
  amount: string;
  currency: string;
  /** `YYYY-MM-DD`. */
  bookingDate: string;
  bankCode: string | null;
  /**
   * IBAN de la contrepartie, quand la banque le renseigne : `debtor_account`
   * sur un crédit, `creditor_account` sur un débit. Seul Revolut le fournit
   * chez nous — mais il suffit qu'*une* des deux jambes le porte pour trancher
   * la paire entière.
   */
  counterpartyIban: string | null;
}

export interface TransferPair {
  debitId: number;
  creditId: number;
}

/** Comptes suivis : leur IBAN, indexé par id, pour les deux usages ci-dessous. */
export type OwnIbans = Map<number, string>;

type Verdict = "confirmed" | "veto" | "neutral";

// Le montant vient d'un `numeric` : deux banques peuvent l'écrire « 2000.00 »
// et « 2000.0 » selon le pilote. La clé le normalise pour que l'égalité de
// montant ne dépende pas de la mise en forme.
const amountKey = (leg: TransferLeg) =>
  `${leg.currency}|${Number(leg.amount).toFixed(2)}`;

const dayGap = (a: string, b: string) =>
  Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

/**
 * Ce que l'IBAN de contrepartie dit d'une paire candidate.
 *
 * Le signal utile est le **veto**, pas la confirmation : il couvre deux fois
 * plus de lignes, et c'est lui qui sépare un virement interne d'une vraie
 * entrée du foyer quand les deux ont le même montant, le même jour et le même
 * compte destinataire (un apport personnel face à celui de la conjointe, dont
 * le compte n'est pas connecté).
 *
 * Règle : un IBAN de contrepartie renseigné doit désigner le compte de la
 * jumelle. S'il désigne un autre compte — suivi ou non — la paire est refusée.
 * Quand le compte de la jumelle n'a pas d'IBAN en base, on ne peut que
 * constater l'appartenance : externe = veto, interne = on ne sait pas.
 */
function ibanVerdict(
  debit: TransferLeg,
  credit: TransferLeg,
  ibanByAccount: OwnIbans,
): Verdict {
  const own = new Set(ibanByAccount.values());
  let verdict: Verdict = "neutral";

  for (const [leg, twin] of [
    [debit, credit],
    [credit, debit],
  ] as const) {
    const iban = leg.counterpartyIban;
    if (iban === null) continue;
    const twinIban = ibanByAccount.get(twin.accountId);
    if (twinIban !== undefined) {
      if (iban === twinIban) verdict = "confirmed";
      else return "veto";
    } else if (!own.has(iban)) return "veto";
  }
  return verdict;
}

/**
 * Apparie les virements internes. Fonction pure : elle ne lit rien, ce qui la
 * rend testable sur les cas réels sans base (voir le fichier de test).
 *
 * L'appariement est **un-à-un** — une jambe a parfois plusieurs candidats (vu
 * dans les données : un débit de 2 000 € face à deux crédits du même montant le
 * même week-end). Les candidats sont donc consommés par autorité décroissante :
 * confirmés par IBAN d'abord, puis par écart de dates croissant, et une jambe
 * déjà prise fait sauter le candidat suivant.
 */
export function matchInternalTransfers(
  legs: TransferLeg[],
  ibanByAccount: OwnIbans,
): TransferPair[] {
  const credits = new Map<string, TransferLeg[]>();
  for (const leg of legs) {
    if (leg.direction !== "credit") continue;
    const key = amountKey(leg);
    const bucket = credits.get(key);
    if (bucket) bucket.push(leg);
    else credits.set(key, [leg]);
  }

  const candidates: {
    debitId: number;
    creditId: number;
    confirmed: boolean;
    gap: number;
  }[] = [];

  for (const debit of legs) {
    if (debit.direction !== "debit") continue;
    if (NON_TRANSFER_BANK_CODES.has(debit.bankCode ?? "")) continue;

    for (const credit of credits.get(amountKey(debit)) ?? []) {
      if (credit.accountId === debit.accountId) continue;
      if (NON_TRANSFER_BANK_CODES.has(credit.bankCode ?? "")) continue;

      const gap = dayGap(debit.bookingDate, credit.bookingDate);
      if (gap > MAX_DATE_GAP) continue;

      const verdict = ibanVerdict(debit, credit, ibanByAccount);
      if (verdict === "veto") continue;
      const confirmed = verdict === "confirmed";
      if (!confirmed && gap > UNCONFIRMED_MAX_GAP) continue;

      candidates.push({
        debitId: debit.id,
        creditId: credit.id,
        confirmed,
        gap,
      });
    }
  }

  // Les deux derniers critères ne départagent rien de significatif : ils
  // rendent seulement l'appariement déterministe d'une exécution à l'autre,
  // là où deux candidats sont également plausibles.
  candidates.sort(
    (a, b) =>
      Number(b.confirmed) - Number(a.confirmed) ||
      a.gap - b.gap ||
      a.debitId - b.debitId ||
      a.creditId - b.creditId,
  );

  const taken = new Set<number>();
  const pairs: TransferPair[] = [];
  for (const candidate of candidates) {
    if (taken.has(candidate.debitId) || taken.has(candidate.creditId)) continue;
    taken.add(candidate.debitId);
    taken.add(candidate.creditId);
    pairs.push({ debitId: candidate.debitId, creditId: candidate.creditId });
  }
  return pairs;
}

export interface DetectionResult {
  /** Paires retenues après la passe. */
  pairs: number;
  /** Lignes dont l'appariement a changé (posé ou retiré). */
  updated: number;
}

/**
 * Passe de détection, **sur toute la table** et non sur les seules lignes du
 * dernier import. Ce n'est pas de la prudence : `monthlyHistory` alimente la
 * moyenne de référence sur 12 mois, et n'apparier que les nouveautés
 * comparerait un mois courant propre à des mois passés gonflés — un écart
 * inventé sur chaque comparaison.
 *
 * Idempotente : elle repart des seules données bancaires. Les appariements
 * `manual` — posés ou retirés à la main — sont hors de son périmètre, dans un
 * sens comme dans l'autre, même contrat que `category_source`.
 */
export async function detectInternalTransfers(
  organizationId: string,
): Promise<DetectionResult> {
  const accountRows = await db
    .select({ id: bankAccounts.id, iban: bankAccounts.iban })
    .from(bankAccounts)
    .where(eq(bankAccounts.organizationId, organizationId));
  const ibanByAccount: OwnIbans = new Map();
  for (const row of accountRows) {
    if (row.iban) ibanByAccount.set(row.id, row.iban);
  }

  const notManual = or(
    isNull(transactions.transferSource),
    sql`${transactions.transferSource} <> 'manual'`,
  );

  // Scopé par la jointure : deux comptes de deux espaces ne doivent jamais
  // former une paire, même s'ils partagent montant, date et IBAN.
  const legs = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      direction: transactions.direction,
      amount: transactions.amount,
      currency: transactions.currency,
      bookingDate: transactions.bookingDate,
      bankCode: transactions.bankCode,
      counterpartyIban: sql<string | null>`coalesce(
        ${transactions.raw}->'debtor_account'->>'iban',
        ${transactions.raw}->'creditor_account'->>'iban'
      )`,
    })
    .from(transactions)
    .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
    .where(and(eq(bankAccounts.organizationId, organizationId), notManual));

  const pairs = matchInternalTransfers(legs, ibanByAccount);

  const updated = await db.transaction(async (tx) => {
    // Table rase des appariements automatiques avant réécriture : la détection
    // est déterministe sur l'ensemble des données, une paire qui n'en ressort
    // plus (transaction supprimée d'un data/*.json, IBAN désormais connu) doit
    // disparaître plutôt que survivre à sa raison d'être.
    const cleared = await tx
      .update(transactions)
      .set({ transferPairId: null, transferSource: null })
      .where(
        and(
          eq(transactions.transferSource, "auto"),
          ownedByOrganization(organizationId),
        ),
      )
      .returning({ id: transactions.id });

    for (const pair of pairs) {
      await tx
        .update(transactions)
        .set({ transferPairId: pair.creditId, transferSource: "auto" })
        .where(eq(transactions.id, pair.debitId));
      await tx
        .update(transactions)
        .set({ transferPairId: pair.debitId, transferSource: "auto" })
        .where(eq(transactions.id, pair.creditId));
    }
    return cleared.length;
  });

  return { pairs: pairs.length, updated };
}

/**
 * « Ce n'est pas un virement interne » : dépose l'appariement des **deux**
 * jambes et le marque `manual`, ce qui le met hors de portée de la détection.
 * Sans ce marquage la passe suivante reformerait la paire, l'utilisateur ayant
 * corrigé un résultat que rien n'aurait mémorisé.
 */
export async function unlinkInternalTransfer(
  organizationId: string,
  id: number,
): Promise<void> {
  const [row] = await db
    .select({ pairId: transactions.transferPairId })
    .from(transactions)
    .where(and(eq(transactions.id, id), ownedByOrganization(organizationId)));
  if (!row?.pairId) return;

  // La jumelle est dans le même espace par construction (la détection ne
  // franchit pas la frontière) ; le garde reste posé sur les deux, une paire
  // héritée d'avant le cloisonnement pouvant l'enjamber.
  await db
    .update(transactions)
    .set({ transferPairId: null, transferSource: "manual" })
    .where(
      and(
        inArray(transactions.id, [id, row.pairId]),
        ownedByOrganization(organizationId),
      ),
    );
}
