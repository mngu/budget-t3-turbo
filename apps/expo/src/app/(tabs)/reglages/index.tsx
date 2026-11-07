import type { ThemeMode } from "~/lib/preferences";

import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { ListGroup, Switch } from "heroui-native";
import { useCallback } from "react";
import { Alert, ScrollView } from "react-native";

import {
  ActionItem,
  CheckItem,
  SettingsGroup,
} from "~/components/settings-group";
import { authClient } from "~/lib/auth";
import {
  setCents,
  setThemeMode,
  useCents,
  useThemeMode,
} from "~/lib/preferences";
import { queryClient, trpc } from "~/lib/trpc";

const THEMES: { mode: ThemeMode; label: string }[] = [
  { mode: "system", label: "Système" },
  { mode: "light", label: "Clair" },
  { mode: "dark", label: "Sombre" },
];

// Query keys carry no space or user: what the cache holds belongs to the session left.
async function switchSpace(organizationId: string) {
  await authClient.organization.setActive({ organizationId });
  queryClient.clear();
}

function confirmSignOut() {
  Alert.alert("Se déconnecter ?", undefined, [
    { text: "Annuler", style: "cancel" },
    {
      text: "Se déconnecter",
      style: "destructive",
      onPress: async () => {
        await authClient.signOut();
        queryClient.clear();
      },
    },
  ]);
}

export default function Settings() {
  const { data: session } = authClient.useSession();
  const { data: spaces = [], refetch } = useQuery(
    trpc.spaces.list.queryOptions(),
  );
  // Tabs stay mounted: a space created or joined elsewhere shows on return.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  const themeMode = useThemeMode();
  const cents = useCents();

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-6 p-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      <SettingsGroup>
        <ListGroup.Item onPress={() => router.push("/reglages/categories")}>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>Catégories</ListGroup.ItemTitle>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix />
        </ListGroup.Item>
      </SettingsGroup>

      {spaces.length > 1 && (
        <SettingsGroup title="Espace">
          {spaces.map((space) => (
            <CheckItem
              key={space.id}
              label={space.name}
              selected={space.isActive}
              onPress={() => !space.isActive && void switchSpace(space.id)}
            />
          ))}
        </SettingsGroup>
      )}

      <SettingsGroup title="Thème">
        {THEMES.map(({ mode, label }) => (
          <CheckItem
            key={mode}
            label={label}
            selected={themeMode === mode}
            onPress={() => setThemeMode(mode)}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup footer="Les montants des transactions gardent toujours leurs centimes.">
        <ListGroup.Item onPress={() => setCents(!cents)}>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>Centimes</ListGroup.ItemTitle>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix>
            <Switch isSelected={cents} onSelectedChange={setCents} />
          </ListGroup.ItemSuffix>
        </ListGroup.Item>
      </SettingsGroup>

      <SettingsGroup title="Compte">
        <ListGroup.Item disabled>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>{session?.user.email}</ListGroup.ItemTitle>
          </ListGroup.ItemContent>
        </ListGroup.Item>
        <ActionItem
          label="Se déconnecter"
          tone="danger"
          onPress={confirmSignOut}
        />
      </SettingsGroup>
    </ScrollView>
  );
}
