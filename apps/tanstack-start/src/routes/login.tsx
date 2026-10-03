import { Alert, Button, Input, Label, Spinner, TextField } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod/v4";

import { cn } from "@budget/ui";
import { authClient } from "~/auth/client";
import { GradientWavesBg } from "~/component/gradient-waves-bg";
import { Logo } from "~/component/logo";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    redirect: z.string().optional().catch(undefined),
  }),
  component: LoginPage,
});

const RISE =
  "animate-in fade-in fill-mode-both ease-[cubic-bezier(0.2,0.7,0.2,1)]";

function LoginPage() {
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const requestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: redirect ?? "/",
    });
    setPending(false);
    if (error) setError(error.message ?? "Envoi impossible");
    else setSent(true);
  };

  const incomplete = pending || !email;

  return (
    <main className="relative flex h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0">
        <GradientWavesBg />
        {/* Fade only the corners so the overlay does not obscure the waves. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 42%, transparent 62%, var(--background) 99%)",
          }}
        />
      </div>

      <div className="relative z-1 flex flex-1 flex-col items-center justify-center p-6">
        <div
          className={cn(
            RISE,
            "slide-in-from-bottom-[10px] mb-5 flex items-center gap-2 duration-500",
          )}
        >
          <Logo className="size-5" />
          <span className="text-amount font-semibold tracking-[-0.02em]">
            Jar
          </span>
        </div>

        <form
          onSubmit={requestLink}
          className={cn(
            RISE,
            "slide-in-from-bottom-[10px] border-border bg-surface/82 shadow-glass w-full max-w-93 rounded-lg border px-5 pt-5 pb-4 backdrop-blur-[14px] backdrop-saturate-130 delay-[60ms] duration-[560ms]",
          )}
        >
          <h1 className="text-amount font-semibold tracking-[-0.025em]">
            Connexion
          </h1>

          <div className="flex flex-col gap-2">
            <TextField
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              isInvalid={error !== null}
            >
              <Label>Adresse e-mail</Label>
              <Input placeholder="vous@exemple.fr" />
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
                    Ouvrez-le dans les 15 minutes — il vous connectera
                    directement.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            <Button type="submit" isDisabled={incomplete} isPending={pending}>
              {pending && <Spinner color="current" size="sm" />}
              {pending
                ? "Envoi…"
                : sent
                  ? "Renvoyer le lien"
                  : "Recevoir mon lien de connexion"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
