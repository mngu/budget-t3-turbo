import { createFileRoute } from "@tanstack/react-router";
import { CircleAlertIcon, MailCheckIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod/v4";

import { cn } from "@budget/ui";
import { Alert, AlertDescription, AlertTitle } from "@budget/ui/alert";
import { Button } from "@budget/ui/button";
import { Field, FieldLabel } from "@budget/ui/field";
import { Input } from "@budget/ui/input";
import { Spinner } from "@budget/ui/spinner";
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
            "slide-in-from-bottom-[10px] border-border bg-card/82 shadow-glass w-full max-w-93 rounded-lg border px-5 pt-5 pb-4 backdrop-blur-[14px] backdrop-saturate-130 delay-[60ms] duration-[560ms]",
          )}
        >
          <h1 className="text-amount font-semibold tracking-[-0.025em]">
            Connexion
          </h1>

          <div className="flex flex-col gap-2">
            <Field>
              <FieldLabel htmlFor="email">Adresse e-mail</FieldLabel>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.fr"
                autoComplete="email"
                aria-invalid={error !== null}
              />
            </Field>

            {error && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}

            {sent && (
              <Alert variant="ok">
                <MailCheckIcon />
                <AlertTitle>Lien envoyé à {email}</AlertTitle>
                <AlertDescription>
                  Ouvrez-le dans les 15 minutes — il vous connectera
                  directement.
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={incomplete} className="mt-0.5">
              {pending && <Spinner />}
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
