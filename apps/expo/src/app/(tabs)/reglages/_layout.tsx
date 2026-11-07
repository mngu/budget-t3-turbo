import { Stack } from "expo-router";

// The tab's own stack keeps the tab bar under its sub-screens.
export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Réglages" }} />
      <Stack.Screen name="categories/index" options={{ title: "Catégories" }} />
      <Stack.Screen name="categories/icone" options={{ title: "Icône" }} />
      <Stack.Screen
        name="categories/nouvelle"
        options={{ presentation: "modal" }}
      />
    </Stack>
  );
}
