import {
  Alert,
  Button,
  Input,
  Label,
  Spinner,
  TextField,
  Typography,
} from "heroui-native";
import { useState } from "react";
import { KeyboardAvoidingView, View } from "react-native";

import { authClient } from "~/lib/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const requestLink = async () => {
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: "/auth",
    });
    setPending(false);
    if (error) setError(error.message ?? "Envoi impossible");
    else setSent(true);
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      className="bg-background flex-1 justify-center p-6"
    >
      <View className="gap-4">
        <Typography.Heading type="h3">Connexion</Typography.Heading>

        <TextField isInvalid={error !== null}>
          <Label>Adresse e-mail</Label>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="vous@exemple.fr"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
        </TextField>

        {error && (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{error}</Alert.Title>
            </Alert.Content>
          </Alert>
        )}

        {sent && (
          <Alert status="success">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Lien envoyé à {email}</Alert.Title>
              <Alert.Description>
                Ouvrez-le sur ce téléphone dans les 15 minutes.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <Button
          isDisabled={pending || !email}
          onPress={() => void requestLink()}
        >
          {pending && <Spinner size="sm" />}
          <Button.Label>
            {pending
              ? "Envoi…"
              : sent
                ? "Renvoyer le lien"
                : "Recevoir mon lien de connexion"}
          </Button.Label>
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
