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

// Sharing the personal space keeps its data: accounts cannot move between
// spaces, so it is the way to share a budget already built.
export default function NewSpace() {
  const params = useLocalSearchParams<{ convert?: string }>();
  const { data: spaces = [] } = useQuery(trpc.spaces.list.queryOptions());
  const personal = spaces.find((space) =>
    params.convert ? space.id === params.convert : space.isPersonal,
  );
  const [convert, setConvert] = useState(true);
  const [name, setName] = useState("");
  const { toast } = useToast();
  const share = useMutation({
    ...trpc.spaces.share.mutationOptions(),
    onSuccess: () => {
      toast.show({
        variant: "success",
        label: "Espace partagé : invitez maintenant les membres.",
      });
      router.back();
    },
  });
  const create = useMutation({
    ...trpc.spaces.create.mutationOptions(),
    onSuccess: () => {
      toast.show({ variant: "success", label: "Espace créé, il est vide." });
      router.back();
    },
  });
  const converting = !!personal && (convert || !!params.convert);
  const submit = () => {
    if (!name.trim()) return;
    if (converting) share.mutate({ id: personal.id, name });
    else create.mutate({ name });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: params.convert ? "Partager l'espace" : "Espace partagé",
          headerRight: () => (
            <Button
              size="sm"
              variant="ghost"
              isDisabled={!name.trim() || share.isPending || create.isPending}
              onPress={submit}
            >
              <Button.Label>{converting ? "Partager" : "Créer"}</Button.Label>
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
        {personal && !params.convert && (
          <SettingsGroup
            footer={
              convert
                ? "Vos comptes, vos catégories et votre historique restent en place. Vous n'aurez plus d'espace personnel séparé, et cela ne se défait pas."
                : "Un espace neuf, sans compte ni catégorie : il faudra y reconnecter les banques depuis le web."
            }
          >
            <CheckItem
              label="Partager mon espace actuel"
              selected={convert}
              onPress={() => setConvert(true)}
            />
            <CheckItem
              label="Partir d'un espace vide"
              selected={!convert}
              onPress={() => setConvert(false)}
            />
          </SettingsGroup>
        )}

        <SettingsGroup
          title={converting ? "Nouveau nom de l'espace" : "Nom de l'espace"}
          footer={
            converting
              ? "Vous inviterez les membres juste après. Rien n'est supprimé."
              : "Aucune donnée n'est copiée."
          }
        >
          <TextItem
            value={name}
            onChangeText={setName}
            onSubmitEditing={submit}
            placeholder="Foyer Rossi"
            autoCapitalize="words"
          />
        </SettingsGroup>
      </ScrollView>
    </>
  );
}
