"use client";

import { Button, Dropdown, Header, Label } from "@heroui/react";
import { useLoaderData } from "@tanstack/react-router";
import { ChevronDownIcon, LandmarkIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@budget/ui";
import { sumBy } from "~/lib/sum";
import { useSync } from "~/lib/sync-toast";
import { selectedBanks } from "~/lib/transactions-search";
import { useRevueSearch } from "~/lib/use-revue-search";

export function BankPicker() {
  const [open, setOpen] = useState(false);
  const { search, setSearch } = useRevueSearch();
  const { sync, state } = useSync();
  const syncing = state === "running";

  // Use the full roster so accounts without transactions remain selectable.
  const { banks, bankCounts } = useLoaderData({
    from: "/_authed/_period-overview",
  });

  const selected = selectedBanks(search);
  const included = selected.length === 0 ? banks : selected;
  const offCount = banks.length - included.length;

  const total = sumBy(
    bankCounts.filter((entry) => included.includes(entry.bank)),
    (entry) => entry.count,
  );

  return (
    <Dropdown isOpen={open} onOpenChange={setOpen}>
      <Button
        variant={offCount > 0 ? "secondary" : "outline"}
        size="sm"
        aria-label="Comptes inclus"
      >
        <LandmarkIcon className="sm:hidden" />
        {offCount > 0
          ? `${banks.length - offCount}/${banks.length}`
          : banks.length}
        <span className="hidden sm:inline">
          compte{banks.length > 1 ? "s" : ""}
        </span>
        <ChevronDownIcon className="hidden sm:block" />
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label="Comptes inclus">
          <Dropdown.Section
            selectionMode="multiple"
            // An empty selection would mean every account, including ones connected later.
            disallowEmptySelection
            shouldCloseOnSelect={false}
            selectedKeys={included}
            onSelectionChange={(keys) => {
              const next = banks.filter(
                (bank) => keys === "all" || keys.has(bank),
              );
              setSearch({
                bank: next.length === banks.length ? undefined : next,
              });
            }}
          >
            <Header>
              Comptes inclus · {total} transaction{total > 1 ? "s" : ""}
            </Header>
            {banks.map((bank) => (
              <Dropdown.Item key={bank} id={bank} textValue={bank}>
                <Dropdown.ItemIndicator />
                <Label>{bank}</Label>
                <span className="text-muted num ms-auto">
                  {bankCounts.find((entry) => entry.bank === bank)?.count ?? 0}
                </span>
              </Dropdown.Item>
            ))}
          </Dropdown.Section>
          <Dropdown.Section>
            {offCount > 0 ? (
              <Dropdown.Item
                textValue="Tout inclure"
                onAction={() => setSearch({ bank: undefined })}
              >
                <Label>Tout inclure</Label>
                <span className="text-muted ms-auto">
                  {offCount} exclu{offCount > 1 ? "s" : ""}
                </span>
              </Dropdown.Item>
            ) : null}
            <Dropdown.Item
              textValue="Synchroniser"
              isDisabled={syncing}
              onAction={() => void sync()}
            >
              <RefreshCwIcon className={cn(syncing && "animate-spin")} />
              <Label>{syncing ? "Synchronisation…" : "Synchroniser"}</Label>
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
