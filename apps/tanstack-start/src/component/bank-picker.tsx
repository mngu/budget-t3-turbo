"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { CheckIcon, RefreshCwIcon } from "lucide-react";

import { cn } from "@budget/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@budget/ui/popover";
import { toast } from "@budget/ui/toast";

import { toastSyncOutcome } from "~/lib/sync-toast";
import { selectedBanks, toggleBank } from "~/lib/transactions-search";
import { useTRPC, useTRPCClient } from "~/lib/trpc";
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
 */
export function BankPicker() {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const { search, setSearch } = useRevueSearch();

  const { data: banks } = useQuery(trpc.transactions.banks.queryOptions());
  const { data: counts } = useQuery(
    trpc.transactions.bankCounts.queryOptions(search),
  );

  const known = banks ?? [];
  const selected = selectedBanks(search);
  const isOn = (bank: string) =>
    selected.length === 0 || selected.includes(bank);
  const offCount = known.filter((bank) => !isOn(bank)).length;

  const total = (counts ?? [])
    .filter((entry) => isOn(entry.bank))
    .reduce((acc, entry) => acc + entry.count, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(props) => (
          <button
            type="button"
            title="Comptes inclus"
            className={cn(
              "inline-flex h-[26px] items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] whitespace-nowrap",
              offCount > 0
                ? "border-primary bg-accent-soft text-primary font-semibold"
                : "border-border text-muted-foreground hover:border-primary font-medium",
            )}
            {...props}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                offCount > 0 ? "bg-primary" : "bg-ok",
              )}
            />
            {offCount > 0
              ? `${known.length - offCount}/${known.length} comptes`
              : `${known.length} compte${known.length > 1 ? "s" : ""}`}
            <span className="text-subtle text-[9px]">▾</span>
          </button>
        )}
      />
      <PopoverContent align="end" className="w-[290px] gap-0 p-0">
        {/* La maquette met un « sync 07:12 » en bout de cette rangée. Rien en
            base n'enregistre qu'une synchronisation a eu lieu (voir CLAUDE.md et
            `banques/-components/sync-status.tsx`) : la place revient au seul
            chiffre vérifiable, le volume réellement couvert par la sélection. */}
        <div className="border-border flex items-baseline gap-2 border-b px-3.5 py-2.5">
          <span className="label-caps text-[11px]">Comptes inclus</span>
          <span className="text-subtle ml-auto text-[11px]">
            {total} transaction{total > 1 ? "s" : ""} sur la période
          </span>
        </div>

        <div className="p-1.5">
          {known.map((bank) => {
            const on = isOn(bank);
            return (
              <button
                key={bank}
                type="button"
                onClick={() =>
                  setSearch({ bank: toggleBank(search, bank, known) })
                }
                className="hover:bg-accent grid w-full grid-cols-[15px_minmax(0,1fr)_34px] items-center gap-2.5 rounded-lg px-2 py-1.5 text-left"
              >
                <span
                  className={cn(
                    "flex size-3.5 items-center justify-center rounded-[4px] border",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {on && <CheckIcon className="size-2.5" />}
                </span>
                <span
                  className={cn(
                    "truncate text-[12.5px]",
                    on ? "font-medium" : "text-subtle",
                  )}
                >
                  {bank}
                </span>
                <span className="text-subtle num text-right text-[11px]">
                  {counts?.find((entry) => entry.bank === bank)?.count ?? 0}
                </span>
              </button>
            );
          })}
          {known.length === 0 && (
            <p className="text-muted-foreground px-2 py-2 text-[11.5px]">
              Aucun compte connecté.
            </p>
          )}
        </div>

        {/* Rangée d'exclusion : elle n'apparaît que lorsqu'il y a quelque chose
            à réinitialiser, sinon elle annoncerait « 0 compte exclu ». */}
        {offCount > 0 && (
          <div className="border-border bg-sunken flex items-center border-t px-3.5 py-2">
            <span className="text-subtle text-[11px]">
              {offCount} compte{offCount > 1 ? "s exclus" : " exclu"}
            </span>
            <button
              type="button"
              className="text-primary ml-auto text-[11.5px]"
              onClick={() => setSearch({ bank: undefined })}
            >
              Tout inclure
            </button>
          </div>
        )}

        <div className="border-border border-t p-2">
          <SyncButton onDone={() => setOpen(false)} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

// sync.run touche aux sessions bancaires réelles et déclenche une SCA : ce
// bouton est le seul déclencheur, jamais un effet de bord d'autre chose.
function SyncButton({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [syncing, setSyncing] = useState(false);

  return (
    <button
      type="button"
      disabled={syncing}
      className="border-border-strong bg-card hover:bg-accent hover:border-primary flex h-7.5 w-full items-center justify-center gap-2 rounded-lg border text-xs font-medium disabled:opacity-60"
      onClick={async () => {
        setSyncing(true);
        try {
          const outcome = await trpcClient.sync.run.mutate();
          await router.invalidate();
          toastSyncOutcome(outcome);
          onDone();
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Échec de la synchronisation.",
          );
        } finally {
          setSyncing(false);
        }
      }}
    >
      <RefreshCwIcon className={cn("size-3.5", syncing && "animate-spin")} />
      {syncing ? "Synchronisation…" : "Synchroniser"}
    </button>
  );
}
