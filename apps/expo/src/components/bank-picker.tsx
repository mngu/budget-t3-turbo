import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Button,
  Menu,
  Separator,
  Typography,
  useThemeColor,
} from "heroui-native";
import { Landmark } from "lucide-react-native";

import { usePeriod } from "~/lib/period";
import { trpc } from "~/lib/trpc";

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
  const iconColor = useThemeColor("foreground");

  // A space switch can leave banks this space does not have.
  const included = bank ? banks.filter((name) => bank.includes(name)) : banks;
  const offCount = banks.length - included.length;
  const count = (name: string) =>
    counts.find((entry) => entry.bank === name)?.count ?? 0;
  const total = included.reduce((sum, name) => sum + count(name), 0);

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
                <Menu.ItemTitle>{name}</Menu.ItemTitle>
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
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}
