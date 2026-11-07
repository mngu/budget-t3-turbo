import { router, Stack } from "expo-router";
import { Button } from "heroui-native";

// Its own stack, so the category list pushes inside the sheet, as in iOS's own sheets.
export default function FiltersLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Filtres et tri",
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => router.back()}>
              <Button.Label>OK</Button.Label>
            </Button>
          ),
        }}
      />
      <Stack.Screen
        name="categorie"
        options={{ title: "Catégorie", headerBackTitle: "Filtres" }}
      />
    </Stack>
  );
}
