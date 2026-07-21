import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon, PlusIcon } from "lucide-react";

import { Button } from "@budget/ui/button";

import { ConnectionCard } from "./-components/connection-card";
import { Onboarding } from "./-components/onboarding";

export const Route = createFileRoute("/_authed/banques/")({
  loader: async ({ context }) => {
    const setup = await context.trpcClient.settings.status.query();
    const connections = setup.configured
      ? await context.trpcClient.connections.list.query()
      : [];
    return { setup, connections };
  },
  component: BanquesPage,
});

function BanquesPage() {
  const { setup, connections } = Route.useLoaderData();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Retour aux transactions"
            render={
              <Link to="/" search={{ page: 1, sort: "date", order: "desc" }} />
            }
          >
            <ArrowLeftIcon />
          </Button>
          <h1 className="text-2xl font-bold">🏦 Banques</h1>
        </div>
        {setup.configured && (
          <Button
            render={<Link to="/banques/ajouter" search={{ step: "banque" }} />}
          >
            <PlusIcon />
            Ajouter une banque
          </Button>
        )}
      </div>

      {!setup.configured ? (
        <Onboarding setup={setup} />
      ) : connections.length === 0 ? (
        <p className="text-muted-foreground">
          Aucune banque connectée pour l'instant — ajoutez-en une pour
          commencer.
        </p>
      ) : (
        connections.map((c) => <ConnectionCard key={c.id} connection={c} />)
      )}
    </main>
  );
}
