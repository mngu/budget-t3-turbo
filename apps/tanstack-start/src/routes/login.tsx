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

  // L'inscription se fait sur invitation, ou pour amorcer une installation
  // vide : le serveur refuse tout le reste (voir le hook `user.create.before`
  // de @budget/auth). Le bouton reste donc affiché — c'est la seule voie du
  // premier compte — mais il ne promet plus rien, et le message d'erreur du
  // serveur explique le refus le cas échéant.
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
          <p className="text-muted-foreground text-center text-xs">
            La création de compte est réservée aux personnes invitées.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
