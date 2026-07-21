import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { authClient } from "~/utils/auth";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const signIn = async () => {
    setPending(true);
    setError(null);
    const res = await authClient.signIn.email({ email, password });
    setPending(false);
    if (res.error) setError(res.error.message ?? "Connexion impossible");
  };

  return (
    <View className="flex gap-2">
      <TextInput
        className="border-input bg-background text-foreground items-center rounded-md border px-3 text-lg leading-tight"
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        className="border-input bg-background text-foreground items-center rounded-md border px-3 text-lg leading-tight"
        value={password}
        onChangeText={setPassword}
        placeholder="Mot de passe"
        secureTextEntry
      />
      {error && <Text className="text-destructive">{error}</Text>}
      <Pressable
        className="bg-primary flex items-center rounded-sm p-2"
        disabled={pending || !email || !password}
        onPress={() => void signIn()}
      >
        <Text className="text-foreground">Se connecter</Text>
      </Pressable>
    </View>
  );
}

export default function Index() {
  const { data: session } = authClient.useSession();

  return (
    <SafeAreaView className="bg-background">
      <Stack.Screen options={{ title: "Budget" }} />
      <View className="bg-background h-full w-full p-4">
        <Text className="text-foreground pb-2 text-center text-5xl font-bold">
          Budget
        </Text>
        {session ? (
          <>
            <Text className="text-foreground pb-2 text-center text-xl font-semibold">
              Bonjour, {session.user.name}
            </Text>
            <Text className="text-muted-foreground pb-4 text-center">
              Écrans mobiles à venir
            </Text>
            <Pressable
              className="bg-primary flex items-center rounded-sm p-2"
              onPress={() => void authClient.signOut()}
            >
              <Text className="text-foreground">Se déconnecter</Text>
            </Pressable>
          </>
        ) : (
          <LoginForm />
        )}
      </View>
    </SafeAreaView>
  );
}
