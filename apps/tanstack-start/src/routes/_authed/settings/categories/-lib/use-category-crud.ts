import { useState } from "react";

import { toast } from "@budget/ui/toast";
import { useTRPCClient } from "~/lib/trpc";

import { useRun } from "./use-run";

export interface DeleteTarget {
  id: number;
  name: string;
  /** Total cumulé — sous-catégories comprises pour une parente. */
  transactionCount: number;
  childCount: number;
  childNames: string[];
}

export interface IdentityTarget {
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
}

/**
 * La gestion courante de l'arborescence : créer, renommer, supprimer, et
 * l'identité (teinte + icône) d'une parente.
 */
export function useCategoryCrud() {
  const trpcClient = useTRPCClient();
  const run = useRun();

  const [identityTarget, setIdentityTarget] = useState<IdentityTarget | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const create = (name: string, parentId: number | null) =>
    void run(
      () => trpcClient.categories.create.mutate({ name, parentId }),
      "Échec de la création.",
    );

  return {
    identityTarget,
    deleteTarget,
    deleting,

    onRename: async (id: number, name: string) =>
      (await run(
        () => trpcClient.categories.rename.mutate({ id, name }),
        "Échec du renommage.",
      )) !== null,
    onOpenIdentity: (node: IdentityTarget) => setIdentityTarget(node),
    onDelete: (node: DeleteTarget) => setDeleteTarget(node),
    onAddChild: (parentId: number) =>
      create("Nouvelle sous-catégorie", parentId),
    onAddParent: () => create("Nouvelle catégorie", null),

    closeIdentity: () => setIdentityTarget(null),
    closeDelete: () => setDeleteTarget(null),

    // La cible est remise à jour localement avant la mutation : la modale
    // reflète le choix tout de suite, le loader confirmera.
    changeColor: (color: string) => {
      if (!identityTarget) return;
      setIdentityTarget({ ...identityTarget, color });
      void run(
        () =>
          trpcClient.categories.updateColor.mutate({
            id: identityTarget.id,
            color,
          }),
        "Échec du changement de couleur.",
      );
    },
    changeIcon: (icon: string | null) => {
      if (!identityTarget) return;
      setIdentityTarget({ ...identityTarget, icon });
      void run(
        () =>
          trpcClient.categories.updateIcon.mutate({
            id: identityTarget.id,
            icon,
          }),
        "Échec du changement d'icône.",
      );
    },

    confirmDelete: async () => {
      if (!deleteTarget) return;
      setDeleting(true);
      const done = await run(
        () => trpcClient.categories.remove.mutate({ id: deleteTarget.id }),
        "Échec de la suppression.",
      );
      if (done !== null) {
        toast.success(`« ${deleteTarget.name} » supprimée.`);
        setDeleteTarget(null);
      }
      setDeleting(false);
    },
  };
}
