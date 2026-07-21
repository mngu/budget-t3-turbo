import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod/v4";

import { Button } from "@budget/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/ui/card";
import { Field, FieldLabel } from "@budget/ui/field";
import { Input } from "@budget/ui/input";
import { toast } from "@budget/ui/toast";

import { authClient } from "~/auth/client";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    redirect: z.string().optional().catch(undefined),
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const finish = () => {
    void navigate({ to: redirect ?? "/", reloadDocument: true });
  };

  const signIn = async () => {
    setPending(true);
    const { error } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (error) toast.error(error.message ?? "Connexion impossible");
    else finish();
  };

  // Mono-utilisateur : la création de compte sert uniquement au premier lancement.
  const signUp = async () => {
    setPending(true);
    const { error } = await authClient.signUp.email({
      email,
      password,
      name: email.split("@")[0] ?? email,
    });
    setPending(false);
    if (error) toast.error(error.message ?? "Création de compte impossible");
    else finish();
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Budget Tracker</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Button onClick={signIn} disabled={pending || !email || !password}>
            Se connecter
          </Button>
          <Button
            variant="outline"
            onClick={signUp}
            disabled={pending || !email || !password}
          >
            Créer le compte
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
