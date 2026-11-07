import type { ThemeMode } from "~/lib/preferences";

import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { ListGroup, Switch, useThemeColor } from "heroui-native";
import { Landmark, Tags, Users } from "lucide-react-native";
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
import { switchSpace } from "~/lib/spaces";
import { queryClient, trpc } from "~/lib/trpc";

// The same pages, in the same order, as the web's gear menu.
const PAGES = [
  { href: "/reglages/categories", title: "Catégories", Icon: Tags },
  { href: "/reglages/banques", title: "Banques", Icon: Landmark },
  { href: "/reglages/espaces", title: "Espaces", Icon: Users },
] as const;

const THEMES: { mode: ThemeMode; label: string }[] = [
  { mode: "system", label: "Système" },
  { mode: "light", label: "Clair" },
  { mode: "dark", label: "Sombre" },
];

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
  const iconColor = useThemeColor("muted");

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-6 p-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      <SettingsGroup>
        {PAGES.map(({ href, title, Icon }) => (
          <ListGroup.Item key={href} onPress={() => router.push(href)}>
            <ListGroup.ItemPrefix>
              <Icon size={20} color={iconColor} />
            </ListGroup.ItemPrefix>
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle>{title}</ListGroup.ItemTitle>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix />
          </ListGroup.Item>
        ))}
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
