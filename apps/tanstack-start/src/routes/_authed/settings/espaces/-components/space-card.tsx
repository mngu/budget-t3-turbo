"use client";

import type {
  Space,
  SpaceInvitation,
  SpaceMember,
  SpaceRole,
} from "@budget/api";

import {
  EllipsisIcon,
  KeyRoundIcon,
  LogOutIcon,
  PencilIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
} from "lucide-react";

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

  return (
    <div className="bg-card border-border-strong overflow-hidden rounded-lg border">
      <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3.5 px-4 py-3.5">
        <span className="bg-surface-2 text-subtle flex size-9 items-center justify-center rounded-md">
          {shared ? (
            <UsersIcon className="size-4" />
          ) : (
            <UserIcon className="size-4" />
          )}
        </span>

        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span className="text-subheading">{space.name}</span>
          {space.isActive && <Badge>Espace actif</Badge>}
          <Badge variant="outline">{owner ? "Propriétaire" : "Membre"}</Badge>
          {!shared && <Badge variant="secondary">Personnel</Badge>}
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

      {shared && (
        <div className="border-border flex flex-col border-t">
          <span className="label-caps px-4 pt-3.5 pb-2">Membres</span>
          {space.members.map((member) => (
            <div
              key={member.userId}
              className="border-border grid min-h-11 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3.5 border-t px-4 md:grid-cols-[minmax(0,1fr)_106px_78px]"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-body truncate font-medium">
                    {member.name}
                  </span>
                  {member.isMe && (
                    <Badge variant="secondary" className="flex-none">
                      vous
                    </Badge>
                  )}
                </div>
                <div className="text-subtle text-control truncate">
                  {member.email}
                </div>
              </div>
              <span className="text-muted-foreground text-control flex items-center gap-1.5">
                {member.role === "owner" ? (
                  <KeyRoundIcon className="text-primary size-3.5" />
                ) : (
                  <UserIcon className="text-subtle size-3.5" />
                )}
                {member.role === "owner" ? "Propriétaire" : "Membre"}
              </span>
              {/* Se retirer soi-même, c'est « Quitter », dans le menu. */}
              {owner && !member.isMe && (
                <Button
                  variant="link"
                  size="xs"
                  className="justify-self-end"
                  onClick={() => actions.onRemoveMember(member)}
                >
                  Retirer
                </Button>
              )}
            </div>
          ))}

          {space.invitations.length > 0 && (
            <>
              <span className="label-caps border-border border-t px-4 pt-3.5 pb-2">
                Invitations en attente
              </span>
              {space.invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="border-border grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 border-t px-4"
                >
                  <div className="text-body truncate">{invitation.email}</div>
                  {owner && (
                    <div className="flex items-center gap-3">
                      <Button
                        variant="link"
                        size="xs"
                        onClick={() => actions.onResendInvitation(invitation)}
                      >
                        Renvoyer
                      </Button>
                      <Button
                        variant="link"
                        size="xs"
                        onClick={() => actions.onCancelInvitation(invitation)}
                      >
                        Annuler
                      </Button>
                    </div>
                  )}
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
        className="min-w-55 flex-1"
      />
      <ToggleGroup
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
    </div>
  );
}
