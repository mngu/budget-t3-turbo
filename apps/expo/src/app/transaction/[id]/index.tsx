import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ListGroup, Spinner, Typography, useToast } from "heroui-native";
import { ScrollView, View } from "react-native";

import { signedAmount } from "@budget/api/schemas";
import { CategoryIcon } from "~/components/category-icon";
import { ActionItem, SettingsGroup } from "~/components/settings-group";
import { useCategoryColors } from "~/lib/category-color";
import { signedEuro } from "~/lib/format";
import { trpc } from "~/lib/trpc";

const longDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function TransactionDetail() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data: row, error } = useQuery(
    trpc.transactions.get.queryOptions({ id }),
  );
  const { resolve } = useCategoryColors();
  const { toast } = useToast();
  const exclude = useMutation({
    ...trpc.transactions.setExcluded.mutationOptions(),
    onSuccess: (_, { excluded }) =>
      toast.show({
        variant: "success",
        label: excluded
          ? "La ligne est écartée des analyses."
          : "La ligne compte de nouveau dans les analyses.",
      }),
  });

  if (error) {
    return (
      <Typography color="muted" className="p-4">
        {error.message}
      </Typography>
    );
  }
  if (!row) return <Spinner className="m-8 self-center" />;

  const amount = signedAmount(row);
  const debtor = row.raw.debtor?.name ?? row.counterparty;

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-6 p-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View className="items-center gap-1 py-2">
        <Typography
          type="h2"
          className={`tabular-nums ${amount > 0 ? "text-success" : ""} ${row.excluded ? "line-through" : ""}`}
        >
          {signedEuro(amount)}
        </Typography>
        <Typography className="text-center">{row.description}</Typography>
        <Typography color="muted">
          {longDate.format(new Date(row.bookingDate))}
          {row.status === "pending" ? " · en attente" : ""}
        </Typography>
      </View>

      <SettingsGroup
        title="Catégorie"
        footer={
          row.categorySource === "manual"
            ? "Catégorie corrigée à la main."
            : undefined
        }
      >
        <ListGroup.Item
          onPress={() =>
            router.push({
              pathname: "/transaction/[id]/categorie",
              params: { id },
            })
          }
        >
          <ListGroup.ItemPrefix>
            <CategoryIcon
              name={row.categoryIcon}
              color={resolve(row.categoryColor)}
            />
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>
              {row.categoryPath ?? "Sans catégorie"}
            </ListGroup.ItemTitle>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix />
        </ListGroup.Item>
      </SettingsGroup>

      <SettingsGroup title="Détails">
        <Detail label="Compte" value={row.bankName} />
        {debtor && <Detail label="Tiers" value={debtor} />}
      </SettingsGroup>

      <SettingsGroup
        footer={
          row.excluded
            ? "Elle ne pèse plus dans les totaux, les moyennes ni les budgets. La réintégrer l'y fait compter de nouveau."
            : "Elle ne pèsera plus dans les totaux, les moyennes ni les budgets, et restera dans le relevé : c'est le seul endroit d'où la reprendre."
        }
      >
        <ActionItem
          label={
            row.excluded ? "Réintégrer aux analyses" : "Exclure des analyses"
          }
          tone={row.excluded ? "accent" : "danger"}
          isDisabled={exclude.isPending}
          onPress={() => exclude.mutate({ id, excluded: !row.excluded })}
        />
      </SettingsGroup>
    </ScrollView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <ListGroup.Item disabled>
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle>{label}</ListGroup.ItemTitle>
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix>
        <Typography color="muted" numberOfLines={1} className="max-w-56">
          {value}
        </Typography>
      </ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
}
