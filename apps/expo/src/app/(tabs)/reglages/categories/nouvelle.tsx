import { useMutation } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Button } from "heroui-native";
import { useState } from "react";
import { ScrollView, TextInput } from "react-native";

import { isManagedCategory } from "@budget/api/schemas";
import { SettingsGroup } from "~/components/settings-group";
import { useSpaceCategories } from "~/lib/overview";
import { trpc } from "~/lib/trpc";

export default function NewCategory() {
  const { parentId } = useLocalSearchParams<{ parentId?: string }>();
  const parent = useSpaceCategories()
    .data?.filter(isManagedCategory)
    .find((candidate) => String(candidate.id) === parentId);
  const [name, setName] = useState("");
  const { mutate, isPending } = useMutation({
    ...trpc.categories.create.mutationOptions(),
    onSuccess: () => router.back(),
  });
  const create = () =>
    name.trim() &&
    mutate({ name, parentId: parentId ? Number(parentId) : null });

  return (
    <>
      <Stack.Screen
        options={{
          title: parent ? "Nouvelle sous-catégorie" : "Nouvelle catégorie",
          headerRight: () => (
            <Button
              size="sm"
              variant="ghost"
              isDisabled={!name.trim() || isPending}
              onPress={create}
            >
              <Button.Label>Créer</Button.Label>
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
          title="Nom"
          footer={
            parent
              ? `Dans « ${parent.name} ». Elle en reprend la couleur et l'icône.`
              : "Sa couleur et son icône se choisissent ensuite."
          }
        >
          <TextInput
            value={name}
            onChangeText={setName}
            autoCorrect={false}
            onSubmitEditing={create}
            // The name is the whole form: typing must work at once.
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            returnKeyType="done"
            className="text-foreground px-4 py-3.5 text-base"
          />
        </SettingsGroup>
      </ScrollView>
    </>
  );
}
