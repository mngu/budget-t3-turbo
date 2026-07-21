import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { LogOutIcon, RefreshCwIcon } from "lucide-react-native";

import { ConnectionCard } from "~/components/connection-card";
import {
  Toast,
  ToastDescription,
  ToastTitle,
  useToast,
} from "~/components/ui/toast";
import { trpc, trpcClient } from "~/utils/api";
import { authClient } from "~/utils/auth";

export default function BanquesScreen() {
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);

  const {
    data: connections = [],
    isPending,
    isError,
    refetch,
  } = useQuery(trpc.connections.list.queryOptions());

  const showToast = (description: string, isErrorToast: boolean) => {
    toast.show({
      placement: "top",
      render: ({ id }) => (
        <Toast
          nativeID={`toast-${id}`}
          action={isErrorToast ? "error" : "success"}
        >
          <ToastTitle>{isErrorToast ? "Échec" : "Synchronisation"}</ToastTitle>
          <ToastDescription>{description}</ToastDescription>
        </Toast>
      ),
    });
  };

  const sync = async () => {
    setSyncing(true);
    try {
      await trpcClient.sync.run.mutate();
      await refetch();
      showToast("Synchronisation terminée.", false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Échec de la synchronisation.",
        true,
      );
    } finally {
      setSyncing(false);
    }
  };

  if (isPending) {
    return (
      <SafeAreaView className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="bg-background flex-1 items-center justify-center px-4">
        <Text className="text-destructive text-center">
          Impossible de charger les banques.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-background flex-1">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text className="text-foreground text-lg font-bold">Banques</Text>
        <View className="flex-row gap-4">
          <Pressable onPress={() => void sync()} disabled={syncing}>
            <RefreshCwIcon className="text-foreground" />
          </Pressable>
          <Pressable onPress={() => void authClient.signOut()}>
            <LogOutIcon className="text-foreground" />
          </Pressable>
        </View>
      </View>
      {connections.length === 0 ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-muted-foreground text-center">
            Aucune banque connectée pour l'instant.
          </Text>
        </View>
      ) : (
        connections.map((c) => <ConnectionCard key={c.id} connection={c} />)
      )}
    </SafeAreaView>
  );
}
