"use client";

import type {
  Space,
  SpaceInvitation,
  SpaceMember,
  SpaceRole,
} from "@budget/api";

import {
  Button,
  Chip,
  Dropdown,
  Input,
  Label,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import {
  EllipsisIcon,
  KeyRoundIcon,
  LogOutIcon,
  PencilIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
} from "lucide-react";

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
  invite: { email: string; role: SpaceRole };
  onInviteChange: (next: { email: string; role: SpaceRole }) => void;
  actions: SpaceCardActions;
}) {
  const shared = !space.isPersonal;
  const owner = space.role === "owner";

  return (
    <div className="bg-surface border-border overflow-hidden rounded-lg border">
      <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3.5 px-4 py-3.5">
        <span className="bg-surface-secondary text-muted flex size-9 items-center justify-center rounded-md">
          {shared ? (
            <UsersIcon className="size-4" />
          ) : (
            <UserIcon className="size-4" />
          )}
        </span>

        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span className="text-subheading">{space.name}</span>
          {space.isActive && (
            <Chip color="accent" size="sm">
              Espace actif
            </Chip>
          )}
          <Chip size="sm" variant="tertiary">
            {owner ? "Propriétaire" : "Membre"}
          </Chip>
          {!shared && <Chip size="sm">Personnel</Chip>}
        </div>

        <div className="flex items-center gap-2.5">
          {!space.isActive && (
            <Button variant="outline" size="sm" onPress={actions.onSwitch}>
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
                    <Chip size="sm" className="flex-none">
                      vous
                    </Chip>
                  )}
                </div>
                <div className="text-muted text-control truncate">
                  {member.email}
                </div>
              </div>
              <span className="text-muted text-control flex items-center gap-1.5">
                {member.role === "owner" ? (
                  <KeyRoundIcon className="text-accent size-3.5" />
                ) : (
                  <UserIcon className="text-muted size-3.5" />
                )}
                {member.role === "owner" ? "Propriétaire" : "Membre"}
              </span>
              {owner && !member.isMe && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-self-end"
                  onPress={() => actions.onRemoveMember(member)}
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
                        variant="ghost"
                        size="sm"
                        onPress={() => actions.onResendInvitation(invitation)}
                      >
                        Renvoyer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => actions.onCancelInvitation(invitation)}
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

// Keep deletion discoverable for personal spaces; its dialog explains why it is unavailable.
function SpaceMenu({
  space,
  actions,
}: {
  space: Space;
  actions: SpaceCardActions;
}) {
  const owner = space.role === "owner";

  return (
    <Dropdown>
      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        aria-label={`Actions sur l'espace ${space.name}`}
      >
        <EllipsisIcon />
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label={`Actions sur l'espace ${space.name}`}>
          {owner && (
            <Dropdown.Item textValue="Renommer" onAction={actions.onRename}>
              <PencilIcon />
              <Label>Renommer l&apos;espace</Label>
            </Dropdown.Item>
          )}
          {owner && space.isPersonal && (
            <Dropdown.Item textValue="Partager" onAction={actions.onShare}>
              <UsersIcon />
              <Label>Passer en espace partagé</Label>
            </Dropdown.Item>
          )}
          {!space.isPersonal && (
            <Dropdown.Item textValue="Quitter" onAction={actions.onLeave}>
              <LogOutIcon />
              <Label>Quitter l&apos;espace</Label>
            </Dropdown.Item>
          )}
          {owner && (
            <Dropdown.Item
              textValue="Supprimer"
              variant={space.isPersonal ? "default" : "danger"}
              onAction={actions.onDelete}
            >
              <Trash2Icon />
              <Label>Supprimer l&apos;espace</Label>
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
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
    <div className="border-border bg-surface-secondary flex flex-wrap items-center gap-2.5 border-t px-4 py-3">
      <Input
        type="email"
        value={value.email}
        onChange={(e) => onChange({ ...value, email: e.target.value })}
        placeholder="adresse email"
        aria-label="Adresse email à inviter"
        className="min-w-55 flex-1"
      />
      <ToggleButtonGroup
        aria-label="Rôle"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[value.role]}
        onSelectionChange={(keys) => {
          const [role] = keys;
          onChange({ ...value, role: role as SpaceRole });
        }}
        size="sm"
        className="flex-none"
      >
        <ToggleButton id="member">Membre</ToggleButton>
        <ToggleButton id="owner">
          <ToggleButtonGroup.Separator />
          Propriétaire
        </ToggleButton>
      </ToggleButtonGroup>
      <Button
        variant="outline"
        size="sm"
        className="flex-none"
        onPress={onSubmit}
      >
        Envoyer l&apos;invitation
      </Button>
    </div>
  );
}
