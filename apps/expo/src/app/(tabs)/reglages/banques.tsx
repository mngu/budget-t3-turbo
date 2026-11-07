import type { ConnectionSummary } from "@budget/api";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Chip, ListGroup, Spinner, Typography, useToast } from "heroui-native";
import { Alert, ScrollView } from "react-native";

import { ActionItem, SettingsGroup } from "~/components/settings-group";
import { trpc } from "~/lib/trpc";

const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

const transactions = (count: number) =>
  `${count} transaction${count > 1 ? "s" : ""}`;

// Status first, as on the web: the badge reports a revoked connection as expired.
function consent({ status, badge, validUntil }: ConnectionSummary) {
  const until = dateFr.format(new Date(validUntil));
  if (status === "revoked")
    return {
      color: "danger",
      label: "Révoqué",
      meta: "L'accès a été annulé chez votre banque.",
    } as const;
  if (status === "expired" || badge.level === "expired")
    return {
      color: "danger",
      label: "Consentement expiré",
      meta: `Depuis le ${until} : aucune transaction importée depuis.`,
    } as const;
  return {
    color: badge.level === "warning" ? "warning" : "success",
    label: `Expire dans ${badge.daysLeft} j`,
    meta: `Jusqu'au ${until}.`,
  } as const;
}

// Status and revocation only: a bank authorization returns to the web app's
// callback, so adding or renewing a connection stays on the web.
export default function Banks() {
  const { data: connections } = useQuery(trpc.connections.list.queryOptions());
  const { data: orphans = [] } = useQuery(
    trpc.connections.orphans.queryOptions(),
  );
  const { toast } = useToast();
  const revoke = useMutation({
    ...trpc.connections.revoke.mutationOptions(),
    onSuccess: () =>
      toast.show({ variant: "success", label: "Accès révoqué." }),
  });

  if (!connections) return <Spinner className="m-8 self-center" />;

  const confirmRevoke = (connection: ConnectionSummary) => {
    const synced = connection.accounts.filter((a) => a.enabled).length;
    Alert.alert(
      `Révoquer « ${connection.aspspName} » ?`,
      `L'autorisation est annulée immédiatement chez votre banque. ${synced} compte(s) cesseront d'être synchronisés ; l'historique importé reste en place. La rétablir demandera une authentification forte, depuis le web.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Révoquer",
          style: "destructive",
          onPress: () => revoke.mutate({ connectionId: connection.id }),
        },
      ],
    );
  };

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-6 p-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Typography type="body-sm" color="muted" className="px-4">
        Vos identifiants bancaires ne passent jamais par cette application :
        chaque connexion est autorisée chez votre banque et vaut environ six
        mois. L'ajout et le renouvellement d'une banque se font depuis l'app
        web.
      </Typography>

      {connections.map((connection) => {
        const view = consent(connection);
        return (
          <SettingsGroup
            key={connection.id}
            title={connection.aspspName}
            footer={
              view.color === "success"
                ? undefined
                : "Réautorisez cette banque depuis l'app web pour reprendre l'import."
            }
          >
            <ListGroup.Item disabled>
              <ListGroup.ItemContent>
                <ListGroup.ItemDescription>
                  {view.meta}
                </ListGroup.ItemDescription>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix>
                <Chip size="sm" color={view.color} variant="soft">
                  <Chip.Label>{view.label}</Chip.Label>
                </Chip>
              </ListGroup.ItemSuffix>
            </ListGroup.Item>
            {connection.accounts.map((account) => (
              <ListGroup.Item
                key={account.id}
                disabled
                className={account.enabled ? undefined : "opacity-50"}
              >
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>
                    {account.displayName ?? connection.aspspName}
                  </ListGroup.ItemTitle>
                  <ListGroup.ItemDescription>
                    {[
                      account.enabled ? account.iban : "Exclu du suivi",
                      transactions(account.transactionCount),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </ListGroup.ItemDescription>
                </ListGroup.ItemContent>
              </ListGroup.Item>
            ))}
            {connection.status !== "revoked" && (
              <ActionItem
                label="Révoquer l'accès"
                tone="danger"
                isDisabled={revoke.isPending}
                onPress={() => confirmRevoke(connection)}
              />
            )}
          </SettingsGroup>
        );
      })}

      {orphans.length > 0 && (
        <SettingsGroup
          title="Comptes sans connexion"
          footer="Leurs transactions restent importées, mais plus rattachées à aucune autorisation. Reconnectez la banque depuis l'app web."
        >
          {orphans.map((orphan) => (
            <ListGroup.Item key={orphan.bankName} disabled>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>{orphan.bankName}</ListGroup.ItemTitle>
                <ListGroup.ItemDescription>
                  {orphan.accountCount} compte
                  {orphan.accountCount > 1 ? "s" : ""} ·{" "}
                  {transactions(orphan.transactionCount)}
                </ListGroup.ItemDescription>
              </ListGroup.ItemContent>
            </ListGroup.Item>
          ))}
        </SettingsGroup>
      )}

      {connections.length === 0 && orphans.length === 0 && (
        <Typography color="muted" className="px-4 text-center">
          Aucune banque connectée pour l'instant.
        </Typography>
      )}
    </ScrollView>
  );
}
