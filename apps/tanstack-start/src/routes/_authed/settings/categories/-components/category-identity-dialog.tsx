"use client";

import { useState } from "react";
import { InfoIcon } from "lucide-react";

import {
  CATEGORY_COLOR_PALETTE,
  FALLBACK_CATEGORY_COLOR,
  searchCategoryIcons,
} from "@budget/shared";
import { cn } from "@budget/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@budget/ui/dialog";
import { Input } from "@budget/ui/input";

import { softCategoryColor, useCategoryColor } from "~/lib/category-color";
import { CategoryIcon } from "./category-icon";

export interface IdentityTarget {
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
}

interface CategoryIdentityDialogProps {
  target: IdentityTarget | null;
  onOpenChange: (open: boolean) => void;
  /** Nom de la (des) autre(s) parente(s) portant chaque teinte. */
  ownersByColor: Map<string, string[]>;
  /** Nombre de parentes portant chaque icône — sert la pastille « déjà prise ». */
  usageByIcon: Map<string, number>;
  onColorChange: (hex: string) => void;
  onIconChange: (icon: string | null) => void;
}

/**
 * Identité d'une catégorie parente : sa teinte et son icône, choisies ici et
 * nulle part ailleurs. Les deux se complètent — la couleur porte l'identité là
 * où il n'y a pas la place d'une icône (segments de barre, pastilles), l'icône
 * partout où il y a au moins 20 px.
 *
 * Deux règles de la maquette à ne pas défaire :
 *  - la palette est **fermée à 13 teintes** et il y a plus de catégories que de
 *    teintes possibles : choisir une teinte déjà prise est donc *permis*, pas
 *    une erreur. La collision est signalée (pastille, note de bas de modale) et
 *    c'est l'icône qui distingue les deux catégories ;
 *  - le gris de repli n'est **pas sélectionnable** : c'est l'état « aucune
 *    couleur choisie », pas une 14e couleur (voir colors.ts, il échoue les
 *    seuils de séparation de la palette).
 */
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
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) setQuery("");
        onOpenChange(open);
      }}
    >
      <DialogContent padded={false} className="max-w-130 overflow-hidden">
        <DialogHeader className="flex-none flex-row items-center gap-3 border-b p-4">
          <span
            className="flex size-8 flex-none items-center justify-center rounded-md"
            style={
              target?.color
                ? {
                    background: softCategoryColor(resolve(target.color)),
                    color: resolve(target.color),
                  }
                : { background: "var(--sunken)", color: "var(--subtle)" }
            }
          >
            <CategoryIcon name={target?.icon ?? null} />
          </span>
          <div>
            <DialogTitle className="text-body font-semibold">
              {target?.name}
            </DialogTitle>
            <DialogDescription className="text-subtle text-meta">
              Identité de la catégorie · couleur + icône
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto p-4">
          <div className="flex items-baseline gap-2.5">
            <span className="label-caps">Couleur</span>
            <span className="text-muted-foreground text-meta">
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
                    className="text-primary-foreground text-label flex size-4 items-center justify-center rounded-full"
                    style={{ background: resolve(c.light) }}
                  >
                    {mine && "✓"}
                  </span>
                  {others.length > 0 && (
                    <span className="bg-card text-muted-foreground border-border text-label absolute top-1 right-1 flex size-3 items-center justify-center rounded-full border leading-none">
                      ●
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-muted-foreground text-control mt-2.5 flex items-start gap-2.5">
            <InfoIcon className="mt-px size-3.5 flex-none" />
            <span className="min-w-0 text-pretty">
              Un point sur une teinte signale qu'elle est déjà portée par une
              autre parente. Choisir une teinte prise est permis — la ligne
              affichera « même teinte que… », et l'icône devient ce qui
              distingue les deux.
            </span>
          </p>

          <div className="border-border-strong mt-3 flex items-center gap-2.5 rounded-md border border-dashed px-3 py-2.5">
            <span
              className="size-4 flex-none rounded-full"
              style={{ background: FALLBACK_CATEGORY_COLOR }}
            />
            <div className="min-w-0">
              <div className="text-control font-medium">Gris de repli</div>
              <div className="text-subtle text-meta text-pretty">
                État « aucune couleur choisie ». Non sélectionnable — il
                disparaît dès qu'une teinte est prise.
              </div>
            </div>
          </div>

          <div className="bg-border my-4 h-px" />

          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="label-caps">Icône</span>
            <span className="text-muted-foreground text-meta">
              {target?.icon
                ? "jeu thématique de 54 icônes Lucide · recherche en français"
                : "aucune icône — pastille creuse"}
            </span>
          </div>

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher en français — courses, loyer, essence, impôts…"
            aria-label="Chercher une icône"
            className="bg-background border-border-strong text-control mt-2.5 h-8 rounded-md"
          />

          <div className="mt-3 flex flex-col gap-3">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="text-subtle text-meta mb-1.5">
                  {group.label}
                </div>
                <div className="grid grid-cols-9 gap-1.5">
                  {group.icons.map((icon) => {
                    const selected = target?.icon === icon.name;
                    // « Déjà prise » ne bloque pas : deux catégories peuvent
                    // partager une icône si leurs teintes diffèrent.
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
                            ? "border-primary bg-accent-soft text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-border-strong hover:text-foreground",
                        )}
                      >
                        <CategoryIcon name={icon.name} />
                        {duplicate && (
                          <span className="bg-warn absolute right-1 bottom-0.5 size-1 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <p className="text-muted-foreground text-control text-pretty">
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
            className="border-border-strong text-muted-foreground hover:bg-accent hover:text-foreground text-control mt-3 flex w-full items-center gap-2.5 rounded-md border border-dashed px-2.5 py-1.5"
          >
            <span className="border-border-strong flex size-6 flex-none items-center justify-center rounded-md border border-dashed">
              <CategoryIcon name={null} className="size-3.5" />
            </span>
            Sans icône — pastille creuse, la couleur travaille seule
          </button>
        </div>

        {target?.color && twin && (
          <DialogFooter>
            <span
              className="flex size-7 flex-none items-center justify-center rounded-lg"
              style={{
                background: softCategoryColor(resolve(target.color)),
                color: resolve(target.color),
              }}
            >
              <CategoryIcon name={target.icon} className="size-3.5" />
            </span>
            <span className="min-w-0">
              Même teinte que{" "}
              <span className="text-foreground font-medium">{twin}</span> —
              c'est l'icône qui les distingue.
            </span>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
