import { router, Stack } from "expo-router";
import { Button } from "heroui-native";

// Forms open as modals with a way out, as creation and confirmation do in the
// platform's own settings.
const form = {
  presentation: "modal",
  headerLeft: () => (
    <Button size="sm" variant="ghost" onPress={() => router.back()}>
      <Button.Label>Annuler</Button.Label>
    </Button>
  ),
} as const;

// The tab's own stack keeps the tab bar under its sub-screens.
export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Réglages" }} />
      <Stack.Screen name="categories/index" options={{ title: "Catégories" }} />
      <Stack.Screen name="categories/icone" options={{ title: "Icône" }} />
      <Stack.Screen name="categories/nouvelle" options={form} />
      <Stack.Screen name="espaces/index" options={{ title: "Espaces" }} />
      <Stack.Screen name="espaces/nouveau" options={form} />
      <Stack.Screen name="espaces/inviter" options={form} />
      <Stack.Screen name="espaces/supprimer" options={form} />
      <Stack.Screen name="banques" options={{ title: "Banques" }} />
    </Stack>
  );
}
