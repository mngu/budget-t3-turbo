import type { Space } from "@budget/api";

import { useMutation, useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Button, useToast } from "heroui-native";
import { useState } from "react";
import { ScrollView } from "react-native";

import { SettingsGroup, TextItem } from "~/components/settings-group";
import { followActiveSpace } from "~/lib/spaces";
import { trpc } from "~/lib/trpc";

// Typing the name, as on the web: everything goes, for every member, and
// there is no bin to take it back from.
export default function DeleteSpace() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: spaces = [] } = useQuery(trpc.spaces.list.queryOptions());
  const space = spaces.find((candidate) => candidate.id === id);
  const [typed, setTyped] = useState("");
  const { toast } = useToast();
  const { mutate, isPending } = useMutation(
    trpc.spaces.remove.mutationOptions(),
  );
  // Per call, so the space is captured before the refetch drops it.
  const remove = (deleted: Space) =>
    mutate(
      { id },
      {
        onSuccess: () => {
          if (deleted.isActive) followActiveSpace();
          toast.show({ variant: "success", label: "Espace supprimé." });
          // Back past the deleted space's own screen.
          router.dismissTo("/reglages/espaces");
        },
      },
    );
  const confirmed = !!space && typed.trim() === space.name;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Supprimer l'espace",
          headerRight: () => (
            <Button
              size="sm"
              variant="danger-soft"
              isDisabled={!confirmed || isPending}
              onPress={() => space && remove(space)}
            >
              <Button.Label>Supprimer</Button.Label>
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
          title="Tapez le nom de l'espace pour confirmer"
          footer="Comptes, catégories, budgets et historique sont effacés pour tous ses membres, définitivement. Vos comptes chez la banque ne sont pas touchés."
        >
          <TextItem
            value={typed}
            onChangeText={setTyped}
            placeholder={space?.name}
            autoCapitalize="none"
          />
        </SettingsGroup>
      </ScrollView>
    </>
  );
}
