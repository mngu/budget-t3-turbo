import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { CircleCheckIcon } from "lucide-react";

import { Button } from "@budget/ui/button";
import { toast } from "@budget/ui/toast";

import { Stat } from "~/component/stat";
import { euro0 } from "~/lib/format";
import { useTRPCClient } from "~/lib/trpc";
import { BudgetTree } from "./-components/budget-tree";

export const Route = createFileRoute("/_authed/settings/budgets/")({
  loader: async ({ context }) => {
    const [tree, budgets] = await Promise.all([
      context.trpcClient.categories.tree.query(),
      context.trpcClient.categories.budgets.plan.query(),
    ]);
    const unbudgeted = budgets.slots - budgets.budgeted;
    return { tree, budgets, unbudgeted };
  },
  staticData: { title: "Budgets", aside: BudgetsAside },
  component: BudgetsPage,
});

function BudgetsAside() {
  const { budgets, unbudgeted } = Route.useLoaderData();
  return (
    <div className="ml-auto flex items-stretch">
      <Stat value={euro0.format(budgets.total)} label="Budgété / mois" />
      <Stat
        value={`${budgets.budgeted} / ${budgets.slots}`}
        label="Postes budgétés"
      />
      <Stat value={unbudgeted} label="Sans budget" warn={unbudgeted > 0} />
    </div>
  );
}

function BudgetsPage() {
  const { tree, budgets, unbudgeted } = Route.useLoaderData();
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [expandAll, setExpandAll] = useState<boolean | null>(null);

  // Chaque saisie écrit tout de suite et relance le loader : les compteurs
  // d'en-tête viennent du serveur (voir budgetSlots) et suivent sans état local.
  const run = async (action: () => Promise<unknown>, fallback: string) => {
    try {
      await action();
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : fallback);
    }
  };

  return (
    <>
      <p className="text-muted-foreground text-control mt-2 max-w-160 text-pretty">
        Un budget mensuel se pose sur une{" "}
        <span className="text-foreground font-medium">catégorie</span>. Si vous
        voulez être plus précis,{" "}
        <span className="text-foreground font-medium">détaillez-la</span> :
        chaque sous-catégorie reçoit alors son montant, et la catégorie affiche
        leur somme. Un budget non consommé n'est pas reporté au mois suivant.
      </p>

      {budgets.slots > 0 && unbudgeted === 0 && (
        <section className="bg-card mt-5 flex flex-wrap items-center gap-3.5 rounded-xl border px-4 py-3.5">
          <CircleCheckIcon className="text-ok size-4 flex-none" />
          <div className="min-w-65 flex-1">
            <h2 className="text-control font-medium">
              Tous vos postes ont un budget
            </h2>
            <p className="text-subtle text-control mt-0.5">
              {euro0.format(budgets.total)} par mois sur {budgets.slots} postes
              budgétés.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void run(
                () => trpcClient.categories.budgets.clear.mutate(),
                "Échec de la remise à zéro.",
              )
            }
          >
            Tout vider
          </Button>
        </section>
      )}

      <div className="mt-7 mb-3 flex flex-wrap items-center gap-2.5">
        <h2 className="text-heading">Vos catégories</h2>
        <span className="text-subtle text-control">
          {tree.length === 0
            ? "aucune catégorie pour le moment"
            : "un budget se pose sur une catégorie ; « détailler » le répartit sur ses sous-catégories"}
        </span>
        {tree.length > 0 && (
          <Button
            variant="outline"
            size="xs"
            className="ml-auto"
            onClick={() => setExpandAll((v) => (v === true ? false : true))}
          >
            Tout replier / déplier
          </Button>
        )}
      </div>

      <BudgetTree
        tree={tree}
        rows={new Map(budgets.rows.map((r) => [r.categoryId, r]))}
        expandAllSignal={expandAll}
        onSetAmount={(categoryId, amount) =>
          void run(
            () =>
              trpcClient.categories.budgets.set.mutate({
                categoryId,
                amount,
              }),
            "Échec de l'enregistrement du budget.",
          )
        }
        onSetDetailed={(categoryId, detailed) =>
          void run(
            () =>
              trpcClient.categories.budgets.setDetailed.mutate({
                categoryId,
                detailed,
              }),
            "Échec du changement de mode.",
          )
        }
      />

      {/* La maquette annonce ici un mois de départ (« s'applique à partir
              d'août 2026 ») : rien ne le porte en base, un budget est un montant
              mensuel sans date. La note ne dit que ce qui est vrai — d'où vient
              la moyenne, et pourquoi certains postes n'en reçoivent pas. */}
      <p className="text-subtle text-control mt-3.5 max-w-205 text-pretty">
        La moyenne de référence porte sur les 6 derniers mois complets, mois en
        cours exclu, et ne compte que les dépenses. Une catégorie vue moins de 4
        mois sur 6 ne reçoit pas de proposition : sa moyenne serait un chiffre
        inventé plutôt qu'une habitude — à saisir à la main, ou à laisser vide
        en attendant quelques mois.
      </p>
    </>
  );
}
