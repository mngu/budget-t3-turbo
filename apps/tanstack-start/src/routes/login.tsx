import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CircleAlertIcon, EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import { z } from "zod/v4";

import { cn } from "@budget/ui";

import { authClient } from "~/auth/client";
import { GradientWavesBg } from "~/component/gradient-waves-bg";

/**
 * Portage de `Connexion.dc.html` (Claude Design, projet « Revue du mois »).
 *
 * Trois éléments de la maquette n'ont aucune source et ne sont pas portés, même
 * règle que pour `Banques.dc.html` : le lien « Oublié ? » (aucune procédure de
 * réinitialisation), le bouton « Recevoir un lien de connexion » et son état
 * « Vérifiez vos e-mails » (better-auth n'a pas le plugin magic-link ici), et
 * le décompte « il vous reste 4 tentatives » (rien ne compte les essais). Le
 * séparateur « ou » disparaît avec le bouton qu'il coiffait.
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

const FIELD =
  "h-[34px] rounded-[9px] border bg-card px-[11px] text-[13px] outline-none transition-[border-color,box-shadow] duration-[130ms] focus:border-primary focus:ring-[3px] focus:ring-accent-soft";

const RISE =
  "animate-in fade-in fill-mode-both ease-[cubic-bezier(0.2,0.7,0.2,1)]";

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // L'espace actif vit dans la session, pas dans l'URL : un `navigate` client
  // servirait le cache react-query d'avant la connexion.
  const finish = () => {
    void navigate({ to: redirect ?? "/", reloadDocument: true });
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (error) setError(error.message ?? "Connexion impossible");
    else finish();
  };

  // L'inscription se fait sur invitation (écran `/invitation/$invitationId`),
  // ou pour amorcer une installation vide : le serveur refuse tout le reste
  // (hook `user.create.before` de @budget/auth). C'est la seule voie du premier
  // compte, d'où ce lien discret — et le refus du serveur s'affiche en clair
  // dans le bandeau d'erreur le cas échéant.
  const signUp = async () => {
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      email,
      password,
      name: email.split("@")[0] ?? email,
    });
    setPending(false);
    if (error) setError(error.message ?? "Création de compte impossible");
    else finish();
  };

  const incomplete = pending || !email || !password;

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
        <div className={cn(RISE, "slide-in-from-bottom-[10px] mb-5 flex items-center gap-2 duration-500")}>
          <div className="bg-primary size-[13px] rounded-[3px]" />
          <span className="text-[19px] font-semibold tracking-[-0.02em]">
            Budget
          </span>
        </div>

        <form
          onSubmit={signIn}
          className={cn(
            RISE,
            "slide-in-from-bottom-[10px] border-border bg-card/82 w-[372px] max-w-full rounded-[14px] border px-5 pt-5 pb-4 shadow-[0_24px_48px_-22px_oklch(0.15_0.02_265/0.35)] backdrop-blur-[14px] backdrop-saturate-130 delay-[60ms] duration-[560ms] dark:shadow-[0_24px_48px_-22px_oklch(0_0_0/0.6)]",
          )}
        >
          <h1 className="text-[19px] font-semibold tracking-[-0.025em]">
            Content de vous revoir
          </h1>
          <p className="text-subtle mt-0.5 mb-4 text-[12.5px] text-pretty">
            Connectez-vous pour retrouver la revue du mois de votre espace.
          </p>

          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground text-[11px] font-medium">
                Adresse e-mail
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.fr"
                autoComplete="email"
                className={cn(FIELD, "border-border-strong")}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground text-[11px] font-medium">
                Mot de passe
              </span>
              <span className="relative flex items-center">
                <input
                  type={visible ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={cn(
                    FIELD,
                    "w-full pr-9",
                    error ? "border-bad" : "border-border-strong",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setVisible((v) => !v)}
                  title={
                    visible
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  className="text-subtle hover:bg-accent hover:text-foreground absolute right-1 flex size-7 items-center justify-center rounded-[7px]"
                >
                  {visible ? (
                    <EyeOffIcon className="size-[15px]" />
                  ) : (
                    <EyeIcon className="size-[15px]" />
                  )}
                </button>
              </span>
            </label>

            {error && (
              <div className="bg-bad-soft text-bad flex items-start gap-[7px] rounded-[9px] px-[11px] py-[9px] text-[11.5px] leading-[1.45]">
                <CircleAlertIcon className="mt-px size-3.5 flex-none" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={incomplete}
              className="bg-primary text-primary-foreground mt-0.5 flex h-[34px] items-center justify-center gap-2 rounded-[9px] text-[13px] font-semibold tracking-[-0.01em] transition-[opacity,transform] duration-[130ms] hover:opacity-92 active:scale-[0.988] disabled:opacity-60"
            >
              {pending && <Loader2Icon className="size-3.5 animate-spin" />}
              {pending ? "Connexion…" : "Se connecter"}
            </button>
          </div>
        </form>

        {/* Pastille de verre, et non du texte nu : la houle est vive juste sous
            la carte, la mention a besoin de son propre fond pour rester
            lisible. La maquette ne la pose que sur ce fond-là. */}
        <p
          className={cn(
            RISE,
            "slide-in-from-bottom-[10px] text-muted-foreground bg-card/74 mt-3 w-[372px] max-w-full rounded-[11px] px-[11px] py-1.5 text-center text-[11.5px] text-pretty backdrop-blur-[12px] backdrop-saturate-120 delay-[120ms] duration-[600ms]",
          )}
        >
          Pas encore de compte ? L'inscription se fait avec un lien
          d'invitation — ou{" "}
          <button
            type="button"
            onClick={() => void signUp()}
            disabled={incomplete}
            className="text-primary hover:underline disabled:opacity-60 disabled:hover:no-underline"
          >
            créez le premier compte
          </button>{" "}
          pour amorcer l'installation.
        </p>
      </div>
    </main>
  );
}
