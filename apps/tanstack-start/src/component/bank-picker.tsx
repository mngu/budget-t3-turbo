"use client";

import { useLoaderData } from "@tanstack/react-router";
import { ChevronDownIcon, LandmarkIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@budget/ui";
import { Button } from "@budget/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@budget/ui/command";
import { sumBy } from "~/lib/sum";
import { useSync } from "~/lib/sync-toast";
import { selectedBanks, toggleBank } from "~/lib/transactions-search";
import { useRevueSearch } from "~/lib/use-revue-search";

export function BankPicker() {
  const [open, setOpen] = useState(false);
  const { search, setSearch } = useRevueSearch();

  // Use the full roster so accounts without transactions remain selectable.
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
    <>
      <Button
        variant={offCount > 0 ? "secondary" : "outline"}
        size="xs"
        title="Comptes inclus"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <LandmarkIcon className="sm:hidden" />
        {offCount > 0
          ? `${banks.length - offCount}/${banks.length}`
          : banks.length}
        <span className="hidden sm:inline">
          compte{banks.length > 1 ? "s" : ""}
        </span>
        <ChevronDownIcon />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Comptes inclus"
        description="Choisissez les comptes à inclure dans la revue."
        className="max-w-120"
      >
        <CommandInput
          placeholder="Rechercher un compte…"
          aria-label="Rechercher un compte"
        />
        <CommandList>
          <CommandEmpty>Aucun résultat.</CommandEmpty>
          <CommandGroup
            heading={`Comptes inclus · ${total} transaction${total > 1 ? "s" : ""}`}
          >
            {banks.map((bank) => (
              <CommandItem
                key={bank}
                value={`bank:${bank}`}
                keywords={[bank]}
                data-checked={isOn(bank)}
                aria-label={`${bank}, ${isOn(bank) ? "inclus" : "exclu"}`}
                onSelect={() =>
                  setSearch({ bank: toggleBank(search, bank, banks) })
                }
              >
                {bank}
                <span>
                  {bankCounts.find((entry) => entry.bank === bank)?.count ?? 0}
                </span>
              </CommandItem>
            ))}
            {banks.length === 0 && (
              <CommandItem disabled>Aucun compte connecté.</CommandItem>
            )}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup>
            {offCount > 0 && (
              <CommandItem
                value="Tout inclure"
                onSelect={() => setSearch({ bank: undefined })}
              >
                Tout inclure
                <CommandShortcut>
                  {offCount} exclu{offCount > 1 ? "s" : ""}
                </CommandShortcut>
              </CommandItem>
            )}
            <SyncItem onDone={() => setOpen(false)} />
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

function SyncItem({ onDone }: { onDone: () => void }) {
  const { sync, state } = useSync();
  const syncing = state === "running";

  return (
    <CommandItem
      value="Synchroniser"
      disabled={syncing}
      onSelect={async () => {
        if (await sync()) onDone();
      }}
    >
      <RefreshCwIcon className={cn(syncing && "animate-spin")} />
      {syncing ? "Synchronisation…" : "Synchroniser"}
    </CommandItem>
  );
}
