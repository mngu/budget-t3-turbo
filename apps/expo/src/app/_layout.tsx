import "../../global.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { HeroUINativeProvider } from "heroui-native";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { authClient } from "~/lib/auth";
import { PeriodProvider } from "~/lib/period";
import { queryClient } from "~/lib/trpc";

export default function RootLayout() {
  const { data: session, isPending } = authClient.useSession();
  const dark = useColorScheme() === "dark";
  if (isPending) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <QueryClientProvider client={queryClient}>
          {/* Headers and the tab bar are React Navigation's, outside HeroUI's theme. */}
          <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
            <PeriodProvider>
              <Stack>
                <Stack.Protected guard={!!session}>
                  <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="categorie/[name]"
                    options={{ headerBackTitle: "Revue" }}
                  />
                </Stack.Protected>
                <Stack.Protected guard={!session}>
                  <Stack.Screen name="login" options={{ headerShown: false }} />
                </Stack.Protected>
                <Stack.Screen name="auth" options={{ headerShown: false }} />
              </Stack>
            </PeriodProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
