import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Button,
  Menu,
  Separator,
  Typography,
  useThemeColor,
} from "heroui-native";
import { Landmark, RefreshCw } from "lucide-react-native";
import { View } from "react-native";

import { sumBy } from "@budget/api/schemas";
import { usePeriod } from "~/lib/period";
import { useSync } from "~/lib/sync";
import { trpc } from "~/lib/trpc";

const timeFr = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" });
const dayMonthFr = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
});

// Exact figures like a bank statement, in the account's own currency.
function formatBalance(amount: number, currency: string, at: Date) {
  const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency });
  const when =
    at.toDateString() === new Date().toDateString()
      ? timeFr.format(at)
      : dayMonthFr.format(at);
  return `${money.format(amount)} · ${when}`;
}

export function BankPicker() {
  const { scope, bank, setBank } = usePeriod();
  // The full roster keeps accounts without transactions selectable.
  const { data: banks = [] } = useQuery(trpc.transactions.banks.queryOptions());
  const { data: counts = [] } = useQuery({
    ...trpc.transactions.bankCounts.queryOptions({
      ...scope,
      page: 1,
      sort: "date",
      order: "desc",
    }),
    placeholderData: keepPreviousData,
  });
  const { data: balances = [] } = useQuery(
    trpc.connections.balances.queryOptions(),
  );
  const iconColor = useThemeColor("foreground");
  const { sync, running } = useSync();

  // A space switch can leave banks this space does not have.
  const included = bank ? banks.filter((name) => bank.includes(name)) : banks;
  const offCount = banks.length - included.length;
  const count = (name: string) =>
    counts.find((entry) => entry.bank === name)?.count ?? 0;
  const total = sumBy(included, count);

  return (
    <Menu>
      <Menu.Trigger asChild>
        <Button
          size="sm"
          variant={offCount > 0 ? "secondary" : "ghost"}
          accessibilityLabel="Comptes inclus"
          className="mr-2"
        >
          <Landmark size={16} color={iconColor} />
          <Button.Label className="tabular-nums">
            {offCount > 0 ? `${included.length}/${banks.length}` : banks.length}
          </Button.Label>
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Overlay />
        <Menu.Content presentation="popover" placement="bottom" width={280}>
          <Menu.Label>
            Comptes inclus · {total} transaction{total > 1 ? "s" : ""}
          </Menu.Label>
          <Menu.Group
            selectionMode="multiple"
            shouldCloseOnSelect={false}
            selectedKeys={included}
            onSelectionChange={(keys) => {
              const next = banks.filter((name) => keys.has(name));
              // An empty selection would mean every account.
              if (next.length === 0) return;
              setBank(next.length === banks.length ? undefined : next);
            }}
          >
            {banks.map((name) => (
              <Menu.Item key={name} id={name}>
                <Menu.ItemIndicator />
                <View className="flex-1">
                  <Menu.ItemTitle>{name}</Menu.ItemTitle>
                  {balances
                    .filter((balance) => balance.bank === name)
                    .map(({ amount, currency, at }) => (
                      <Menu.ItemDescription
                        key={currency}
                        className="tabular-nums"
                      >
                        {formatBalance(amount, currency, at)}
                      </Menu.ItemDescription>
                    ))}
                </View>
                <Typography color="muted" className="tabular-nums">
                  {count(name)}
                </Typography>
              </Menu.Item>
            ))}
          </Menu.Group>
          {offCount > 0 && (
            <>
              <Separator className="my-1" />
              <Menu.Item onPress={() => setBank(undefined)}>
                <Menu.ItemTitle>Tout inclure</Menu.ItemTitle>
                <Typography color="muted">
                  {offCount} exclu{offCount > 1 ? "s" : ""}
                </Typography>
              </Menu.Item>
            </>
          )}
          <Separator className="my-1" />
          <Menu.Item isDisabled={running} onPress={sync}>
            <RefreshCw size={16} color={iconColor} />
            <Menu.ItemTitle>
              {running ? "Synchronisation…" : "Synchroniser"}
            </Menu.ItemTitle>
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}
