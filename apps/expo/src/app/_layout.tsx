import "../../global.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { authClient } from "~/lib/auth";
import { queryClient } from "~/lib/trpc";

export default function RootLayout() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <QueryClientProvider client={queryClient}>
          <Stack>
            <Stack.Protected guard={!!session}>
              <Stack.Screen name="index" options={{ title: "Transactions" }} />
            </Stack.Protected>
            <Stack.Protected guard={!session}>
              <Stack.Screen name="login" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Screen name="auth" options={{ headerShown: false }} />
          </Stack>
        </QueryClientProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
