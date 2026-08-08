"use client";

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
import { Badge } from "@budget/ui/badge";
import { Button } from "@budget/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@budget/ui/dropdown-menu";
import { Input } from "@budget/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@budget/ui/toggle-group";

import { dateFr } from "../-lib/format";

/** Variante de `Badge` portant le statut d'une invitation. */
const STATUS_VARIANT: Record<
  SpaceInvitation["status"],
  "warn" | "ok" | "destructive" | "secondary"
> = {
  pending: "warn",
  accepted: "ok",
  expired: "destructive",
  canceled: "secondary",
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
            {space.isActive && <Badge>Espace actif</Badge>}
            <Badge variant="outline">{owner ? "Propriétaire" : "Membre"}</Badge>
            {!shared && <Badge variant="secondary">Personnel</Badge>}
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
            <Button variant="outline" size="sm" onClick={actions.onSwitch}>
              Basculer ici
            </Button>
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
                    <Badge variant="secondary" className="flex-none">
                      vous
                    </Badge>
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
                <Button
                  variant="link"
                  size="xs"
                  className="justify-self-end"
                  onClick={() =>
                    member.isMe
                      ? actions.onLeave()
                      : actions.onRemoveMember(member)
                  }
                >
                  {member.isMe ? "Quitter" : "Retirer"}
                </Button>
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
                  <Badge
                    variant={STATUS_VARIANT[invitation.status]}
                    className="w-max"
                  >
                    {STATUS_LABEL[invitation.status]}
                  </Badge>
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
                        <Button
                          variant="link"
                          size="xs"
                          onClick={() => actions.onResendInvitation(invitation)}
                        >
                          {invitation.status === "expired"
                            ? "Renvoyer une invitation"
                            : "Renvoyer"}
                        </Button>
                      )}
                    {owner && invitation.status === "pending" && (
                      <Button
                        variant="link"
                        size="xs"
                        onClick={() => actions.onCancelInvitation(invitation)}
                      >
                        Annuler
                      </Button>
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
              <Input
                type="email"
                value={invite.email}
                onChange={(e) =>
                  onInviteChange({ ...invite, email: e.target.value })
                }
                placeholder="adresse email"
                className="w-[250px]"
              />
              <Button
                size="sm"
                onClick={() => actions.onInvite(invite.email, invite.role)}
              >
                Inviter
              </Button>
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
  const owner = space.role === "owner";

  // Une entrée referme le menu d'elle-même : le `close()` qui enveloppait
  // chaque action a disparu avec l'état local d'ouverture.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            title="Actions"
            aria-label={`Actions sur l'espace ${space.name}`}
          />
        }
      >
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {owner && (
          <DropdownMenuItem onClick={actions.onRename}>
            <PencilIcon />
            Renommer l&apos;espace
          </DropdownMenuItem>
        )}
        {owner && space.isPersonal && (
          <DropdownMenuItem onClick={actions.onShare}>
            <UsersIcon />
            Passer en espace partagé
          </DropdownMenuItem>
        )}
        {!space.isPersonal && (
          <DropdownMenuItem onClick={actions.onLeave}>
            <LogOutIcon />
            Quitter l&apos;espace
          </DropdownMenuItem>
        )}
        {owner && (
          // L'espace personnel ne se supprime pas : l'entrée ouvre le dialogue
          // qui l'explique, elle n'annonce donc pas une destruction.
          <DropdownMenuItem
            variant={space.isPersonal ? "default" : "destructive"}
            onClick={actions.onDelete}
          >
            <Trash2Icon />
            Supprimer l&apos;espace
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
      <Input
        type="email"
        value={value.email}
        onChange={(e) => onChange({ ...value, email: e.target.value })}
        placeholder="adresse email"
        className="min-w-[220px] flex-1"
      />
      {/* `outline` + `spacing={0}` : le segmenté de la maquette. Sans eux, la
          variante par défaut est sans bordure et son état actif (`bg-muted`)
          ne se distingue pas du fond de la carte. */}
      <ToggleGroup
        variant="outline"
        spacing={0}
        value={[value.role]}
        onValueChange={([role]) =>
          role && onChange({ ...value, role: role as SpaceRole })
        }
        className="flex-none"
      >
        <ToggleGroupItem value="member">Membre</ToggleGroupItem>
        <ToggleGroupItem value="owner">Propriétaire</ToggleGroupItem>
      </ToggleGroup>
      <Button
        variant="outline"
        size="sm"
        className="flex-none"
        onClick={onSubmit}
      >
        Envoyer l&apos;invitation
      </Button>
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
