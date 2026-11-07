import { router, Stack } from "expo-router";
import { Button } from "heroui-native";

// Its own stack, so the category list pushes inside the sheet.
export default function TransactionLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Transaction",
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => router.back()}>
              <Button.Label>OK</Button.Label>
            </Button>
          ),
        }}
      />
      <Stack.Screen
        name="categorie"
        options={{ title: "Catégorie", headerBackTitle: "Transaction" }}
      />
    </Stack>
  );
}
