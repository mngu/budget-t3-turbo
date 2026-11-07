import { useMutation } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  ListGroup,
  Spinner,
  Switch,
  Typography,
  useThemeColor,
} from "heroui-native";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, View } from "react-native";

import { familyBudget, isManagedCategory } from "@budget/api/schemas";
import { CATEGORY_COLOR_PALETTE } from "@budget/shared";
import { CategoryIcon } from "~/components/category-icon";
import {
  ActionItem,
  RenameItem,
  SettingsGroup,
} from "~/components/settings-group";
import { useCategoryColors } from "~/lib/category-color";
import { useFormat } from "~/lib/format";
import { useSpaceCategories } from "~/lib/overview";
import { trpc } from "~/lib/trpc";

// A parent or a child, found by id among the space's categories.
export default function CategoryEditor() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const categories = (useSpaceCategories().data ?? []).filter(
    isManagedCategory,
  );
  const parent = categories.find(
    (candidate) =>
      candidate.id === id ||
      candidate.children?.some((child) => child.id === id),
  );
  const child = parent?.children?.find((candidate) => candidate.id === id);
  const { resolve } = useCategoryColors();
  const { euro } = useFormat();

  const rename = useMutation(trpc.categories.rename.mutationOptions());
  const setColor = useMutation(trpc.categories.updateColor.mutationOptions());
  const setBudget = useMutation(trpc.categories.budgets.set.mutationOptions());
  const setDetailed = useMutation(
    trpc.categories.budgets.setDetailed.mutationOptions(),
  );
  const remove = useMutation({
    ...trpc.categories.remove.mutationOptions(),
    onSuccess: () => router.back(),
  });

  // Deleted, or not loaded yet.
  if (!parent) return <Spinner className="m-8 self-center" />;
  const node = child ?? parent;
  const children = parent.children ?? [];
  const twin =
    !child &&
    categories.find(
      (other) => other.id !== parent.id && other.color === parent.color,
    )?.name;
  // A detailed parent's budget is its children's; otherwise the parent holds it.
  const ownsBudget = child ? parent.budgetDetailed : !parent.budgetDetailed;

  const confirmRemove = () => {
    const facts = [
      !child &&
        children.length > 0 &&
        `Ses ${children.length} sous-catégorie(s) seront aussi supprimée(s).`,
      node.transactionCount > 0 &&
        `${node.transactionCount} transaction(s) deviendront sans catégorie.`,
    ].filter(Boolean);
    Alert.alert(
      `Supprimer « ${node.name} » ?`,
      ["Cette action est irréversible.", ...facts].join("\n"),
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => remove.mutate({ id }),
        },
      ],
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: node.name }} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-6 p-4"
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <SettingsGroup title="Nom">
          <RenameItem
            key={node.name}
            value={node.name}
            onCommit={(name) => rename.mutate({ id, name })}
          />
        </SettingsGroup>

        {!child && (
          <SettingsGroup
            title="Couleur"
            footer={
              twin
                ? `Même teinte que ${twin} : c'est l'icône qui les distingue.`
                : undefined
            }
          >
            <View className="flex-row flex-wrap justify-center gap-3 px-3 py-4">
              {CATEGORY_COLOR_PALETTE.map((color) => (
                <Pressable
                  key={color.light}
                  accessibilityLabel={color.name}
                  accessibilityState={{
                    selected: parent.color === color.light,
                  }}
                  onPress={() => setColor.mutate({ id, color: color.light })}
                  className="size-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: resolve(color.light) }}
                >
                  {parent.color === color.light && (
                    <Check size={18} color="white" />
                  )}
                </Pressable>
              ))}
            </View>
          </SettingsGroup>
        )}

        {!child && (
          <SettingsGroup title="Icône">
            <ListGroup.Item
              onPress={() =>
                router.push({
                  pathname: "/reglages/categories/icone",
                  params: { id },
                })
              }
            >
              <ListGroup.ItemPrefix>
                <CategoryIcon
                  name={parent.icon}
                  color={resolve(parent.color)}
                />
              </ListGroup.ItemPrefix>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>
                  {parent.icon ? "Changer d'icône" : "Sans icône"}
                </ListGroup.ItemTitle>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix />
            </ListGroup.Item>
          </SettingsGroup>
        )}

        <SettingsGroup
          title="Budget mensuel"
          footer={
            child && !parent.budgetDetailed
              ? `Le budget est fixé sur « ${parent.name} », pour toute la catégorie.`
              : !child && parent.budgetDetailed
                ? "La somme des budgets des sous-catégories."
                : undefined
          }
        >
          {!child && children.length > 0 && (
            <ListGroup.Item
              onPress={() =>
                setDetailed.mutate({
                  categoryId: id,
                  detailed: !parent.budgetDetailed,
                })
              }
            >
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>
                  Détailler par sous-catégorie
                </ListGroup.ItemTitle>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix>
                <Switch
                  isSelected={parent.budgetDetailed}
                  onSelectedChange={(detailed) =>
                    setDetailed.mutate({ categoryId: id, detailed })
                  }
                />
              </ListGroup.ItemSuffix>
            </ListGroup.Item>
          )}
          {ownsBudget ? (
            <AmountRow
              key={String(node.budgetAmount)}
              value={node.budgetAmount}
              onCommit={(amount) =>
                setBudget.mutate({ categoryId: id, amount })
              }
            />
          ) : (
            !child && (
              <ListGroup.Item disabled>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>Total</ListGroup.ItemTitle>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix>
                  <Typography color="muted" className="tabular-nums">
                    {euro.format(familyBudget(parent) ?? 0)}
                  </Typography>
                </ListGroup.ItemSuffix>
              </ListGroup.Item>
            )
          )}
        </SettingsGroup>

        {!child && (
          <SettingsGroup title="Sous-catégories">
            {children.map((sub) => (
              <ListGroup.Item
                key={sub.id}
                onPress={() =>
                  router.push({
                    pathname: "/reglages/categories/[id]",
                    params: { id: sub.id },
                  })
                }
              >
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{sub.name}</ListGroup.ItemTitle>
                  {parent.budgetDetailed && (
                    <ListGroup.ItemDescription>
                      {sub.budgetAmount === null
                        ? "Aucun budget"
                        : `${euro.format(sub.budgetAmount)} / mois`}
                    </ListGroup.ItemDescription>
                  )}
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix />
              </ListGroup.Item>
            ))}
            <ActionItem
              label="Ajouter une sous-catégorie"
              tone="accent"
              onPress={() =>
                router.push({
                  pathname: "/reglages/categories/nouvelle",
                  params: { parentId: id },
                })
              }
            />
          </SettingsGroup>
        )}

        <SettingsGroup>
          <ListGroup.Item
            disabled={node.transactionCount === 0}
            onPress={() =>
              router.push({
                pathname: "/reglages/transactions",
                params: { category: node.name },
              })
            }
          >
            <ListGroup.ItemContent>
              <ListGroup.ItemTitle>
                {node.transactionCount} transaction
                {node.transactionCount > 1 ? "s" : ""}
              </ListGroup.ItemTitle>
            </ListGroup.ItemContent>
            {node.transactionCount > 0 && <ListGroup.ItemSuffix />}
          </ListGroup.Item>
        </SettingsGroup>

        <SettingsGroup footer="Les transactions ne sont pas supprimées, elles redeviennent sans catégorie.">
          <ActionItem
            label="Supprimer la catégorie"
            tone="danger"
            isDisabled={remove.isPending}
            onPress={confirmRemove}
          />
        </SettingsGroup>
      </ScrollView>
    </>
  );
}

function AmountRow({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (amount: number | null) => void;
}) {
  const [text, setText] = useState(value?.toString() ?? "");
  const muted = useThemeColor("muted");
  return (
    <ListGroup.Item disabled>
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle>Montant</ListGroup.ItemTitle>
      </ListGroup.ItemContent>
      <View className="flex-row items-baseline gap-1">
        <TextInput
          value={text}
          onChangeText={(next) => setText(next.replace(/\D/g, "").slice(0, 5))}
          onEndEditing={() => {
            const amount = text === "" ? null : Number(text);
            if (amount !== value) onCommit(amount);
          }}
          keyboardType="number-pad"
          returnKeyType="done"
          placeholder="—"
          placeholderTextColor={muted}
          accessibilityLabel="Budget mensuel"
          className="text-foreground min-w-20 py-0 text-right text-base tabular-nums"
        />
        <Typography color="muted" className="text-base">
          €
        </Typography>
      </View>
    </ListGroup.Item>
  );
}
