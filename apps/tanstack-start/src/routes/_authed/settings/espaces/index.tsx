import type { SpaceDialogSpec } from "./-components/space-dialog";
import type {
  IncomingInvitation,
  Space,
  SpaceInvitation,
  SpaceMember,
  SpaceRole,
} from "@budget/api";

import { createFileRoute } from "@tanstack/react-router";
import {
  LockIcon,
  LogOutIcon,
  MailIcon,
  MailXIcon,
  PencilIcon,
  Trash2Icon,
  UserMinusIcon,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@budget/ui/button";
import { toast } from "@budget/ui/toast";
import { authClient } from "~/auth/client";
import { useTRPCClient } from "~/lib/trpc";
import { useRun } from "~/lib/use-run";

import { SpaceCard } from "./-components/space-card";
import { SpaceDialog } from "./-components/space-dialog";

export const Route = createFileRoute("/_authed/settings/espaces/")({
  loader: async ({ context }) => {
    const [spaces, incoming] = await Promise.all([
      context.trpcClient.spaces.list.query(),
      context.trpcClient.spaces.incoming.query(),
    ]);
    return { spaces, incoming };
  },
  staticData: { title: "Espaces", aside: EspacesAside },
  component: EspacesPage,
});

/**
 * Le geste en cours de confirmation. Un seul état pour tous les dialogues : ils
 * s'excluent, et porter la cible dans la variante évite d'avoir à retrouver
 * « quel espace, déjà ? » au moment de confirmer.
 */
type Action =
  | { kind: "share"; space: Space }
  | { kind: "rename"; space: Space }
  | { kind: "delete"; space: Space }
  | { kind: "deletePersonal" }
  | { kind: "leave"; space: Space }
  | { kind: "invite"; space: Space; email: string; role: SpaceRole }
  | { kind: "removeMember"; space: Space; member: SpaceMember }
  | { kind: "cancelInvitation"; space: Space; invitation: SpaceInvitation };

const CREATE_EMPTY = "vide";
const CREATE_CONVERT = "convertir";

/**
 * La création, posée dans la rangée de titre par le layout
 * (`staticData.aside`). Le geste vit donc ici et non parmi ceux d'EspacesPage :
 * l'aside est rendu *au-dessus* de la page, aucun état de la page ne lui est
 * atteignable. Il n'en a pas besoin — le loader lui suffit.
 */
function EspacesAside() {
  const { spaces } = Route.useLoaderData();
  const trpcClient = useTRPCClient();
  const runMutation = useRun();
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
    const ok = await runMutation<unknown>(
      () =>
        convert
          ? trpcClient.spaces.share.mutate({ id: convert.id, name: draft })
          : trpcClient.spaces.create.mutate({ name: draft }),
      "Échec de la création de l'espace.",
    );
    setBusy(false);
    if (ok === null) return;
    setCreating(false);
    toast.success(
      convert
        ? "Espace partagé — invitez maintenant les membres."
        : "Espace créé — il est vide.",
    );
  };

  return (
    <div className="ml-auto flex items-center gap-4">
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
  const trpcClient = useTRPCClient();
  const runMutation = useRun();

  const [action, setAction] = useState<Action | null>(null);
  // Saisie du dialogue : nom de l'espace, ou nom retapé pour confirmer une
  // suppression. Un seul champ à la fois, jamais deux dans le même dialogue.
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<
    Record<string, { email: string; role: SpaceRole }>
  >({});

  const inviteOf = (id: string) =>
    invites[id] ?? { email: "", role: "member" as SpaceRole };

  const open = (next: Action, initialDraft = "") => {
    setAction(next);
    setDraft(initialDraft);
  };

  const run = async (task: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    const ok = (await runMutation(task, fallback)) !== null;
    if (ok) setAction(null);
    setBusy(false);
    return ok;
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

  // Même geste que la bascule de l'en-tête : l'espace vit dans la session, le
  // cache des loaders du routeur servirait sinon celui de l'espace quitté.
  const switchTo = async (space: Space) => {
    setBusy(true);
    await authClient.organization.setActive({ organizationId: space.id });
    window.location.reload();
  };

  // Répondre à une invitation reçue. Pas de dialogue de confirmation, même
  // pour le refus : le lien devient inerte mais l'espace peut ré-inviter la
  // même adresse (une invitation refusée n'est plus « pending »).
  const respond = async (invitation: IncomingInvitation, accept: boolean) => {
    const ok = await run(
      () =>
        accept
          ? trpcClient.spaces.acceptInvitation.mutate({
              invitationId: invitation.id,
            })
          : trpcClient.spaces.declineInvitation.mutate({
              invitationId: invitation.id,
            }),
      "Échec de la réponse.",
    );
    if (ok)
      toast.success(
        accept
          ? `Vous avez rejoint ${invitation.spaceName} — basculez dessus pour le voir.`
          : "Invitation refusée.",
      );
  };

  const resend = async (invitation: SpaceInvitation) => {
    const ok = await runMutation(
      () =>
        trpcClient.spaces.resendInvitation.mutate({
          invitationId: invitation.id,
        }),
      "Échec de l'envoi.",
    );
    if (ok !== null)
      toast.success(`Invitation renvoyée à ${invitation.email}.`);
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
              onSwitch: () => void switchTo(space),
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
            description:
              "Vos comptes, vos catégories et votre historique restent en place ; l'espace change de nom et accueille d'autres membres.",
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
        body: "Comptes, catégories, budgets et historique sont effacés pour tous ses membres, définitivement. Il n'y a pas de corbeille.",
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
