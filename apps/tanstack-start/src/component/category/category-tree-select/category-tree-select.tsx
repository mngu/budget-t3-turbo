import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import type { SelectProps } from "@budget/ui/select";
import { Select, SelectContent, SelectTrigger } from "@budget/ui/select";

import { useTRPC } from "~/lib/trpc";
import {
  CategorySelectValue,
  CategoryTreeSelectItems,
} from "./category-tree-select-items";

// La largeur diffère selon l'appelant (w-56 pour le filtre, w-48 pour la
// cellule du tableau) : elle reste à l'appelant, pas codée en dur ici.
type CategoryTreeSelectProps = Omit<SelectProps, "children"> & {
  className?: string;
  placeholder?: string;
};

// Variante autonome : le composant va chercher l'arborescence lui-même, au lieu
// de la recevoir du loader de route. CategorySelectValue et
// CategoryTreeSelectItems restent volontairement pilotés par props — ils
// restent purs et testables, et le fetch n'existe qu'ici.
//
// useSuspenseQuery et non useQuery : pas d'état de chargement à gérer dans le
// trigger. Cache vide, le composant fetch tout seul.
//
// EN REVANCHE son rafraîchissement après mutation dépend du loader de la route
// hôte, qui doit alimenter le cache :
//
//   context.queryClient.fetchQuery({
//     ...context.trpc.categories.tree.queryOptions(),
//     staleTime: 0,
//   })
//
// `router.invalidate()` rejoue les loaders, donc cette ligne suffit à propager
// un renommage / une suppression / un changement de couleur jusqu'ici, sans
// disséminer des invalidateQueries dans les mutations. Sans elle, le Select
// fonctionne mais reste figé sur la première réponse.
//
// `fetchQuery` et surtout pas `ensureQueryData` : ce dernier renvoie le cache
// sans refetch (query-core, queryClient.ensureQueryData), le loader rejouerait
// dans le vide et la panne serait silencieuse. Le `staleTime: 0` explicite met
// la route à l'abri d'un défaut global qu'on ajouterait plus tard dans
// router.tsx.
export function CategoryTreeSelect({
  className,
  placeholder = "Catégorie",
  onOpenChange,
  ...props
}: CategoryTreeSelectProps) {
  const trpc = useTRPC();
  const { data: categories } = useSuspenseQuery(
    trpc.categories.tree.queryOptions(),
  );
  // La liste n'est montée qu'à la première ouverture : le tableau des
  // transactions rend une cellule Catégorie par ligne (25 par page), et chacune
  // instanciait un SelectItem par catégorie et sous-catégorie — des centaines
  // de composants dont l'utilisateur n'en ouvre jamais qu'un. Une fois montée
  // elle le reste, les réouvertures sont immédiates.
  const [listMounted, setListMounted] = useState(false);

  return (
    <Select
      {...props}
      onOpenChange={(open, details) => {
        if (open) setListMounted(true);
        onOpenChange?.(open, details);
      }}
    >
      <SelectTrigger className={className}>
        <CategorySelectValue
          categories={categories}
          placeholder={placeholder}
        />
      </SelectTrigger>
      {listMounted && (
        // Dropdown classique sous le trigger, et non l'ancrage par défaut de
        // SelectContent (`alignItemWithTrigger`), qui positionne le popup par
        // rapport à l'élément sélectionné : ce dernier exigerait que la liste
        // soit déjà montée à l'ouverture, ce qui est précisément ce qu'on
        // évite ici. L'ancrage ne dépend plus que du trigger.
        <SelectContent alignItemWithTrigger={false} align="start">
          <CategoryTreeSelectItems categories={categories} />
        </SelectContent>
      )}
    </Select>
  );
}
