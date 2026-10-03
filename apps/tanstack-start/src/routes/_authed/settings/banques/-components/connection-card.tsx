"use client";

import type { AccountSummary, ConnectionSummary } from "@budget/api";

import { Button, Chip, ProgressBar, Spinner } from "@heroui/react";

import { cn } from "@budget/ui";

import { consentView } from "../-lib/consent";
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
  const { renew, busy } = useRenewConnection();

  return (
    <section className="bg-surface rounded-lg border">
      <div className="grid grid-cols-[38px_minmax(0,1fr)] items-center gap-3.5 px-4.5 py-3.5 md:grid-cols-[38px_minmax(0,1fr)_auto]">
        <BankLogo
          name={connection.aspspName}
          logoUrl={connection.logoUrl}
          className="text-body size-10"
        />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-subheading truncate">
              {connection.aspspName}
            </span>
            <span className="text-muted text-meta rounded-sm border px-1.5">
              {connection.aspspCountry}
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <Chip color={view.tone} size="sm" variant="soft">
              {view.badge}
            </Chip>
            <span className="text-muted text-control">{view.meta}</span>
          </div>

          {view.pct > 0 && (
            <ProgressBar
              value={view.pct}
              color={view.tone}
              size="sm"
              aria-label="Validité du consentement"
              className="mt-2.5 max-w-70"
            >
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          )}
        </div>

        <div className="col-start-2 flex items-center gap-2 md:col-start-auto">
          <Button
            variant={view.critical ? "primary" : "outline"}
            size="sm"
            isPending={busy}
            onPress={() => void renew(connection)}
          >
            {busy && <Spinner color="current" size="sm" />}
            {view.critical ? "Réautoriser" : "Renouveler"}
          </Button>

          {connection.status !== "revoked" && (
            <Button variant="outline" size="sm" onPress={onRevoke}>
              Révoquer
            </Button>
          )}
        </div>
      </div>

      <div className="border-t">
        {connection.accounts.length === 0 ? (
          <p className="text-muted text-control px-4.5 py-2.5">
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
    <div className="hover:bg-surface-secondary grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 border-t px-4.5">
      <div className="flex min-w-0 flex-wrap items-baseline gap-2.5">
        <span
          className={cn(
            "text-control font-medium",
            account.enabled ? "" : "text-muted line-through",
          )}
        >
          {account.displayName ?? fallbackName}
        </span>
        {account.iban && (
          <span
            className={cn(
              "text-muted num text-meta",
              account.enabled ? "" : "line-through",
            )}
          >
            {account.iban}
          </span>
        )}
        {!account.enabled && (
          <span className="text-muted text-meta rounded-sm border px-1.5">
            exclu du suivi
          </span>
        )}
      </div>
      {/* Disabled accounts retain their imported transactions and count toward totals. */}
      <span className="text-muted num text-meta whitespace-nowrap">
        {account.transactionCount} transaction
        {account.transactionCount > 1 ? "s" : ""}
      </span>
    </div>
  );
}
