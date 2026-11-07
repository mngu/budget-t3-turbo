import { useMutation } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import {
  Button,
  ListGroup,
  Spinner,
  useThemeColor,
  useToast,
} from "heroui-native";
import { Plus } from "lucide-react-native";
import { ScrollView } from "react-native";

import {
  familyBudget,
  isManagedCategory,
  NO_CATEGORY_NAME,
} from "@budget/api/schemas";
import { CategoryIcon } from "~/components/category-icon";
import { ActionItem, SettingsGroup } from "~/components/settings-group";
import { useCategoryColors } from "~/lib/category-color";
import { useFormat } from "~/lib/format";
import { useSpaceCategories } from "~/lib/overview";
import { trpc } from "~/lib/trpc";

const plural = (count: number, word: string) =>
  `${count} ${word}${count > 1 ? "s" : ""}`;

export default function Categories() {
  const { data: all } = useSpaceCategories();
  const { resolve } = useCategoryColors();
  const { euro } = useFormat();
  const { toast } = useToast();
  const iconColor = useThemeColor("accent");
  const categorize = useMutation({
    ...trpc.categories.categorize.mutationOptions(),
    onSuccess: ({ categorized, remaining }) =>
      toast.show(
        remaining === 0
          ? { variant: "success", label: "Tout est catégorisé." }
          : categorized === 0
            ? {
                variant: "warning",
                label: `Aucune catégorie existante ne convient aux ${remaining} restante(s).`,
              }
            : {
                variant: "success",
                label: `${categorized} catégorisée(s), ${remaining} restante(s).`,
              },
      ),
  });

  if (!all) return <Spinner className="m-8 self-center" />;
  const categories = all.filter(isManagedCategory);
  const uncategorized =
    all.find(({ name }) => name === NO_CATEGORY_NAME)?.transactionCount ?? 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              accessibilityLabel="Ajouter une catégorie"
              onPress={() => router.push("/reglages/categories/nouvelle")}
            >
              <Plus size={22} color={iconColor} />
            </Button>
          ),
        }}
      />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-6 p-4"
        contentInsetAdjustmentBehavior="automatic"
      >
        {uncategorized > 0 && (
          <SettingsGroup
            title="Sans catégorie"
            footer="Les lignes que rien ne décrit restent sans catégorie : créez la catégorie manquante, puis relancez."
          >
            <ListGroup.Item
              onPress={() =>
                router.push({
                  pathname: "/reglages/transactions",
                  params: { category: NO_CATEGORY_NAME },
                })
              }
            >
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>
                  {plural(uncategorized, "transaction")} sans catégorie
                </ListGroup.ItemTitle>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix />
            </ListGroup.Item>
            <ActionItem
              label={categorize.isPending ? "Catégorisation…" : "Catégoriser"}
              tone="accent"
              isDisabled={categorize.isPending}
              onPress={() => categorize.mutate()}
            />
          </SettingsGroup>
        )}

        <SettingsGroup title="Catégories">
          {categories.map((category) => {
            const budget = familyBudget(category);
            const childCount = category.children?.length ?? 0;
            return (
              <ListGroup.Item
                key={category.id}
                onPress={() =>
                  router.push({
                    pathname: "/reglages/categories/[id]",
                    params: { id: category.id },
                  })
                }
              >
                <ListGroup.ItemPrefix>
                  <CategoryIcon
                    name={category.icon}
                    color={resolve(category.color)}
                  />
                </ListGroup.ItemPrefix>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle>{category.name}</ListGroup.ItemTitle>
                  <ListGroup.ItemDescription>
                    {[
                      childCount > 0 && plural(childCount, "sous-catégorie"),
                      budget !== null && `${euro.format(budget)} / mois`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Aucun budget"}
                  </ListGroup.ItemDescription>
                </ListGroup.ItemContent>
                <ListGroup.ItemSuffix />
              </ListGroup.Item>
            );
          })}
        </SettingsGroup>
      </ScrollView>
    </>
  );
}
