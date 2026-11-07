import type { ThemeMode } from "~/lib/preferences";

import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { ListGroup, Switch, useThemeColor } from "heroui-native";
import { Check } from "lucide-react-native";
import { useCallback } from "react";
import { Alert, ScrollView } from "react-native";

import { SettingsGroup } from "~/components/settings-group";
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
  const [accent, danger] = useThemeColor(["accent", "danger"]);
  const checked = (selected: boolean) => (
    // Transparent rather than absent: an empty suffix renders the default chevron.
    <ListGroup.ItemSuffix>
      <Check size={18} color={selected ? accent : "transparent"} />
    </ListGroup.ItemSuffix>
  );

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-6 p-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      {spaces.length > 1 && (
        <SettingsGroup title="Espace">
          {spaces.map((space) => (
            <ListGroup.Item
              key={space.id}
              onPress={() => !space.isActive && void switchSpace(space.id)}
            >
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>{space.name}</ListGroup.ItemTitle>
              </ListGroup.ItemContent>
              {checked(space.isActive)}
            </ListGroup.Item>
          ))}
        </SettingsGroup>
      )}

      <SettingsGroup title="Thème">
        {THEMES.map(({ mode, label }) => (
          <ListGroup.Item key={mode} onPress={() => setThemeMode(mode)}>
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle>{label}</ListGroup.ItemTitle>
            </ListGroup.ItemContent>
            {checked(themeMode === mode)}
          </ListGroup.Item>
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
        <ListGroup.Item onPress={confirmSignOut}>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle style={{ color: danger }}>
              Se déconnecter
            </ListGroup.ItemTitle>
          </ListGroup.ItemContent>
        </ListGroup.Item>
      </SettingsGroup>
    </ScrollView>
  );
}
