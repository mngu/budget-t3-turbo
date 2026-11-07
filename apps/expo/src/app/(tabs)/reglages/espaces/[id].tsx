import type { SpaceInvitation, SpaceMember } from "@budget/api";

import { useMutation, useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ListGroup, Spinner, Typography, useToast } from "heroui-native";
import { Alert, ScrollView } from "react-native";

import {
  ActionItem,
  RenameItem,
  SettingsGroup,
} from "~/components/settings-group";
import { followActiveSpace, switchSpace } from "~/lib/spaces";
import { trpc } from "~/lib/trpc";

export default function SpaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: spaces = [] } = useQuery(trpc.spaces.list.queryOptions());
  const space = spaces.find((candidate) => candidate.id === id);
  const { toast } = useToast();
  const rename = useMutation(trpc.spaces.rename.mutationOptions());
  const removeMember = useMutation({
    ...trpc.spaces.removeMember.mutationOptions(),
    onSuccess: () =>
      toast.show({ variant: "success", label: "Membre retiré de l'espace." }),
  });
  const resend = useMutation({
    ...trpc.spaces.resendInvitation.mutationOptions(),
    onSuccess: () =>
      toast.show({ variant: "success", label: "Invitation renvoyée." }),
  });
  const cancel = useMutation({
    ...trpc.spaces.cancelInvitation.mutationOptions(),
    onSuccess: () =>
      toast.show({ variant: "success", label: "Invitation annulée." }),
  });
  const leave = useMutation(trpc.spaces.leave.mutationOptions());

  // Left or deleted, or not loaded yet.
  if (!space) return <Spinner className="m-8 self-center" />;
  const owner = space.role === "owner";

  const confirmRemove = (member: SpaceMember) =>
    Alert.alert(
      `Retirer ${member.name} de ${space.name} ?`,
      `${member.name} perdra l'accès aux comptes et aux transactions de cet espace. Rien n'est supprimé : les comptes appartiennent à l'espace, pas à la personne.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer",
          style: "destructive",
          onPress: () => removeMember.mutate({ id, userId: member.userId }),
        },
      ],
    );

  const invitationActions = (invitation: SpaceInvitation) =>
    Alert.alert(invitation.email, "Invitation en attente.", [
      {
        text: "Renvoyer l'invitation",
        onPress: () => resend.mutate({ invitationId: invitation.id }),
      },
      {
        text: "Annuler l'invitation",
        style: "destructive",
        onPress: () => cancel.mutate({ invitationId: invitation.id }),
      },
      { text: "Revenir", style: "cancel" },
    ]);

  const confirmLeave = () =>
    Alert.alert(
      `Quitter ${space.name} ?`,
      "Vous perdrez l'accès aux comptes, aux catégories et à l'historique de cet espace. Il continue d'exister pour ses autres membres.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Quitter",
          style: "destructive",
          // Per call, so the space is captured before the refetch drops it.
          onPress: () =>
            leave.mutate(
              { id },
              {
                onSuccess: () => {
                  if (space.isActive) followActiveSpace();
                  router.back();
                },
              },
            ),
        },
      ],
    );

  return (
    <>
      <Stack.Screen options={{ title: space.name }} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-6 p-4"
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {owner && (
          <SettingsGroup
            title="Nom"
            footer="Il sert à vous repérer dans la bascule d'espace, sans effet sur les données."
          >
            <RenameItem
              key={space.name}
              value={space.name}
              onCommit={(name) => rename.mutate({ id, name })}
            />
          </SettingsGroup>
        )}

        {!space.isActive && (
          <SettingsGroup>
            <ActionItem
              label="Basculer sur cet espace"
              tone="accent"
              onPress={() => void switchSpace(id)}
            />
          </SettingsGroup>
        )}

        {!space.isPersonal && (
          <SettingsGroup title="Membres">
            {space.members.map((member) => (
              <ListGroup.Item
                key={member.userId}
                disabled={!owner || member.isMe}
                onPress={() => confirmRemove(member)}
              >
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>
                    {member.name}
                    {member.isMe ? " (vous)" : ""}
                  </ListGroup.ItemTitle>
                  <ListGroup.ItemDescription>
                    {member.email}
                  </ListGroup.ItemDescription>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix>
                  <Typography color="muted">
                    {member.role === "owner" ? "Propriétaire" : "Membre"}
                  </Typography>
                </ListGroup.ItemSuffix>
              </ListGroup.Item>
            ))}
            {owner && (
              <ActionItem
                label="Inviter quelqu'un"
                tone="accent"
                onPress={() =>
                  router.push({
                    pathname: "/reglages/espaces/inviter",
                    params: { id },
                  })
                }
              />
            )}
          </SettingsGroup>
        )}

        {space.invitations.length > 0 && (
          <SettingsGroup title="Invitations en attente">
            {space.invitations.map((invitation) => (
              <ListGroup.Item
                key={invitation.id}
                disabled={!owner}
                onPress={() => invitationActions(invitation)}
              >
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{invitation.email}</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                {owner && <ListGroup.ItemSuffix />}
              </ListGroup.Item>
            ))}
          </SettingsGroup>
        )}

        {owner && space.isPersonal && (
          <SettingsGroup footer="Vos comptes, vos catégories et votre historique restent en place ; l'espace change de nom et accueille d'autres membres.">
            <ActionItem
              label="Passer en espace partagé"
              tone="accent"
              onPress={() =>
                router.push({
                  pathname: "/reglages/espaces/nouveau",
                  params: { convert: id },
                })
              }
            />
          </SettingsGroup>
        )}

        {!space.isPersonal && (
          <SettingsGroup
            footer={
              owner
                ? "Un propriétaire doit rester : nommez-en un autre avant de partir."
                : undefined
            }
          >
            <ActionItem
              label="Quitter l'espace"
              tone="danger"
              isDisabled={leave.isPending}
              onPress={confirmLeave}
            />
            {owner && (
              <ActionItem
                label="Supprimer l'espace"
                tone="danger"
                onPress={() =>
                  router.push({
                    pathname: "/reglages/espaces/supprimer",
                    params: { id },
                  })
                }
              />
            )}
          </SettingsGroup>
        )}
        {space.isPersonal && (
          <Typography type="body-xs" color="muted" className="px-4">
            L'espace personnel ne se supprime pas : il est créé avec votre
            compte et disparaît avec lui.
          </Typography>
        )}
      </ScrollView>
    </>
  );
}
