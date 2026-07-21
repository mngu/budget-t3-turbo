import { Text, View } from "react-native";

import type { ConnectionSummary } from "@budget/api";

import { Badge, BadgeText } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";

// Le Badge gluestack généré n'expose que `variant` (pas de prop `action`) —
// mapping : expiré → destructive, avertissement → secondary, sinon outline.
function ConsentBadge({ connection }: { connection: ConnectionSummary }) {
  if (connection.status === "revoked") {
    return (
      <Badge variant="outline">
        <BadgeText>Révoquée</BadgeText>
      </Badge>
    );
  }
  if (connection.badge.level === "expired") {
    return (
      <Badge variant="destructive">
        <BadgeText>Consentement expiré</BadgeText>
      </Badge>
    );
  }
  if (connection.badge.level === "warning") {
    return (
      <Badge variant="secondary">
        <BadgeText>Expire dans {connection.badge.daysLeft} j</BadgeText>
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <BadgeText>Expire dans {connection.badge.daysLeft} j</BadgeText>
    </Badge>
  );
}

export function ConnectionCard({
  connection,
}: {
  connection: ConnectionSummary;
}) {
  return (
    <Card className="mx-4 mb-3 gap-2 p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-foreground font-semibold">
          {connection.aspspName}
        </Text>
        <ConsentBadge connection={connection} />
      </View>
      {connection.accounts.length === 0 ? (
        <Text className="text-muted-foreground text-sm">
          Aucun compte rattaché.
        </Text>
      ) : (
        connection.accounts.map((a) => (
          <Text
            key={a.id}
            className={
              a.enabled
                ? "text-foreground text-sm"
                : "text-muted-foreground text-sm line-through"
            }
          >
            {a.displayName ?? connection.aspspName}
            {!a.enabled ? " (exclu)" : ""}
          </Text>
        ))
      )}
    </Card>
  );
}
