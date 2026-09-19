"use client";

import { useLoaderData } from "@tanstack/react-router";
import { ChevronDownIcon, LandmarkIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@budget/ui";
import { Button } from "@budget/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@budget/ui/dropdown-menu";
import { sumBy } from "~/lib/sum";
import { useSync } from "~/lib/sync-toast";
import { selectedBanks, toggleBank } from "~/lib/transactions-search";
import { useRevueSearch } from "~/lib/use-revue-search";

/**
 * Sélecteur de comptes de l'en-tête : les écrans de la revue partagent la même
 * search, et le filtre banque est le seul qui vaille pour tous. Il vit donc là
 * plutôt que dans les barres « Affiner » propres à chaque écran.
 *
 * Le *roster* vient de `transactions.banks` et non de `bankCounts` : ce dernier
 * ne connaît que les banques ayant des transactions sur la période, et un
 * compte sans mouvement ce mois-ci disparaîtrait du panneau — avec lui la seule
 * façon de comprendre pourquoi il ne pèse rien.
 *
 * L'en-tête ne le monte que sur les écrans de la revue : sur `/categories` et
 * `/banques`, il ne commanderait rien (leur search n'a pas de `bank`), et un
 * filtre qui ne filtre rien est pire qu'un filtre absent.
 *
 * **Aucun `className` de mise en forme ici** : c'est un menu de cases à cocher,
 * il est monté avec les primitives de `@budget/ui/dropdown-menu` et le style
 * appartient au package — voir
 * `docs/adr/0001-le-design-appartient-au-package-ui.md`. L'ouverture reste
 * contrôlée parce que la synchronisation referme le menu quand elle aboutit.
 */
export function BankPicker() {
  const [open, setOpen] = useState(false);
  const { search, setSearch } = useRevueSearch();

  // Chargés par le loader du layout de la revue, seul endroit d'où l'en-tête
  // monte ce sélecteur (voir la garde `isRevue` d'`AppHeader`).
  const { banks, bankCounts } = useLoaderData({
    from: "/_authed/_period-overview",
  });

  const selected = selectedBanks(search);
  const isOn = (bank: string) =>
    selected.length === 0 || selected.includes(bank);
  const offCount = banks.filter((bank) => !isOn(bank)).length;

  const total = sumBy(
    bankCounts.filter((entry) => isOn(entry.bank)),
    (entry) => entry.count,
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {/* La sélection partielle passe par une *variante* du bouton plutôt que
          par une teinte écrite ici : c'est le vocabulaire du package qui porte
          l'état, comme `aria-current` ailleurs. */}
      <DropdownMenuTrigger
        render={
          <Button
            variant={offCount > 0 ? "secondary" : "outline"}
            size="xs"
            title="Comptes inclus"
          />
        }
      >
        <LandmarkIcon className="sm:hidden" />
        {offCount > 0
          ? `${banks.length - offCount}/${banks.length}`
          : banks.length}
        <span className="hidden sm:inline">
          compte{banks.length > 1 ? "s" : ""}
        </span>
        <ChevronDownIcon />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {/* La maquette met un « sync 07:12 » en bout de cette rangée. Rien en
              base n'enregistre qu'une synchronisation a eu lieu (voir CLAUDE.md
              et `banques/-components/sync-status.tsx`) : la place revient au
              seul chiffre vérifiable, le volume couvert par la sélection. */}
          <DropdownMenuLabel>
            Comptes inclus
            <DropdownMenuShortcut>
              {total} transaction{total > 1 ? "s" : ""}
            </DropdownMenuShortcut>
          </DropdownMenuLabel>

          {banks.map((bank) => (
            <DropdownMenuCheckboxItem
              key={bank}
              checked={isOn(bank)}
              onCheckedChange={() =>
                setSearch({ bank: toggleBank(search, bank, banks) })
              }
            >
              {bank}
              <DropdownMenuShortcut>
                {bankCounts.find((entry) => entry.bank === bank)?.count ?? 0}
              </DropdownMenuShortcut>
            </DropdownMenuCheckboxItem>
          ))}

          {banks.length === 0 && (
            <DropdownMenuItem disabled>Aucun compte connecté.</DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        {/* Réinitialisation : n'apparaît que lorsqu'il y a quelque chose à
            réinitialiser, sinon elle annoncerait « 0 compte exclu ». */}
        {offCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSearch({ bank: undefined })}>
              Tout inclure
              <DropdownMenuShortcut>
                {offCount} exclu{offCount > 1 ? "s" : ""}
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <SyncItem onDone={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * `sync.run` touche aux sessions bancaires réelles et déclenche une SCA : cette
 * entrée est le seul déclencheur, jamais un effet de bord d'autre chose.
 *
 * `closeOnClick={false}` est la seule chose qui la distingue d'une entrée
 * ordinaire : le menu doit rester ouvert le temps de la synchronisation, sans
 * quoi le libellé « Synchronisation… » serait démonté aussitôt affiché. C'est
 * l'appelant qui referme, une fois l'opération aboutie.
 */
function SyncItem({ onDone }: { onDone: () => void }) {
  const { sync, state } = useSync();
  const syncing = state === "running";

  return (
    <DropdownMenuItem
      closeOnClick={false}
      disabled={syncing}
      onClick={async () => {
        if (await sync()) onDone();
      }}
    >
      <RefreshCwIcon className={cn(syncing && "animate-spin")} />
      {syncing ? "Synchronisation…" : "Synchroniser"}
    </DropdownMenuItem>
  );
}
