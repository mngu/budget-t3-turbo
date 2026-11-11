"use client";

import { Button, Description, Dropdown, Header, Label } from "@heroui/react";
import { useLoaderData } from "@tanstack/react-router";
import { ChevronDownIcon, LandmarkIcon, RefreshCwIcon } from "lucide-react";

import { sumBy } from "@budget/api/schemas";
import { cn } from "@budget/ui";
import { dayMonthFr } from "~/lib/format";
import { useSync } from "~/lib/sync-toast";
import { selectedBanks } from "~/lib/transactions-search";
import { useRevueSearch } from "~/lib/use-revue-search";

const timeFr = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" });

// Exact figures like a bank statement, in the account's own currency.
function formatBalance(amount: number, currency: string, at: Date) {
  const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency });
  const when =
    at.toDateString() === new Date().toDateString()
      ? timeFr.format(at)
      : dayMonthFr.format(at);
  // Breaks between the amount and its date on narrow screens, never inside either.
  return (
    <>
      <span className="whitespace-nowrap">{money.format(amount)}</span>{" "}
      <span className="whitespace-nowrap">· {when}</span>
    </>
  );
}

export function BankPicker() {
  const { search, setSearch } = useRevueSearch();
  const { sync, state } = useSync();
  const syncing = state === "running";

  // Use the full roster so accounts without transactions remain selectable.
  const { banks, bankCounts, balances } = useLoaderData({
    from: "/_authed/_period-overview",
  });

  const selected = selectedBanks(search);
  // A shared URL or a space switch can name banks this space does not have.
  const included =
    selected.length === 0
      ? banks
      : banks.filter((bank) => selected.includes(bank));
  const offCount = banks.length - included.length;

  const total = sumBy(
    bankCounts.filter((entry) => included.includes(entry.bank)),
    (entry) => entry.count,
  );

  return (
    <Dropdown>
      <Button variant={offCount > 0 ? "secondary" : "outline"} size="sm">
        <span className="sr-only">Comptes inclus : </span>
        <LandmarkIcon className="sm:hidden" />
        {offCount > 0
          ? `${banks.length - offCount}/${banks.length}`
          : banks.length}
        <span className="hidden sm:inline">
          compte{banks.length > 1 ? "s" : ""}
        </span>
        <ChevronDownIcon className="hidden sm:block" />
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-72">
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
                <div className="flex min-w-0 flex-col">
                  <Label>{bank}</Label>
                  {balances
                    .filter((balance) => balance.bank === bank)
                    .map(({ amount, currency, at }) => (
                      <Description key={currency} className="num">
                        {formatBalance(amount, currency, at)}
                      </Description>
                    ))}
                </div>
                <span className="text-muted num ms-auto shrink-0">
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
