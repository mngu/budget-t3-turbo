import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { UnlinkIcon } from "lucide-react";

import type { ConnectionSummary } from "@budget/api";
import { Button } from "@budget/ui/button";
import { toast } from "@budget/ui/toast";

import { AppHeader } from "~/component/app-header";
import { useTRPCClient } from "~/lib/trpc";
import { ConnectionCard } from "./-components/connection-card";
import { ConsentAlert } from "./-components/consent-alert";
import { Onboarding } from "./-components/onboarding";
import { RevokeDialog } from "./-components/revoke-dialog";
import { SyncStatus } from "./-components/sync-status";
import { consentAlert } from "./-lib/consent";

export const Route = createFileRoute("/_authed/banques/")({
  loader: async ({ context }) => {
    // `settings.status` appelle l'API Enable Banking : les deux lectures DB
    // partent en même temps plutôt que derrière elle.
    const [setup, connections, orphans] = await Promise.all([
      context.trpcClient.settings.status.query(),
      context.trpcClient.connections.list.query(),
      context.trpcClient.connections.orphans.query(),
    ]);
    return { setup, connections, orphans };
  },
  component: BanquesPage,
});

function BanquesPage() {
  const { setup, connections, orphans } = Route.useLoaderData();
  const router = useRouter();
  const trpcClient = useTRPCClient();

  const [revokeTarget, setRevokeTarget] = useState<ConnectionSummary | null>(
    null,
  );
  const [revoking, setRevoking] = useState(false);

  const alert = consentAlert(connections);
  const { total, lastImportedAt } = importTotals(connections, orphans);

  const revoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await trpcClient.connections.revoke.mutate({
        connectionId: revokeTarget.id,
      });
      toast.success(`Accès à ${revokeTarget.aspspName} révoqué.`);
      setRevokeTarget(null);
      await router.invalidate();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de la révocation.",
      );
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden text-body leading-[1.45]">
      <AppHeader page="banques" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto max-w-250 px-6 pt-5 pb-12">
          <div className="flex min-h-9.5 flex-wrap items-center gap-6">
            <h1 className="text-title">Banques</h1>
            <div className="ml-auto flex items-center gap-4">
              <SyncStatus
                totalTransactions={total}
                lastImportedAt={lastImportedAt}
              />
              {setup.configured && (
                <Button
                  render={
                    <Link to="/banques/ajouter" search={{ step: "banque" }} />
                  }
                >
                  Ajouter une banque
                </Button>
              )}
            </div>
          </div>
          <p className="text-muted-foreground mt-2 max-w-155 text-control text-pretty">
            Vos identifiants bancaires ne passent jamais par cette application :
            chaque connexion est autorisée chez votre banque et vaut environ six
            mois.
          </p>

          {alert && <ConsentAlert alert={alert} />}

          {!setup.configured ? (
            <Onboarding setup={setup} />
          ) : (
            <div className="mt-5 flex flex-col gap-3.5">
              {connections.map((connection) => (
                <ConnectionCard
                  key={connection.id}
                  connection={connection}
                  onRevoke={() => setRevokeTarget(connection)}
                />
              ))}

              {orphans.map((orphan) => (
                <OrphanBanner key={orphan.bankName} orphan={orphan} />
              ))}

              {connections.length === 0 && (
                <div className="bg-card rounded-lg border px-5 py-11 text-center">
                  <p className="text-body font-semibold">
                    Aucune banque connectée pour l'instant
                  </p>
                  <p className="text-muted-foreground mx-auto mt-1.5 max-w-105 text-control text-pretty">
                    La configuration est en place. Ajoutez une première banque :
                    vous serez redirigé vers elle pour autoriser l'accès, puis
                    ramené ici.
                  </p>
                  <Button
                    className="mt-4"
                    render={
                      <Link to="/banques/ajouter" search={{ step: "banque" }} />
                    }
                  >
                    Ajouter une banque
                  </Button>
                </div>
              )}
            </div>
          )}

          <p className="text-subtle mt-4 max-w-205 text-control text-pretty">
            Une autorisation bancaire dure environ 180 jours. Passé ce délai la
            synchronisation s'arrête sans prévenir : c'est pourquoi le compte à
            rebours est affiché en permanence et devient une alerte un mois
            avant l'échéance.
          </p>
        </main>
      </div>

      <RevokeDialog
        connection={revokeTarget}
        revoking={revoking}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        onConfirm={revoke}
      />
    </div>
  );
}

function OrphanBanner({
  orphan,
}: {
  orphan: { bankName: string; accountCount: number; transactionCount: number };
}) {
  return (
    <div className="border-border-strong flex flex-wrap items-center gap-3.5 rounded-lg border border-dashed px-4.5 py-3.5">
      <UnlinkIcon className="text-subtle size-4 flex-none" />
      <div className="min-w-65 flex-1">
        <p className="text-control font-medium">
          {orphan.accountCount} compte
          {orphan.accountCount > 1 ? "s" : ""} détecté
          {orphan.accountCount > 1 ? "s" : ""} sans connexion
        </p>
        <p className="text-subtle mt-0.5 text-control">
          {orphan.bankName} · {orphan.transactionCount} transaction
          {orphan.transactionCount > 1 ? "s" : ""} importée
          {orphan.transactionCount > 1 ? "s" : ""}, plus rattachée
          {orphan.transactionCount > 1 ? "s" : ""} à aucune autorisation.
        </p>
      </div>
      <Link
        to="/banques/ajouter"
        search={{ step: "banque", q: orphan.bankName }}
        className="border-border-strong hover:bg-accent flex h-8 items-center rounded-md border px-3.5 text-control font-medium whitespace-nowrap"
      >
        Connecter {orphan.bankName}
      </Link>
    </div>
  );
}

// Le bloc d'état ne parle que d'imports (voir la note de SyncStatus) : le total
// et la date la plus récente se lisent dans les comptes déjà chargés, comptes
// orphelins compris — leurs transactions sont dans la même table.
function importTotals(
  connections: ConnectionSummary[],
  orphans: { transactionCount: number }[],
) {
  let total = orphans.reduce((n, o) => n + o.transactionCount, 0);
  let lastImportedAt: string | null = null;

  for (const connection of connections) {
    for (const account of connection.accounts) {
      total += account.transactionCount;
      if (
        account.lastImportedAt &&
        (!lastImportedAt || account.lastImportedAt > lastImportedAt)
      ) {
        lastImportedAt = account.lastImportedAt;
      }
    }
  }

  return { total, lastImportedAt };
}
