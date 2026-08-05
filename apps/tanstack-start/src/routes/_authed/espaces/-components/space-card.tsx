"use client";

import { useState } from "react";
import {
  EllipsisIcon,
  KeyRoundIcon,
  LockIcon,
  LogOutIcon,
  PencilIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
} from "lucide-react";

import type {
  Space,
  SpaceInvitation,
  SpaceMember,
  SpaceRole,
} from "@budget/api";
import { cn } from "@budget/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@budget/ui/popover";

import { dateFr } from "../-lib/format";

/** Teintes de la pastille de statut d'une invitation. */
const STATUS_STYLE: Record<SpaceInvitation["status"], string> = {
  pending: "bg-warn-soft text-warn",
  accepted: "bg-ok-soft text-ok",
  expired: "bg-bad-soft text-bad",
  canceled: "bg-surface-2 text-subtle",
};

const STATUS_LABEL: Record<SpaceInvitation["status"], string> = {
  pending: "En attente",
  accepted: "Acceptée",
  expired: "Expirée",
  canceled: "Annulée",
};

export interface SpaceCardActions {
  onSwitch: () => void;
  onRename: () => void;
  onShare: () => void;
  onDelete: () => void;
  onInvite: (email: string, role: SpaceRole) => void;
  onRemoveMember: (member: SpaceMember) => void;
  onLeave: () => void;
  onResendInvitation: (invitation: SpaceInvitation) => void;
  onCancelInvitation: (invitation: SpaceInvitation) => void;
}

export function SpaceCard({
  space,
  invite,
  onInviteChange,
  actions,
}: {
  space: Space;
  /** Brouillon du formulaire d'invitation de *cette* carte. */
  invite: { email: string; role: SpaceRole };
  onInviteChange: (next: { email: string; role: SpaceRole }) => void;
  actions: SpaceCardActions;
}) {
  const shared = !space.isPersonal;
  const owner = space.role === "owner";
  // Un espace partagé où l'on est encore seul : la carte remplace la liste des
  // membres par une invitation en grand — il n'y a rien à lister.
  const alone =
    shared && space.counts.members === 1 && space.invitations.length === 0;
  const pending = space.invitations.filter(
    (i) => i.status === "pending",
  ).length;

  return (
    <div
      className={cn(
        "bg-card overflow-hidden rounded-[14px] border",
        space.isActive ? "border-primary" : "border-border-strong",
      )}
    >
      <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3.5 px-4 py-3.5">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-[11px]",
            space.isActive
              ? "bg-accent-soft text-primary"
              : "bg-surface-2 text-subtle",
          )}
        >
          {shared ? (
            <UsersIcon className="size-[17px]" />
          ) : (
            <UserIcon className="size-[17px]" />
          )}
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-sm font-semibold tracking-[-0.015em]">
              {space.name}
            </span>
            {space.isActive && (
              <Pill className="bg-accent-soft text-primary font-semibold">
                Espace actif
              </Pill>
            )}
            <Pill className="border-border text-muted-foreground border font-medium">
              {owner ? "Propriétaire" : "Membre"}
            </Pill>
            {!shared && (
              <Pill className="bg-surface-2 text-subtle font-medium">
                Personnel
              </Pill>
            )}
          </div>
          <div className="text-subtle mt-[3px] text-[11.5px]">
            {shared
              ? `Créé le ${dateFr(space.createdAt)}${
                  pending > 0
                    ? ` · ${pending} invitation${pending > 1 ? "s" : ""} en attente`
                    : ""
                }`
              : `Créé le ${dateFr(space.createdAt)} avec votre compte`}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {!space.isActive && (
            <button
              type="button"
              onClick={actions.onSwitch}
              className="border-border-strong hover:bg-accent flex h-[31px] items-center justify-center rounded-[9px] border px-3.5 text-xs font-medium whitespace-nowrap"
            >
              Basculer ici
            </button>
          )}
          <SpaceMenu space={space} actions={actions} />
        </div>
      </div>

      <div className="border-border bg-surface-2 grid grid-cols-4 border-t">
        <Stat
          value={space.counts.accounts}
          singular="Compte"
          plural="Comptes"
        />
        <Stat
          value={space.counts.categories}
          singular="Catégorie"
          plural="Catégories"
        />
        <Stat
          value={space.counts.transactions}
          singular="Transaction"
          plural="Transactions"
        />
        <Stat value={space.counts.members} singular="Membre" plural="Membres" />
      </div>

      {shared && !alone && (
        <div className="border-border flex flex-col border-t">
          <SectionLabel
            label="Membres"
            note={
              space.counts.members > 1
                ? `${space.counts.members} personnes voient les mêmes comptes`
                : "1 personne"
            }
          />
          {space.members.map((member) => (
            <div
              key={member.userId}
              className="border-border grid min-h-11 grid-cols-[minmax(0,1fr)_106px_132px_78px] items-center gap-3.5 border-t px-4"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[13px] font-medium">
                    {member.name}
                  </span>
                  {member.isMe && (
                    <Pill className="bg-surface-2 text-subtle flex-none font-medium">
                      vous
                    </Pill>
                  )}
                </div>
                <div className="text-subtle truncate text-[11.5px]">
                  {member.email}
                </div>
              </div>
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                {member.role === "owner" ? (
                  <KeyRoundIcon className="text-primary size-3.5" />
                ) : (
                  <UserIcon className="text-subtle size-3.5" />
                )}
                {member.role === "owner" ? "Propriétaire" : "Membre"}
              </span>
              <span className="text-subtle num text-[11.5px]">
                depuis le {dateFr(member.since)}
              </span>
              {/* Se retirer soi-même, c'est « Quitter » : même ligne, autre
                  procédure — l'une part du propriétaire, l'autre de soi. */}
              {(member.isMe || owner) && (
                <button
                  type="button"
                  onClick={() =>
                    member.isMe
                      ? actions.onLeave()
                      : actions.onRemoveMember(member)
                  }
                  className="text-muted-foreground hover:text-bad justify-self-end text-xs"
                >
                  {member.isMe ? "Quitter" : "Retirer"}
                </button>
              )}
            </div>
          ))}

          {space.invitations.length > 0 && (
            <>
              <SectionLabel
                label="Invitations"
                note={
                  pending > 0
                    ? "le lien expire au bout de 7 jours"
                    : "aucune invitation active"
                }
                bordered
              />
              {space.invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="border-border grid min-h-11 grid-cols-[minmax(0,1fr)_106px_132px_auto] items-center gap-3.5 border-t px-4"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px]">
                      {invitation.email}
                    </div>
                    <div className="text-subtle truncate text-[11.5px]">
                      invitée par {invitation.invitedBy}
                    </div>
                  </div>
                  <Pill
                    className={cn(
                      "w-max font-semibold",
                      STATUS_STYLE[invitation.status],
                    )}
                  >
                    {STATUS_LABEL[invitation.status]}
                  </Pill>
                  <span
                    className={cn(
                      "num text-[11.5px]",
                      invitation.status === "expired"
                        ? "text-bad"
                        : "text-subtle",
                    )}
                  >
                    {invitation.status === "expired"
                      ? `expirée le ${dateFr(invitation.expiresAt)}`
                      : invitation.status === "pending"
                        ? `expire le ${dateFr(invitation.expiresAt)}`
                        : ""}
                  </span>
                  <div className="flex items-center justify-end gap-3">
                    {owner &&
                      (invitation.status === "pending" ||
                        invitation.status === "expired") && (
                        <button
                          type="button"
                          onClick={() => actions.onResendInvitation(invitation)}
                          className="text-primary text-xs whitespace-nowrap"
                        >
                          {invitation.status === "expired"
                            ? "Renvoyer une invitation"
                            : "Renvoyer"}
                        </button>
                      )}
                    {owner && invitation.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => actions.onCancelInvitation(invitation)}
                        className="text-muted-foreground hover:text-bad text-xs whitespace-nowrap"
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {owner && (
            <InviteForm
              value={invite}
              onChange={onInviteChange}
              onSubmit={() => actions.onInvite(invite.email, invite.role)}
            />
          )}

          {space.consents.length > 0 && space.counts.members > 1 && (
            <div className="border-border flex items-start gap-2.5 border-t px-4 py-3">
              <ShieldCheckIcon className="text-subtle mt-px size-3.5 flex-none" />
              <div className="text-muted-foreground text-xs text-pretty">
                {space.consents.map((consent, index) => (
                  <span key={consent.bankName}>
                    {index > 0 && " "}
                    L'accès bancaire de{" "}
                    <span className="text-foreground font-medium">
                      {consent.bankName}
                    </span>{" "}
                    a été autorisé par{" "}
                    <span className="text-foreground font-medium">
                      {consent.authorizedBy}
                    </span>
                    .
                  </span>
                ))}{" "}
                Tous les membres voient les opérations, mais seule cette
                personne peut renouveler l'autorisation, tous les six mois
                environ.
              </div>
            </div>
          )}
        </div>
      )}

      {alone && (
        <div className="border-border flex flex-col items-center gap-3 border-t px-4 py-6">
          <span className="text-subtle max-w-[420px] text-center text-xs text-pretty">
            Personne d'autre dans cet espace. Invitez quelqu'un par email : la
            personne verra les mêmes comptes et les mêmes catégories que vous.
          </span>
          {owner && (
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <input
                value={invite.email}
                onChange={(e) =>
                  onInviteChange({ ...invite, email: e.target.value })
                }
                placeholder="adresse email"
                className="border-border-strong bg-background focus:border-primary h-[31px] w-[250px] rounded-[9px] border px-3 text-[12.5px] outline-none"
              />
              <button
                type="button"
                onClick={() => actions.onInvite(invite.email, invite.role)}
                className="bg-primary text-primary-foreground flex h-[31px] items-center justify-center rounded-[9px] px-3.5 text-xs font-semibold whitespace-nowrap"
              >
                Inviter
              </button>
            </div>
          )}
        </div>
      )}

      {!shared && (
        <div className="border-border flex items-start gap-2.5 border-t px-4 py-3">
          <LockIcon className="text-subtle mt-px size-3.5 flex-none" />
          <div className="text-muted-foreground text-xs text-pretty">
            Espace personnel : un seul membre, créé avec votre compte. Il peut
            devenir un espace partagé — vous le renommez et vous invitez
            quelqu'un, tout ce qu'il contient reste en place. L'opération ne se
            défait pas.
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Le menu « … » d'une carte. Ses entrées dépendent de la nature de l'espace :
 * seul un espace personnel se partage, seul un espace partagé se quitte. La
 * suppression y figure toujours — pour l'espace personnel elle ouvre le
 * dialogue qui explique pourquoi elle n'aura pas lieu, plutôt que de laisser
 * chercher une entrée absente.
 */
function SpaceMenu({
  space,
  actions,
}: {
  space: Space;
  actions: SpaceCardActions;
}) {
  const [open, setOpen] = useState(false);
  const owner = space.role === "owner";
  const close = (run: () => void) => () => {
    setOpen(false);
    run();
  };

  const items = [
    owner && {
      key: "rename",
      label: "Renommer l'espace",
      icon: <PencilIcon className="size-3.5" />,
      onSelect: close(actions.onRename),
    },
    owner &&
      space.isPersonal && {
        key: "share",
        label: "Passer en espace partagé",
        icon: <UsersIcon className="size-3.5" />,
        onSelect: close(actions.onShare),
      },
    !space.isPersonal && {
      key: "leave",
      label: "Quitter l'espace",
      icon: <LogOutIcon className="size-3.5" />,
      onSelect: close(actions.onLeave),
    },
    owner && {
      key: "delete",
      label: "Supprimer l'espace",
      icon: <Trash2Icon className="size-3.5" />,
      danger: !space.isPersonal,
      onSelect: close(actions.onDelete),
    },
  ].filter((item) => item !== false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(props) => (
          <button
            type="button"
            title="Actions"
            aria-label={`Actions sur l'espace ${space.name}`}
            className="text-subtle hover:bg-accent hover:text-foreground flex size-7 items-center justify-center rounded-lg"
            {...props}
          >
            <EllipsisIcon className="size-4" />
          </button>
        )}
      />
      <PopoverContent align="end" className="w-[226px] gap-0 p-1.5">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.onSelect}
            className={cn(
              "hover:bg-accent flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-1.5 text-[12.5px]",
              item.danger ? "text-bad" : "text-foreground",
            )}
          >
            <span
              className={cn("flex", item.danger ? "text-bad" : "text-subtle")}
            >
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function InviteForm({
  value,
  onChange,
  onSubmit,
}: {
  value: { email: string; role: SpaceRole };
  onChange: (next: { email: string; role: SpaceRole }) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="border-border bg-surface-2 flex flex-wrap items-center gap-2.5 border-t px-4 py-3">
      <input
        value={value.email}
        onChange={(e) => onChange({ ...value, email: e.target.value })}
        placeholder="adresse email"
        className="border-border-strong bg-background focus:border-primary h-[31px] min-w-[220px] flex-1 rounded-[9px] border px-3 text-[12.5px] outline-none"
      />
      <div className="bg-surface-2 border-border flex flex-none rounded-[9px] border p-0.5">
        {(["member", "owner"] as const).map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => onChange({ ...value, role })}
            className={cn(
              "h-[25px] rounded-[7px] border px-3 text-[11.5px]",
              value.role === role
                ? "bg-card border-border font-semibold"
                : "text-muted-foreground border-transparent",
            )}
          >
            {role === "member" ? "Membre" : "Propriétaire"}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onSubmit}
        className="border-border-strong hover:bg-accent flex h-[31px] flex-none items-center justify-center rounded-[9px] border px-3.5 text-xs font-semibold whitespace-nowrap"
      >
        Envoyer l'invitation
      </button>
      <span className="text-subtle flex-none text-[11.5px] whitespace-nowrap">
        le lien vaut 7 jours
      </span>
    </div>
  );
}

function Stat({
  value,
  singular,
  plural,
}: {
  value: number;
  singular: string;
  plural: string;
}) {
  return (
    <div className="border-border border-r px-4 py-2.5 last:border-r-0">
      <div className="num text-sm font-medium tracking-[-0.01em]">
        {value.toLocaleString("fr-FR")}
      </div>
      <div className="label-caps mt-0.5">{value > 1 ? plural : singular}</div>
    </div>
  );
}

function SectionLabel({
  label,
  note,
  bordered,
}: {
  label: string;
  note: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline gap-2.5 px-4 pt-3.5 pb-2",
        bordered && "border-border border-t",
      )}
    >
      <span className="label-caps">{label}</span>
      <span className="text-subtle text-[11.5px]">{note}</span>
    </div>
  );
}

function Pill({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex h-[19px] items-center rounded-full px-2 text-[10.5px]",
        className,
      )}
    >
      {children}
    </span>
  );
}
