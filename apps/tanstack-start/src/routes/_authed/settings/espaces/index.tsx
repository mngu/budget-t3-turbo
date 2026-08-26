import type { SpaceDialogSpec } from "./-components/space-dialog";
import type {
  IncomingInvitation,
  Space,
  SpaceInvitation,
  SpaceMember,
  SpaceRole,
} from "@budget/api";

import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  LockIcon,
  LogOutIcon,
  MailIcon,
  MailXIcon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
  UserMinusIcon,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@budget/ui/button";
import { toast } from "@budget/ui/toast";
import { authClient } from "~/auth/client";
import { sumBy } from "~/lib/sum";
import { useTRPCClient } from "~/lib/trpc";

import { SpaceCard } from "./-components/space-card";
import { SpaceDialog } from "./-components/space-dialog";

export const Route = createFileRoute("/_authed/settings/espaces/")({
  loader: async ({ context }) => {
    const [spaces, incoming] = await Promise.all([
      context.trpcClient.spaces.list.query(),
      context.trpcClient.spaces.incoming.query(),
    ]);
    const members = sumBy(spaces, (space) => space.counts.members);
    return { spaces, incoming, members };
  },
  staticData: { title: "Espaces", aside: EspacesAside },
  component: EspacesPage,
});

/**
 * Le geste en cours de confirmation. Un seul état pour les dix dialogues : ils
 * s'excluent, et porter la cible dans la variante évite d'avoir à retrouver
 * « quel espace, déjà ? » au moment de confirmer.
 */
type Action =
  | { kind: "share"; space: Space }
  | { kind: "rename"; space: Space }
  | { kind: "delete"; space: Space }
  | { kind: "deletePersonal" }
  | { kind: "leave"; space: Space }
  | { kind: "switch"; space: Space }
  | { kind: "invite"; space: Space; email: string; role: SpaceRole }
  | { kind: "removeMember"; space: Space; member: SpaceMember }
  | { kind: "cancelInvitation"; space: Space; invitation: SpaceInvitation };

const CREATE_EMPTY = "vide";
const CREATE_CONVERT = "convertir";

/**
 * Les compteurs et la création, posés dans la rangée de titre par le layout
 * (`staticData.aside`). Le geste vit donc ici et non parmi ceux d'EspacesPage :
 * l'aside est rendu *au-dessus* de la page, aucun état de la page ne lui est
 * atteignable. Il n'en a pas besoin — le loader lui suffit.
 */
function EspacesAside() {
  const { spaces, members } = Route.useLoaderData();
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const personal = spaces.find((s) => s.isPersonal);

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [choice, setChoice] = useState(CREATE_CONVERT);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    // Deux chemins, une seule décision : ouvrir l'espace qu'on a déjà, ou en
    // créer un vide. Le premier garde comptes, catégories et historique —
    // c'est le seul moyen, rien ne déplace un compte d'un espace à l'autre.
    const convert = choice === CREATE_CONVERT ? personal : undefined;
    setBusy(true);
    try {
      await (convert
        ? trpcClient.spaces.share.mutate({ id: convert.id, name: draft })
        : trpcClient.spaces.create.mutate({ name: draft }));
      setCreating(false);
      await router.invalidate();
      toast.success(
        convert
          ? "Espace partagé — invitez maintenant les membres."
          : "Espace créé — il est vide.",
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Échec de la création de l'espace.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ml-auto flex items-center gap-4">
      <div className="border-border flex items-center gap-4 border-r pr-4">
        <Counter
          value={spaces.length}
          label={spaces.length > 1 ? "Espaces" : "Espace"}
        />
        <Counter value={members} label={members > 1 ? "Membres" : "Membre"} />
      </div>
      <Button
        onClick={() => {
          setDraft("");
          setChoice(personal ? CREATE_CONVERT : CREATE_EMPTY);
          setCreating(true);
        }}
      >
        Créer un espace partagé
      </Button>
      <SpaceDialog
        spec={
          creating
            ? createSpec({ personal, draft, choice, setChoice, setDraft })
            : null
        }
        busy={busy}
        onConfirm={() => void confirm()}
        onClose={() => setCreating(false)}
      />
    </div>
  );
}

function EspacesPage() {
  const { spaces, incoming } = Route.useLoaderData();
  const router = useRouter();
  const trpcClient = useTRPCClient();

  const [action, setAction] = useState<Action | null>(null);
  // Saisie du dialogue : nom de l'espace, ou nom retapé pour confirmer une
  // suppression. Un seul champ à la fois, jamais deux dans le même dialogue.
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<
    Record<string, { email: string; role: SpaceRole }>
  >({});

  const personal = spaces.find((s) => s.isPersonal);
  const soloBanner =
    spaces.length === 1 && personal !== undefined ? personal : null;

  const inviteOf = (id: string) =>
    invites[id] ?? { email: "", role: "member" as SpaceRole };

  const open = (next: Action, initialDraft = "") => {
    setAction(next);
    setDraft(initialDraft);
  };

  const run = async (task: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    try {
      await task();
      setAction(null);
      await router.invalidate();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : fallback);
      return false;
    } finally {
      setBusy(false);
    }
  };

  // ── Gestes ───────────────────────────────────────────────────────────────

  const confirm = async () => {
    if (!action) return;
    switch (action.kind) {
      case "share": {
        const ok = await run(
          () =>
            trpcClient.spaces.share.mutate({
              id: action.space.id,
              name: draft,
            }),
          "Échec du partage de l'espace.",
        );
        if (ok)
          toast.success("Espace partagé — invitez maintenant les membres.");
        return;
      }
      case "rename": {
        const ok = await run(
          () =>
            trpcClient.spaces.rename.mutate({
              id: action.space.id,
              name: draft,
            }),
          "Échec du renommage.",
        );
        if (ok) toast.success("Espace renommé.");
        return;
      }
      case "delete": {
        const ok = await run(
          () => trpcClient.spaces.remove.mutate({ id: action.space.id }),
          "Échec de la suppression.",
        );
        // L'espace supprimé pouvait être l'espace actif : la session pointe
        // alors sur une organisation qui n'existe plus, et toute l'app
        // répondrait FORBIDDEN. Le rechargement complet en repart proprement.
        if (ok) {
          toast.success("Espace supprimé.");
          if (action.space.isActive) window.location.reload();
        }
        return;
      }
      case "deletePersonal":
        setAction(null);
        return;
      case "leave": {
        const ok = await run(
          () => trpcClient.spaces.leave.mutate({ id: action.space.id }),
          "Impossible de quitter cet espace.",
        );
        if (ok) {
          toast.success(`Vous avez quitté ${action.space.name}.`);
          if (action.space.isActive) window.location.reload();
        }
        return;
      }
      case "switch":
        // Même geste que la bascule de l'en-tête : l'espace vit dans la
        // session, react-query servirait sinon le cache de l'espace quitté.
        setBusy(true);
        await authClient.organization.setActive({
          organizationId: action.space.id,
        });
        window.location.reload();
        return;
      case "invite": {
        const ok = await run(
          () =>
            trpcClient.spaces.invite.mutate({
              id: action.space.id,
              email: action.email,
              role: action.role,
            }),
          "Échec de l'invitation.",
        );
        if (ok) {
          toast.success(`Invitation envoyée à ${action.email}.`);
          setInvites((s) => ({
            ...s,
            [action.space.id]: { email: "", role: "member" },
          }));
        }
        return;
      }
      case "removeMember": {
        const ok = await run(
          () =>
            trpcClient.spaces.removeMember.mutate({
              id: action.space.id,
              userId: action.member.userId,
            }),
          "Échec du retrait.",
        );
        if (ok)
          toast.success(`${action.member.name} a été retiré de l'espace.`);
        return;
      }
      case "cancelInvitation": {
        const ok = await run(
          () =>
            trpcClient.spaces.cancelInvitation.mutate({
              invitationId: action.invitation.id,
            }),
          "Échec de l'annulation.",
        );
        if (ok) toast.success("Invitation annulée.");
        return;
      }
    }
  };

  // Répondre à une invitation reçue. Pas de dialogue de confirmation, même
  // pour le refus : le lien devient inerte mais l'espace peut ré-inviter la
  // même adresse (une invitation refusée n'est plus « pending »).
  const respond = async (invitation: IncomingInvitation, accept: boolean) => {
    setBusy(true);
    try {
      await (accept
        ? trpcClient.spaces.acceptInvitation.mutate({
            invitationId: invitation.id,
          })
        : trpcClient.spaces.declineInvitation.mutate({
            invitationId: invitation.id,
          }));
      toast.success(
        accept
          ? `Vous avez rejoint ${invitation.spaceName} — basculez dessus pour le voir.`
          : "Invitation refusée.",
      );
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de la réponse.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async (invitation: SpaceInvitation) => {
    try {
      await trpcClient.spaces.resendInvitation.mutate({
        invitationId: invitation.id,
      });
      toast.success(`Invitation renvoyée à ${invitation.email}.`);
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'envoi.");
    }
  };

  // ── Rendu ────────────────────────────────────────────────────────────────

  return (
    <>
      <p className="text-muted-foreground text-control mt-2 max-w-160 text-pretty">
        Un espace contient des comptes bancaires, des catégories et des
        transactions ; deux espaces ne voient rien l'un de l'autre. Partager un
        compte, c'est ajouter un membre à l'espace qui le contient.
      </p>

      {incoming.length > 0 && (
        <div className="mt-5 flex flex-col gap-3">
          {incoming.map((invitation) => (
            <div
              key={invitation.id}
              className="border-border-strong bg-accent-soft flex flex-wrap items-center gap-4 rounded-lg border px-5 py-4"
            >
              <span className="bg-card border-border-strong text-primary flex size-8 flex-none items-center justify-center rounded-md border">
                <MailIcon className="size-4" />
              </span>
              <div className="min-w-70 flex-1">
                <div className="text-body font-semibold tracking-[-0.015em]">
                  {invitation.invitedBy} vous invite dans {invitation.spaceName}
                </div>
                <div className="text-muted-foreground text-control mt-1 max-w-165 text-pretty">
                  En acceptant, vous verrez tous les comptes, toutes les
                  catégories et tout l'historique de cet espace, comme{" "}
                  {invitation.role === "owner" ? "propriétaire" : "membre"}.
                  Valable jusqu'au{" "}
                  {new Date(invitation.expiresAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                  })}
                  .
                </div>
              </div>
              <div className="flex flex-none items-center gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void respond(invitation, false)}
                >
                  Refuser
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => void respond(invitation, true)}
                >
                  Rejoindre l&apos;espace
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {soloBanner && (
        <div className="border-border-strong bg-surface-2 mt-5 flex flex-wrap items-center gap-4 rounded-lg border px-5 py-4">
          <span className="bg-card border-border-strong text-primary flex size-8 flex-none items-center justify-center rounded-md border">
            <UsersIcon className="size-4" />
          </span>
          <div className="min-w-70 flex-1">
            <div className="text-body font-semibold tracking-[-0.015em]">
              Vous êtes seul sur cet espace
            </div>
            <div className="text-muted-foreground text-control mt-1 max-w-165 text-pretty">
              Vos{" "}
              <span className="num text-meta">
                {soloBanner.counts.transactions.toLocaleString("fr-FR")}
              </span>{" "}
              transactions, vos comptes et vos catégories vivent ici. Pour
              partager ce budget, invitez la personne{" "}
              <span className="text-foreground font-medium">
                dans cet espace
              </span>{" "}
              : rien à redéplacer, l'historique reste. Un espace neuf, lui,
              démarre vide.
            </div>
          </div>
          <Button
            className="flex-none"
            onClick={() =>
              open({ kind: "share", space: soloBanner }, soloBanner.name)
            }
          >
            Partager cet espace
          </Button>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3.5">
        {spaces.map((space) => (
          <SpaceCard
            key={space.id}
            space={space}
            invite={inviteOf(space.id)}
            onInviteChange={(next) =>
              setInvites((s) => ({ ...s, [space.id]: next }))
            }
            actions={{
              onSwitch: () => open({ kind: "switch", space }),
              onRename: () => open({ kind: "rename", space }, space.name),
              onShare: () => open({ kind: "share", space }, space.name),
              onDelete: () =>
                space.isPersonal
                  ? open({ kind: "deletePersonal" })
                  : open({ kind: "delete", space }, ""),
              onLeave: () => open({ kind: "leave", space }),
              onInvite: (email, role) =>
                email.trim().length === 0
                  ? toast.error("Renseignez une adresse email.")
                  : open({ kind: "invite", space, email, role }),
              onRemoveMember: (member) =>
                open({ kind: "removeMember", space, member }),
              onResendInvitation: (invitation) => void resend(invitation),
              onCancelInvitation: (invitation) =>
                open({ kind: "cancelInvitation", space, invitation }),
            }}
          />
        ))}
      </div>

      <SpaceDialog
        spec={action ? describe(action, { draft, setDraft }) : null}
        busy={busy}
        onConfirm={() => void confirm()}
        onClose={() => setAction(null)}
      />
    </>
  );
}

function Counter({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-right">
      <div className="num text-body font-medium">
        {value.toLocaleString("fr-FR")}
      </div>
      <div className="label-caps mt-0.5">{label}</div>
    </div>
  );
}

/** Le dialogue de création. Hors de `describe` : son geste vit dans l'aside. */
function createSpec(ctx: {
  personal: Space | undefined;
  draft: string;
  choice: string;
  setChoice: (key: string) => void;
  setDraft: (value: string) => void;
}): SpaceDialogSpec {
  const { personal, draft, choice, setChoice, setDraft } = ctx;
  const convert = choice === CREATE_CONVERT && personal !== undefined;
  return {
    icon: <UsersIcon className="size-4" />,
    tone: "primary",
    title: "Créer un espace partagé",
    body: "Un espace partagé réunit plusieurs personnes sur les mêmes comptes, les mêmes catégories et le même historique. Deux façons d'y arriver — la première garde ce que vous avez déjà.",
    choices: personal
      ? [
          {
            key: CREATE_CONVERT,
            label: "Partager mon espace actuel",
            description: `Vos ${personal.counts.accounts} compte(s), ${personal.counts.categories} catégories et ${personal.counts.transactions.toLocaleString("fr-FR")} transactions restent en place ; l'espace change de nom et accueille d'autres membres.`,
            warning:
              "Vous n'aurez plus d'espace personnel séparé, et cela ne se défait pas.",
          },
          {
            key: CREATE_EMPTY,
            label: "Partir d'un espace vide",
            description:
              "Un espace neuf, sans compte ni catégorie. À réserver à un budget qui n'a rien à voir avec le vôtre.",
            warning:
              "Il faudra reconnecter les banques ici ; l'historique et les catégories de votre espace ne suivent pas.",
          },
        ]
      : undefined,
    choice,
    onChoice: setChoice,
    input: {
      label: convert ? "Nouveau nom de l'espace" : "Nom de l'espace",
      placeholder: "Foyer Rossi",
      value: draft,
    },
    onInput: setDraft,
    hint: convert ? "Vous inviterez les membres juste après." : undefined,
    footnote: convert ? "Rien n'est supprimé." : "Aucune donnée n'est copiée.",
    cta: convert ? "Partager cet espace" : "Créer l'espace",
    cancel: "Annuler",
    disabled: draft.trim().length === 0,
  };
}

/**
 * Le contenu du dialogue pour un geste. Fonction pure : elle ne décide rien,
 * elle formule — l'exécution est dans `confirm`. Les deux se lisent côte à
 * côte, ce que fait chaque geste et ce qu'il en dit.
 */
function describe(
  action: Action,
  ctx: {
    draft: string;
    setDraft: (value: string) => void;
  },
): SpaceDialogSpec {
  const { draft, setDraft } = ctx;

  switch (action.kind) {
    case "share":
      return {
        icon: <UsersIcon className="size-4" />,
        tone: "primary",
        title: "Partager cet espace",
        body: `Tout ce que contient « ${action.space.name} » reste en place : ses comptes, ses catégories et son historique. L'espace change de nom et peut accueillir d'autres membres.`,
        input: {
          label: "Nouveau nom de l'espace",
          placeholder: "Foyer Rossi",
          value: draft,
        },
        onInput: setDraft,
        hint: "Vous inviterez les membres juste après.",
        footnote:
          "Vous n'aurez plus d'espace personnel séparé, et cela ne se défait pas.",
        cta: "Partager cet espace",
        cancel: "Annuler",
        disabled: draft.trim().length === 0,
      };
    case "rename":
      return {
        icon: <PencilIcon className="size-4" />,
        tone: "primary",
        title: "Renommer l'espace",
        body: "Le nom sert à vous repérer dans la bascule d'espace. Il n'a pas d'effet sur les données.",
        input: {
          label: "Nom de l'espace",
          placeholder: action.space.name,
          value: draft,
        },
        onInput: setDraft,
        cta: "Renommer",
        cancel: "Annuler",
        disabled: draft.trim().length === 0,
      };
    case "delete":
      return {
        icon: <Trash2Icon className="size-4" />,
        tone: "bad",
        title: `Supprimer ${action.space.name} ?`,
        body: "Tout le contenu de l'espace est effacé pour tous ses membres, définitivement. Il n'y a pas de corbeille.",
        facts: [
          {
            value: String(action.space.counts.accounts),
            label: "compte(s) bancaire(s) déconnecté(s)",
          },
          {
            value: String(action.space.counts.categories),
            label: "catégories et leurs budgets",
          },
          {
            value: action.space.counts.transactions.toLocaleString("fr-FR"),
            label: "transactions et leur historique",
          },
          {
            value: String(action.space.counts.members),
            label: "membre(s) perdent l'accès",
          },
        ],
        input: {
          label: "Tapez le nom de l'espace pour confirmer",
          placeholder: action.space.name,
          value: draft,
        },
        onInput: setDraft,
        footnote: "Vos comptes chez la banque ne sont pas touchés.",
        cta: "Supprimer définitivement",
        cancel: "Annuler",
        // La frappe du nom est la seule garde : le bouton reste inerte tant
        // qu'elle ne correspond pas exactement.
        disabled: draft.trim() !== action.space.name,
      };
    case "deletePersonal":
      return {
        icon: <LockIcon className="size-4" />,
        tone: "warn",
        title: "L'espace personnel ne se supprime pas",
        body: "Il est créé avec votre compte et disparaît avec lui. Pour ne plus rien y garder, supprimez les connexions bancaires depuis Banques, ou passez cet espace en espace partagé.",
        cta: "J'ai compris",
      };
    case "leave":
      return {
        icon: <LogOutIcon className="size-4" />,
        tone: "warn",
        title: `Quitter ${action.space.name} ?`,
        body: "Vous perdrez l'accès aux comptes, aux catégories et à l'historique de cet espace. Il continue d'exister pour ses autres membres.",
        footnote:
          "Un propriétaire doit rester : nommez-en un autre avant de partir.",
        cta: "Quitter l'espace",
        cancel: "Annuler",
      };
    case "switch":
      return {
        icon: <RefreshCwIcon className="size-4" />,
        tone: "primary",
        title: `Basculer vers ${action.space.name} ?`,
        body: "L'espace actif change pour toute la session et la page se recharge : revue, transactions et budgets repartent sur les données de cet espace.",
        cta: "Basculer et recharger",
        cancel: "Annuler",
      };
    case "invite":
      return {
        icon: <MailIcon className="size-4" />,
        tone: "primary",
        title: `Inviter dans ${action.space.name}`,
        body: "Un email part avec un lien d'acceptation valable 7 jours. La personne verra tous les comptes et toutes les transactions de l'espace.",
        footnote: `Adresse : ${action.email} · rôle proposé : ${
          action.role === "owner" ? "propriétaire" : "membre"
        }.`,
        cta: "Envoyer l'invitation",
        cancel: "Annuler",
      };
    case "removeMember":
      return {
        icon: <UserMinusIcon className="size-4" />,
        tone: "bad",
        title: `Retirer ${action.member.name} de ${action.space.name} ?`,
        body: `${action.member.name} perdra l'accès aux comptes et aux transactions de cet espace. Rien n'est supprimé : les comptes appartiennent à l'espace, pas à la personne.`,
        facts: consentFacts(action.space, action.member),
        footnote: "Vous pourrez l'inviter de nouveau.",
        cta: "Retirer",
        cancel: "Annuler",
      };
    case "cancelInvitation":
      return {
        icon: <MailXIcon className="size-4" />,
        tone: "warn",
        title: "Annuler l'invitation ?",
        body: `Le lien envoyé à ${action.invitation.email} cessera de fonctionner. Vous pourrez inviter cette adresse de nouveau.`,
        cta: "Annuler l'invitation",
        cancel: "Revenir",
      };
  }
}

/**
 * Le vrai coût de retirer quelqu'un : les autorisations bancaires qu'il a
 * posées. Personne d'autre ne peut les renouveler — c'est ce que dit déjà le
 * bandeau de la carte, répété ici parce que c'est le moment de le savoir.
 */
function consentFacts(space: Space, member: SpaceMember) {
  const theirs = space.consents.filter((c) => c.authorizedBy === member.name);
  if (theirs.length === 0) return undefined;
  return [
    {
      value: String(theirs.length),
      label: `connexion(s) bancaire(s) autorisée(s) par ${member.name} — à réautoriser par quelqu'un d'autre`,
    },
  ];
}
