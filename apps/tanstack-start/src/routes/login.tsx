import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CircleAlertIcon, MailCheckIcon } from "lucide-react";
import { z } from "zod/v4";

import { cn } from "@budget/ui";
import { Alert, AlertDescription, AlertTitle } from "@budget/ui/alert";
import { Button } from "@budget/ui/button";
import { Field, FieldLabel } from "@budget/ui/field";
import { Input } from "@budget/ui/input";
import { Spinner } from "@budget/ui/spinner";

import { authClient } from "~/auth/client";
import { GradientWavesBg } from "~/component/gradient-waves-bg";

/**
 * Portage de `Connexion.dc.html` (Claude Design, projet « Revue du mois »).
 *
 * **Le lien de connexion est la seule voie d'entrée** : ni mot de passe, ni
 * inscription séparée — une adresse inconnue reçoit un lien qui crée le compte
 * (plugin `magicLink`, `@budget/auth`). L'écran s'est donc réduit à un champ.
 *
 * De la maquette, restent non portés le lien « Oublié ? » (il n'y a plus rien à
 * oublier), le décompte « il vous reste 4 tentatives » (rien ne compte les
 * essais côté app — la limite est celle du plugin, 5 par minute, invisible
 * d'ici), et le séparateur « ou » qui coiffait le second chemin de connexion,
 * lequel est devenu le seul.
 *
 * Le panneau « États de la maquette » est un dispositif de maquette : le thème
 * vient de `ThemeProvider`, l'état vient du formulaire.
 */
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

  // Le lien reçu par email ramène sur `redirect` : c'est une navigation de
  // document complète, donc le rechargement que `reloadDocument` assurait
  // autrefois — l'espace actif vit dans la session, react-query servirait
  // sinon le cache d'avant la connexion.
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
        {/* Le voile ne borde que les coins, d'où l'arrêt à 99 % : plus tôt, il
            se répandrait sur toute la houle au lieu de l'y fondre. */}
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
          <div className="bg-primary size-3 rounded-xs" />
          <span className="text-amount font-semibold tracking-[-0.02em]">
            Budget
          </span>
        </div>

        <form
          onSubmit={requestLink}
          className={cn(
            RISE,
            "slide-in-from-bottom-[10px] border-border bg-card/82 shadow-glass w-93 max-w-full rounded-lg border px-5 pt-5 pb-4 backdrop-blur-[14px] backdrop-saturate-130 delay-[60ms] duration-[560ms]",
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
