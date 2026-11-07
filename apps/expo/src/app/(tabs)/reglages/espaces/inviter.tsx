import type { SpaceRole } from "@budget/api";

import { useMutation, useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Button, useToast } from "heroui-native";
import { useState } from "react";
import { ScrollView } from "react-native";

import {
  CheckItem,
  SettingsGroup,
  TextItem,
} from "~/components/settings-group";
import { trpc } from "~/lib/trpc";

export default function Invite() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const space = useQuery(trpc.spaces.list.queryOptions()).data?.find(
    (candidate) => candidate.id === id,
  );
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<SpaceRole>("member");
  const { toast } = useToast();
  const { mutate, isPending } = useMutation({
    ...trpc.spaces.invite.mutationOptions(),
    onSuccess: () => {
      toast.show({
        variant: "success",
        label: `Invitation envoyée à ${email.trim()}.`,
      });
      router.back();
    },
  });
  const send = () => email.trim() && mutate({ id, email: email.trim(), role });

  return (
    <>
      <Stack.Screen
        options={{
          title: "Inviter",
          headerRight: () => (
            <Button
              size="sm"
              variant="ghost"
              isDisabled={!email.trim() || isPending}
              onPress={send}
            >
              <Button.Label>Envoyer</Button.Label>
            </Button>
          ),
        }}
      />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-6 p-4"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <SettingsGroup
          title="Adresse email"
          footer={`Un email part avec un lien d'acceptation valable 7 jours. La personne verra tous les comptes et toutes les transactions de ${space?.name ?? "l'espace"}.`}
        >
          <TextItem
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={send}
            placeholder="prenom@exemple.fr"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            // The address is the whole form: typing must work at once.
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </SettingsGroup>

        <SettingsGroup title="Rôle">
          <CheckItem
            label="Membre"
            selected={role === "member"}
            onPress={() => setRole("member")}
          />
          <CheckItem
            label="Propriétaire"
            selected={role === "owner"}
            onPress={() => setRole("owner")}
          />
        </SettingsGroup>
      </ScrollView>
    </>
  );
}
