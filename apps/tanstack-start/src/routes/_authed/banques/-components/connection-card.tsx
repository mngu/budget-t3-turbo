import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Loader2Icon, RefreshCwIcon, Trash2Icon } from "lucide-react";

import type { ConnectionSummary } from "@budget/api";
import { Badge } from "@budget/ui/badge";
import { Button } from "@budget/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/ui/card";
import { Separator } from "@budget/ui/separator";
import { toast } from "@budget/ui/toast";

import { useTRPCClient } from "~/lib/trpc";

function ConsentBadge({ connection }: { connection: ConnectionSummary }) {
  if (connection.status === "revoked")
    return <Badge variant="outline">Révoquée</Badge>;
  const { badge } = connection;
  if (badge.level === "expired")
    return <Badge variant="destructive">Consentement expiré</Badge>;
  if (badge.level === "warning") {
    return (
      <Badge className="bg-orange-500 text-white hover:bg-orange-500">
        Expire dans {badge.daysLeft} j
      </Badge>
    );
  }
  return <Badge variant="secondary">Expire dans {badge.daysLeft} j</Badge>;
}

export function ConnectionCard({
  connection,
}: {
  connection: ConnectionSummary;
}) {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [busy, setBusy] = useState(false);

  const renew = async () => {
    setBusy(true);
    try {
      const { url } = await trpcClient.connections.start.mutate({
        name: connection.aspspName,
        country: connection.aspspCountry,
        connectionId: connection.id,
      });
      window.location.href = url;
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Échec du lancement de l'autorisation.",
      );
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!window.confirm(`Révoquer l'accès à ${connection.aspspName} ?`)) return;
    setBusy(true);
    try {
      await trpcClient.connections.revoke.mutate({
        connectionId: connection.id,
      });
      toast.success("Accès révoqué.");
      await router.invalidate();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de la révocation.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {connection.logoUrl && (
            <img
              src={connection.logoUrl}
              alt=""
              className="size-8 rounded object-contain"
            />
          )}
          <CardTitle>{connection.aspspName}</CardTitle>
          <ConsentBadge connection={connection} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={renew}>
            {busy ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <RefreshCwIcon />
            )}
            Renouveler
          </Button>
          {connection.status !== "revoked" && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={revoke}
            >
              <Trash2Icon />
              Révoquer
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Separator className="mb-3" />
        {connection.accounts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucun compte rattaché.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {connection.accounts.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span
                  className={
                    a.enabled ? "" : "text-muted-foreground line-through"
                  }
                >
                  {a.displayName ?? connection.aspspName}
                </span>
                {a.iban && (
                  <span className="text-muted-foreground text-xs">
                    {a.iban}
                  </span>
                )}
                {!a.enabled && (
                  <span className="text-muted-foreground text-xs">(exclu)</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
