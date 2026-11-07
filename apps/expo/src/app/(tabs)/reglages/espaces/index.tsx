import type { IncomingInvitation } from "@budget/api";

import { useMutation, useQuery } from "@tanstack/react-query";
import { router, Stack, useFocusEffect } from "expo-router";
import { Button, ListGroup, useThemeColor, useToast } from "heroui-native";
import { Plus } from "lucide-react-native";
import { useCallback } from "react";
import { ScrollView } from "react-native";

import { ActionItem, SettingsGroup } from "~/components/settings-group";
import { trpc } from "~/lib/trpc";

export default function Spaces() {
  const { data: spaces = [], refetch: refetchSpaces } = useQuery(
    trpc.spaces.list.queryOptions(),
  );
  const { data: incoming = [], refetch: refetchIncoming } = useQuery(
    trpc.spaces.incoming.queryOptions(),
  );
  // An invitation can arrive while the app sits in the background.
  useFocusEffect(
    useCallback(() => {
      void refetchSpaces();
      void refetchIncoming();
    }, [refetchSpaces, refetchIncoming]),
  );
  const iconColor = useThemeColor("accent");

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              accessibilityLabel="Créer un espace partagé"
              onPress={() => router.push("/reglages/espaces/nouveau")}
            >
              <Plus size={22} color={iconColor} />
            </Button>
          ),
        }}
      />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-6 p-4"
        contentInsetAdjustmentBehavior="automatic"
      >
        {incoming.map((invitation) => (
          <Invitation key={invitation.id} invitation={invitation} />
        ))}

        <SettingsGroup
          title="Vos espaces"
          footer="Un espace contient des comptes bancaires, des catégories et des transactions ; deux espaces ne voient rien l'un de l'autre. Partager un compte, c'est ajouter un membre à l'espace qui le contient."
        >
          {spaces.map((space) => (
            <ListGroup.Item
              key={space.id}
              onPress={() =>
                router.push({
                  pathname: "/reglages/espaces/[id]",
                  params: { id: space.id },
                })
              }
            >
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>{space.name}</ListGroup.ItemTitle>
                <ListGroup.ItemDescription>
                  {[
                    space.isActive && "Espace actif",
                    space.role === "owner" ? "Propriétaire" : "Membre",
                    space.isPersonal
                      ? "Personnel"
                      : `${space.members.length} membre${space.members.length > 1 ? "s" : ""}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </ListGroup.ItemDescription>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix />
            </ListGroup.Item>
          ))}
        </SettingsGroup>
      </ScrollView>
    </>
  );
}

// Without it, the emailed link would be the only door into a shared space.
function Invitation({ invitation }: { invitation: IncomingInvitation }) {
  const { toast } = useToast();
  const accept = useMutation({
    ...trpc.spaces.acceptInvitation.mutationOptions(),
    onSuccess: () =>
      toast.show({
        variant: "success",
        label: `Vous avez rejoint ${invitation.spaceName}.`,
        description: "Basculez dessus depuis les réglages pour le voir.",
      }),
  });
  const decline = useMutation(trpc.spaces.declineInvitation.mutationOptions());
  const busy = accept.isPending || decline.isPending;

  return (
    <SettingsGroup
      title={`Invitation de ${invitation.invitedBy}`}
      footer={`En acceptant, vous verrez tous les comptes, toutes les catégories et tout l'historique de ${invitation.spaceName}, comme ${invitation.role === "owner" ? "propriétaire" : "membre"}.`}
    >
      <ActionItem
        label={`Rejoindre ${invitation.spaceName}`}
        tone="accent"
        isDisabled={busy}
        onPress={() => accept.mutate({ invitationId: invitation.id })}
      />
      <ActionItem
        label="Refuser"
        tone="danger"
        isDisabled={busy}
        onPress={() => decline.mutate({ invitationId: invitation.id })}
      />
    </SettingsGroup>
  );
}
