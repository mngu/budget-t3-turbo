"use client";

import type { AccountSummary, ConnectionSummary } from "@budget/api";
import { cn } from "@budget/ui";
import { Badge } from "@budget/ui/badge";
import { Button } from "@budget/ui/button";
import { Progress } from "@budget/ui/progress";
import { Spinner } from "@budget/ui/spinner";

import { CONSENT_TONE, consentView, TONE_VARIANT } from "../-lib/consent";
import { useRenewConnection } from "../-lib/use-renew";
import { BankLogo } from "./bank-logo";

export function ConnectionCard({
  connection,
  onRevoke,
}: {
  connection: ConnectionSummary;
  onRevoke: () => void;
}) {
  const view = consentView(connection);
  const tone = CONSENT_TONE[view.tone];
  const { renew, busy } = useRenewConnection();

  return (
    <section
      className={cn(
        "bg-card rounded-lg border",
        view.critical ? tone.border : "border-border",
      )}
    >
      <div className="grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3.5 px-4.5 py-3.5">
        <BankLogo
          name={connection.aspspName}
          logoUrl={connection.logoUrl}
          className="size-[38px] text-[13px]"
        />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="truncate text-sm font-semibold tracking-[-0.015em]">
              {connection.aspspName}
            </span>
            <span className="text-subtle rounded-[5px] border px-1.5 text-[11px]">
              {connection.aspspCountry}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <Badge variant={TONE_VARIANT[view.tone]}>
              <span className={cn("size-1.5 rounded-full", tone.fill)} />
              {view.badge}
            </Badge>
            <span className="text-subtle text-[11.5px]">{view.meta}</span>
          </div>

          {view.pct > 0 && (
            <Progress
              value={view.pct}
              variant={TONE_VARIANT[view.tone]}
              aria-label="Validité du consentement"
              className="mt-2.5 max-w-[280px]"
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Une connexion critique appelle un renouvellement : c'est la
              variante pleine qui le dit, la teinte du ton restant portée par la
              pastille de statut au-dessus. */}
          <Button
            variant={view.critical ? "default" : "outline"}
            size="sm"
            disabled={busy}
            onClick={() => void renew(connection)}
          >
            {busy && <Spinner />}
            {view.critical ? "Réautoriser" : "Renouveler"}
          </Button>

          {connection.status !== "revoked" && (
            <Button variant="outline" size="sm" onClick={onRevoke}>
              Révoquer
            </Button>
          )}
        </div>
      </div>

      <div className="border-t">
        {connection.accounts.length === 0 ? (
          <p className="text-subtle px-4.5 py-2.5 text-[11.5px]">
            Aucun compte rattaché — la prochaine autorisation les découvrira.
          </p>
        ) : (
          connection.accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              fallbackName={connection.aspspName}
            />
          ))
        )}
      </div>
    </section>
  );
}

function AccountRow({
  account,
  fallbackName,
}: {
  account: AccountSummary;
  fallbackName: string;
}) {
  return (
    <div className="hover:bg-surface-2 grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 border-t px-4.5">
      <div className="flex min-w-0 flex-wrap items-baseline gap-2.5">
        <span
          className={cn(
            "text-[12.5px] font-medium",
            account.enabled ? "" : "text-subtle line-through",
          )}
        >
          {account.displayName ?? fallbackName}
        </span>
        {account.iban && (
          <span
            className={cn(
              "text-subtle num text-[11.5px]",
              account.enabled ? "" : "line-through",
            )}
          >
            {account.iban}
          </span>
        )}
        {!account.enabled && (
          <span className="text-subtle rounded-[5px] border px-1.5 text-[11px]">
            exclu du suivi
          </span>
        )}
      </div>
      {/* Compté même pour un compte exclu : ces transactions sont bien en base
          et pèsent dans le total de l'en-tête. La maquette met « — » parce que
          son compte exclu est vide ; un compte historique décoché en porte des
          centaines, et les cacher ici ferait mentir les deux chiffres. */}
      <span className="text-subtle num text-[11.5px] whitespace-nowrap">
        {account.transactionCount} transaction
        {account.transactionCount > 1 ? "s" : ""}
      </span>
    </div>
  );
}
