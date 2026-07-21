import { useColorScheme } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";

import { GluestackUIProvider } from "~/components/ui/gluestack-ui-provider";
import { queryClient } from "~/utils/api";

import "../styles.css";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GluestackUIProvider mode={colorScheme === "dark" ? "dark" : "light"}>
      <QueryClientProvider client={queryClient}>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: "#c03484",
            },
            contentStyle: {
              backgroundColor: colorScheme == "dark" ? "#09090B" : "#FFFFFF",
            },
          }}
        />
        <StatusBar />
      </QueryClientProvider>
    </GluestackUIProvider>
  );
}
