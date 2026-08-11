import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CircleCheckIcon,
  ClockAlertIcon,
  MailCheckIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";

import { cn } from "@budget/ui";
import { Button } from "@budget/ui/button";
import { Field, FieldLabel } from "@budget/ui/field";
import { Input } from "@budget/ui/input";
import { Spinner } from "@budget/ui/spinner";
import { toast } from "@budget/ui/toast";

import { authClient } from "~/auth/client";
import { useTRPCClient } from "~/lib/trpc";

/**
 * Écran d'acceptation d'une invitation — **hors du layout `_authed`** : l'invité
 * n'a pas forcément de compte, et c'est ici qu'il peut le créer avec l'adresse
 * invitée — l'inscription est ouverte par ailleurs (`/login`), mais ce chemin
 * enchaîne directement sur l'adhésion à l'espace.
 *
 * Cinq états, qui viennent tous du statut de l'invitation croisé avec la
 * session : à accepter (connecté), à demander un lien de connexion
 * (déconnecté), lien envoyé, invitation expirée, invitation déjà utilisée.
 */
export const Route = createFileRoute("/invitation/$invitationId")({
  loader: async ({ context, params }) => {
    const [invitation, session] = await Promise.all([
      context.trpcClient.spaces.invitation.query({
        invitationId: params.invitationId,
      }),
      context.trpcClient.auth.getSession.query(),
    ]);
    return { invitation, email: session?.user.email ?? null };
  },
  component: InvitationPage,
});

function InvitationPage() {
  const { invitation, email } = Route.useLoaderData();
  const { invitationId } = Route.useParams();
  const navigate = useNavigate();
  const trpcClient = useTRPCClient();

  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!invitation) {
    return (
      <Shell
        icon={<ClockAlertIcon className="size-4" />}
        tone="bad"
        title="Cette invitation est introuvable"
        body="Le lien est incomplet ou l'invitation a été supprimée. Demandez-en un nouveau à la personne qui vous a invité."
        footnote="Rien n'a été créé."
      />
    );
  }

  const join = async () => {
    setPending(true);
    try {
      const { organizationId } =
        await trpcClient.spaces.acceptInvitation.mutate({ invitationId });
      // L'espace rejoint devient l'espace actif : sans ça, l'invité arrive sur
      // la revue de son espace personnel, vide, en croyant que rien n'a marché.
      await authClient.organization.setActive({ organizationId });
      window.location.href = "/";
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de l'acceptation.",
      );
      setPending(false);
    }
  };

  // Un lien de connexion à l'adresse invitée : il crée le compte s'il n'existe
  // pas, et le `callbackURL` ramène ici une fois ouvert — l'écran bascule alors
  // sur l'état « connecté », avec son bouton Rejoindre. On ne peut pas
  // court-circuiter avec le lien d'invitation déjà en main : c'est l'adresse
  // qu'il faut prouver, et lui ne prouve que la possession de ce lien-ci.
  const requestLink = async () => {
    setPending(true);
    const { error } = await authClient.signIn.magicLink({
      email: invitation.email,
      // Le nom est facultatif : l'adresse invitée fournit un repli lisible.
      // Il n'est retenu qu'à la création du compte — les autres membres de
      // l'espace le verront dans la liste.
      name: name.trim() || (invitation.email.split("@")[0] ?? invitation.email),
      callbackURL: `/invitation/${invitationId}`,
    });
    setPending(false);
    if (error) toast.error(error.message ?? "Envoi du lien impossible");
    else setSent(true);
  };

  if (invitation.status === "expired") {
    return (
      <Shell
        icon={<ClockAlertIcon className="size-4" />}
        tone="bad"
        title="Cette invitation a expiré"
        body={`Les liens d'invitation valent 7 jours. Demandez à ${invitation.invitedBy} d'en renvoyer un depuis l'écran Espaces — l'adresse invitée reste la même.`}
        note={`Invitation pour ${invitation.email}.`}
        footnote="Rien n'a été créé : votre compte n'existe pas encore."
        secondary={{
          label: "Retour à l'application",
          onClick: () => void navigate({ to: "/login" }),
        }}
      />
    );
  }

  if (invitation.status === "accepted" || invitation.status === "canceled") {
    const used = invitation.status === "accepted";
    return (
      <Shell
        icon={<CircleCheckIcon className="size-4" />}
        tone={used ? "ok" : "bad"}
        title={
          used ? "Ce lien a déjà été utilisé" : "Cette invitation a été annulée"
        }
        body={
          used
            ? `L'invitation a été acceptée. Vous faites déjà partie de l'espace ${invitation.spaceName} — connectez-vous pour y accéder.`
            : `${invitation.invitedBy} a annulé cette invitation. Demandez-lui d'en envoyer une nouvelle si c'est une erreur.`
        }
        footnote="Un lien d'invitation ne sert qu'une fois."
        primary={{
          label: "Se connecter",
          onClick: () => void navigate({ to: "/login" }),
        }}
      />
    );
  }

  if (sent) {
    return (
      <Shell
        icon={<MailCheckIcon className="size-4" />}
        tone="primary"
        title="Ouvrez le lien de connexion"
        body={`Un lien vient de partir à ${invitation.email}. Ouvrez-le dans les 15 minutes : il vous connectera et vous ramènera ici pour rejoindre ${invitation.spaceName}.`}
        note="C'est aussi ce lien qui crée votre compte — il n'y a pas de mot de passe."
        footnote="L'invitation reste valable 7 jours."
      />
    );
  }

  // Statut `pending` : reste à savoir si la personne a déjà un compte.
  const signedInAsInvited =
    email !== null && email.toLowerCase() === invitation.email.toLowerCase();

  if (email !== null && !signedInAsInvited) {
    return (
      <Shell
        icon={<UserIcon className="size-4" />}
        tone="bad"
        title="Cette invitation vise une autre adresse"
        body={`Elle a été envoyée à ${invitation.email}, et vous êtes connecté avec ${email}. Déconnectez-vous pour l'accepter avec le bon compte.`}
        footnote="Un lien d'invitation ne vaut que pour l'adresse invitée."
        primary={{
          label: "Se déconnecter",
          onClick: () => {
            void authClient.signOut().then(() => window.location.reload());
          },
        }}
      />
    );
  }

  return (
    <Shell
      icon={
        signedInAsInvited ? (
          <UsersIcon className="size-4" />
        ) : (
          <UserPlusIcon className="size-4" />
        )
      }
      tone="primary"
      title={
        signedInAsInvited
          ? `${invitation.invitedBy} vous invite dans l'espace ${invitation.spaceName}`
          : `Créez votre compte pour rejoindre ${invitation.spaceName}`
      }
      body={
        signedInAsInvited
          ? "En acceptant, vous verrez les comptes bancaires, les catégories et les transactions de cet espace, exactement comme les autres membres."
          : `${invitation.invitedBy} vous invite. Il vous faut un compte pour accéder à l'espace — il se crée ici, avec l'adresse invitée.`
      }
      stats={
        signedInAsInvited
          ? [
              { label: "Comptes", value: invitation.counts.accounts },
              { label: "Catégories", value: invitation.counts.categories },
              { label: "Membres", value: invitation.counts.members },
            ]
          : undefined
      }
      note={
        signedInAsInvited ? "Vous pourrez quitter l'espace à tout moment." : ""
      }
      footnote={
        signedInAsInvited
          ? "Votre espace personnel reste séparé et n'est pas partagé."
          : "L'adresse ne peut pas être changée : le lien d'invitation ne vaut que pour elle."
      }
      pending={pending}
      primary={{
        label: signedInAsInvited
          ? "Rejoindre l'espace"
          : "Recevoir mon lien de connexion",
        onClick: () => void (signedInAsInvited ? join() : requestLink()),
      }}
      secondary={
        signedInAsInvited
          ? {
              label: "Refuser",
              onClick: () => {
                void trpcClient.spaces.declineInvitation
                  .mutate({ invitationId })
                  .then(() => navigate({ to: "/login" }));
              },
            }
          : undefined
      }
    >
      {signedInAsInvited ? (
        <div className="border-border flex items-center gap-2.5 border-b px-5 py-3.5">
          <UserIcon className="text-subtle size-3.5 flex-none" />
          <div className="text-muted-foreground text-control min-w-0">
            Connecté en tant que{" "}
            <span className="text-foreground font-medium">
              {invitation.email}
            </span>
          </div>
        </div>
      ) : (
        <div className="border-border flex flex-col gap-3 border-b px-5 py-4">
          <Field>
            <FieldLabel>Adresse email</FieldLabel>
            {/* L'adresse ne se choisit pas : l'invitation ne vaut que pour
                elle. Un `Input` désactivé plutôt qu'un encadré fait main. */}
            <Input value={invitation.email} readOnly disabled />
          </Field>
          <Field>
            <FieldLabel htmlFor="name">Votre nom</FieldLabel>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Julie Rossi"
              autoComplete="name"
            />
          </Field>
          <div className="text-subtle text-control text-pretty">
            Pas de mot de passe : un lien de connexion part à cette adresse, et
            c'est lui qui crée votre compte.
          </div>
        </div>
      )}
    </Shell>
  );
}

const TONE = {
  primary: "bg-accent-soft text-primary",
  ok: "bg-ok-soft text-ok",
  bad: "bg-bad-soft text-bad",
};

function Shell({
  icon,
  tone,
  title,
  body,
  stats,
  note,
  footnote,
  primary,
  secondary,
  pending,
  children,
}: {
  icon: React.ReactNode;
  tone: keyof typeof TONE;
  title: string;
  body: string;
  stats?: { label: string; value: number }[];
  note?: string;
  footnote: string;
  primary?: { label: string; onClick: () => void; disabled?: boolean };
  secondary?: { label: string; onClick: () => void };
  pending?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh justify-center px-6 pt-14 pb-20">
      <div className="w-full max-w-118">
        <div className="flex items-center justify-center gap-2.5">
          <div className="bg-primary size-2.5 rounded-xs" />
          <span className="text-body font-semibold tracking-[-0.02em]">
            Budget
          </span>
        </div>

        <div className="border-border-strong bg-card mt-5 overflow-hidden rounded-lg border">
          <div className="border-border border-b px-5 pt-5 pb-4">
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-md",
                TONE[tone],
              )}
            >
              {icon}
            </span>
            <div className="text-heading mt-3 text-pretty">{title}</div>
            <div className="text-muted-foreground text-control mt-1.5 text-pretty">
              {body}
            </div>
          </div>

          {stats && (
            <div className="border-border bg-surface-2 grid grid-cols-3 border-b">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="border-border border-r px-4 py-2.5 last:border-r-0"
                >
                  <div className="num text-body font-medium">{stat.value}</div>
                  <div className="label-caps mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          {children}

          <div className="flex items-center gap-3 px-5 py-3.5">
            <span className="text-subtle text-control min-w-0 flex-1 text-pretty">
              {note}
            </span>
            {secondary && (
              <Button variant="ghost" onClick={secondary.onClick}>
                {secondary.label}
              </Button>
            )}
            {primary && (
              <Button
                disabled={primary.disabled ?? pending}
                onClick={primary.onClick}
              >
                {pending && <Spinner />}
                {primary.label}
              </Button>
            )}
          </div>
        </div>

        <div className="text-subtle text-control mt-3.5 text-center text-pretty">
          {footnote}
        </div>
      </div>
    </main>
  );
}
