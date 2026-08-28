"use client";

import { useLoaderData } from "@tanstack/react-router";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@budget/ui/command";
import { CategoryIcon } from "~/component/category-icon";

import { SelectedCategory } from "./category-selector";

type CategoryPathPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nom de la catégorie actuellement portée par la transaction. */
  current?: SelectedCategory | null;
  onPick: (arg: SelectedCategory) => void;
};

export function CategoryPathPicker({
  open,
  onOpenChange,
  current,
  onPick,
}: CategoryPathPickerProps) {
  const { newOverview } = useLoaderData({
    from: "/_authed/_period-overview",
  });

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      showCloseButton
      className="w-120"
    >
      <CommandInput
        placeholder={`Filtrer parmi ${newOverview.length} catégories…`}
      />
      <CommandList>
        <CommandEmpty>Aucune catégorie ne correspond.</CommandEmpty>

        {newOverview.map((parent) => (
          <CommandGroup
            key={parent.id}
            heading={
              <span className="flex items-center gap-1.5">
                <CategoryIcon
                  name={parent.icon}
                  className="size-3"
                  color={parent.color}
                />
                {parent.name}
              </span>
            }
          >
            <CommandItem
              key={parent.id}
              value={`${parent.name} › Toute la catégorie`}
              data-checked={
                !current?.child && parent.name === current?.parent?.name
              }
              onSelect={() => {
                onPick({ parent });
                onOpenChange(false);
              }}
            >
              <span
                className="size-2.5 flex-none rounded-xs"
                style={{ background: parent.color ?? undefined }}
              />
              Toute la catégorie
            </CommandItem>
            {(parent.children ?? []).map((child) => (
              <CommandItem
                key={child.name}
                value={`${parent.name} › ${child.name}`}
                data-checked={child.name === current?.child?.name}
                onSelect={() => {
                  onOpenChange(false);
                  onPick({ parent, child });
                }}
              >
                <span
                  className="size-2.5 flex-none rounded-xs"
                  style={{ background: parent.color ?? undefined }}
                />
                {child.name}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
