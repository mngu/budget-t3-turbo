"use client";

import type { IdentityTarget } from "../-lib/use-category-crud";

import { Modal, SearchField } from "@heroui/react";
import { InfoIcon } from "lucide-react";
import { useState } from "react";

import {
  CATEGORY_COLOR_PALETTE,
  FALLBACK_CATEGORY_COLOR,
  searchCategoryIcons,
} from "@budget/shared";
import { cn } from "@budget/ui";
import { CategoryIcon } from "~/component/category-icon";
import { softCategoryColor, useCategoryColor } from "~/lib/category-color";

interface CategoryIdentityDialogProps {
  target: IdentityTarget | null;
  onOpenChange: (open: boolean) => void;
  /** Other parent categories using each color. */
  ownersByColor: Map<string, string[]>;
  /** Parent category count per icon, for the usage badge. */
  usageByIcon: Map<string, number>;
  onColorChange: (hex: string) => void;
  onIconChange: (icon: string | null) => void;
}

// Color collisions are allowed: the palette is finite, and icons distinguish categories.
export function CategoryIdentityDialog({
  target,
  onOpenChange,
  ownersByColor,
  usageByIcon,
  onColorChange,
  onIconChange,
}: CategoryIdentityDialogProps) {
  const [query, setQuery] = useState("");
  const resolve = useCategoryColor();

  const groups = searchCategoryIcons(query);
  const takenCount = ownersByColor.size;

  const otherOwners = (hex: string) =>
    (ownersByColor.get(hex) ?? []).filter((n) => n !== target?.name);
  const twin = target?.color ? otherOwners(target.color)[0] : undefined;

  return (
    <Modal.Backdrop
      isOpen={target !== null}
      onOpenChange={(open) => {
        if (!open) setQuery("");
        onOpenChange(open);
      }}
    >
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header className="flex-row items-center gap-3">
            <Modal.Icon
              className="flex size-8 flex-none items-center justify-center rounded-md"
              style={{
                background: target?.color
                  ? softCategoryColor(resolve(target.color))
                  : "var(--background-secondary)",
              }}
            >
              <CategoryIcon
                name={target?.icon ?? null}
                color={resolve(target?.color ? target.color : "var(--muted)")}
              />
            </Modal.Icon>
            <div>
              <Modal.Heading>{target?.name}</Modal.Heading>
              <p className="text-muted text-meta">
                Identité de la catégorie · couleur + icône
              </p>
            </div>
          </Modal.Header>

          <Modal.Body>
            <div className="flex items-baseline gap-2.5">
              <span className="label-caps">Couleur</span>
              <span className="text-muted text-meta">
                {takenCount >= CATEGORY_COLOR_PALETTE.length
                  ? `les ${CATEGORY_COLOR_PALETTE.length} teintes sont prises — toute nouvelle parente partagera une teinte`
                  : `${takenCount} teintes prises sur ${CATEGORY_COLOR_PALETTE.length}`}
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-7 gap-2">
              {CATEGORY_COLOR_PALETTE.map((c) => {
                const mine = target?.color === c.light;
                const others = otherOwners(c.light);
                return (
                  <button
                    key={c.light}
                    type="button"
                    title={
                      others.length > 0
                        ? `${c.name} — déjà pris par ${others.join(", ")}`
                        : `${c.name} — libre`
                    }
                    aria-label={c.name}
                    aria-pressed={mine}
                    onClick={() => onColorChange(c.light)}
                    className="relative flex h-11 items-center justify-center rounded-md border-[1.5px]"
                    style={{
                      background: softCategoryColor(resolve(c.light)),
                      borderColor: mine ? resolve(c.light) : "transparent",
                    }}
                  >
                    <span
                      className="text-accent-foreground text-label flex size-4 items-center justify-center rounded-full"
                      style={{ background: resolve(c.light) }}
                    >
                      {mine && "✓"}
                    </span>
                    {others.length > 0 && (
                      <span className="bg-surface text-muted border-border text-label absolute top-1 right-1 flex size-3 items-center justify-center rounded-full border leading-none">
                        ●
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="text-muted text-control mt-2.5 flex items-start gap-2.5">
              <InfoIcon className="mt-px size-3.5 flex-none" />
              <span className="min-w-0 text-pretty">
                Un point sur une teinte signale qu'elle est déjà portée par une
                autre parente. Choisir une teinte prise est permis — la ligne
                affichera « même teinte que… », et l'icône devient ce qui
                distingue les deux.
              </span>
            </p>

            <div className="border-border mt-3 flex items-center gap-2.5 rounded-md border border-dashed px-3 py-2.5">
              <span
                className="size-4 flex-none rounded-full"
                style={{ background: FALLBACK_CATEGORY_COLOR }}
              />
              <div className="min-w-0">
                <div className="text-control font-medium">Gris de repli</div>
                <div className="text-muted text-meta text-pretty">
                  État « aucune couleur choisie ». Non sélectionnable — il
                  disparaît dès qu'une teinte est prise.
                </div>
              </div>
            </div>

            <div className="bg-border my-4 h-px" />

            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="label-caps">Icône</span>
              <span className="text-muted text-meta">
                {target?.icon
                  ? "jeu thématique de 54 icônes Lucide · recherche en français"
                  : "aucune icône — pastille creuse"}
              </span>
            </div>

            <SearchField
              value={query}
              onChange={setQuery}
              aria-label="Chercher une icône"
              className="mt-2.5"
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Chercher en français — courses, loyer, essence, impôts…" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>

            <div className="mt-3 flex flex-col gap-3">
              {groups.map((group) => (
                <div key={group.label}>
                  <div className="text-muted text-meta mb-1.5">
                    {group.label}
                  </div>
                  <div className="grid grid-cols-9 gap-1.5">
                    {group.icons.map((icon) => {
                      const selected = target?.icon === icon.name;
                      const duplicate =
                        !selected && (usageByIcon.get(icon.name) ?? 0) > 0;
                      return (
                        <button
                          key={icon.name}
                          type="button"
                          title={`${icon.keywords.split(" ")[0]} · ${icon.name}`}
                          aria-label={icon.name}
                          aria-pressed={selected}
                          onClick={() => onIconChange(icon.name)}
                          className={cn(
                            "relative flex h-9 items-center justify-center rounded-md border",
                            selected
                              ? "border-accent bg-accent-soft text-accent"
                              : "border-border bg-background text-muted hover:border-border hover:text-foreground",
                          )}
                        >
                          <CategoryIcon name={icon.name} />
                          {duplicate && (
                            <span className="bg-warning absolute right-1 bottom-0.5 size-1 rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {groups.length === 0 && (
                <p className="text-muted text-control text-pretty">
                  Aucune icône pour « {query} ». La recherche accepte les mots
                  français du jeu thématique et les noms Lucide en anglais (
                  <span className="font-mono">piggy-bank</span>,{" "}
                  <span className="font-mono">landmark</span>…).
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onIconChange(null)}
              className="border-border text-muted hover:bg-default hover:text-foreground text-control mt-3 flex w-full items-center gap-2.5 rounded-md border border-dashed px-2.5 py-1.5"
            >
              <span className="border-border flex size-6 flex-none items-center justify-center rounded-md border border-dashed">
                <CategoryIcon name={null} className="size-3.5" />
              </span>
              Sans icône — pastille creuse, la couleur travaille seule
            </button>
          </Modal.Body>

          {target?.color && twin && (
            <Modal.Footer className="text-muted justify-start">
              <span
                className="flex size-7 flex-none items-center justify-center rounded-lg"
                style={{
                  background: softCategoryColor(resolve(target.color)),
                }}
              >
                <CategoryIcon
                  name={target.icon}
                  className="size-3.5"
                  color={resolve(target.color)}
                />
              </span>
              <span className="min-w-0">
                Même teinte que{" "}
                <span className="text-foreground font-medium">{twin}</span> —
                c'est l'icône qui les distingue.
              </span>
            </Modal.Footer>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
