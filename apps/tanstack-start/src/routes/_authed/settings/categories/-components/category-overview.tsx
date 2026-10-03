import type { computeStats } from "..";
import type { ManagedCategory } from "@budget/api/schemas";

import {
  Accordion,
  Button,
  Card,
  Dropdown,
  Input,
  Label,
  Separator,
} from "@heroui/react";
import {
  EllipsisIcon,
  ListTreeIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { CategoryIcon } from "~/component/category-icon";
import {
  softCategoryColor,
  useShadeCategoryColor,
  useCategoryColor,
} from "~/lib/category-color";
import { sumBy } from "~/lib/sum";
import { useTRPCClient } from "~/lib/trpc";
import { useFormat } from "~/lib/use-format";
import { useRun } from "~/lib/use-run";

import { useCategoryCrud } from "../-lib/use-category-crud";
import { usePreview } from "../-lib/use-preview";
import { CategoryDeleteDialog } from "./category-delete-dialog";
import { CategoryIdentityDialog } from "./category-identity-dialog";
import { TransactionPreviewDrawer } from "./transaction-preview-drawer";

interface CategoryOverviewProps {
  categoryOverview: ManagedCategory[];
  stats: ReturnType<typeof computeStats>;
}

export function CategoryOverview({
  categoryOverview,
  stats,
}: CategoryOverviewProps) {
  const { euro } = useFormat();
  const trpcClient = useTRPCClient();
  const crud = useCategoryCrud();
  const preview = usePreview();
  const resolve = useCategoryColor();
  const shadeCategoryColor = useShadeCategoryColor();
  const run = useRun();

  const onSetAmount = (categoryId: number, amount: number | null) =>
    run(
      () => trpcClient.categories.budgets.set.mutate({ categoryId, amount }),
      "Échec de l'enregistrement du budget.",
    );

  const onSetDetailed = (categoryId: number, detailed: boolean) =>
    run(
      () =>
        trpcClient.categories.budgets.setDetailed.mutate({
          categoryId,
          detailed,
        }),
      "Échec du changement de régime de budget.",
    );

  return (
    <>
      <Card className="p-0">
        <Card.Content>
          <Accordion allowsMultipleExpanded>
            {categoryOverview.map(
              ({
                id,
                name,
                icon,
                color,
                children,
                budgetDetailed,
                budgetAmount,
                transactionCount,
              }) => {
                const resolvedColor = resolve(color);
                const soft = softCategoryColor(resolvedColor);
                const childNodes = children ?? [];
                const previewParent = () =>
                  preview.openCategory({
                    name,
                    includesChildren: childNodes.length > 0,
                    color: resolvedColor,
                    soft,
                    icon: icon,
                  });

                return (
                  <Accordion.Item key={id} id={id}>
                    <div className="flex w-full flex-wrap items-center justify-between gap-2 p-2">
                      <div className="flex min-w-0 grow basis-full items-center gap-2 md:basis-0">
                        <Accordion.Heading>
                          <Accordion.Trigger
                            aria-label={`Sous-catégories de ${name}`}
                          >
                            <Accordion.Indicator />
                          </Accordion.Trigger>
                        </Accordion.Heading>

                        <button
                          type="button"
                          onClick={() =>
                            crud.onOpenIdentity({ id, name, color, icon })
                          }
                          aria-label={`Couleur et icône de ${name}`}
                          className="relative flex size-8 items-center justify-center rounded-md border"
                          style={{
                            background: softCategoryColor(resolvedColor),
                          }}
                        >
                          <CategoryIcon name={icon} color={resolvedColor} />
                          <span
                            className="border-surface absolute -right-0.5 -bottom-0.5 size-2 rounded-full border-[1.5px]"
                            style={{ background: resolvedColor }}
                          />
                        </button>

                        <NameInput
                          name={name}
                          onRename={(newName) => crud.onRename(id, newName)}
                        />
                      </div>

                      <div className="flex basis-full items-center justify-end gap-2 md:basis-auto">
                        <CountButton
                          count={transactionCount}
                          onPress={previewParent}
                          label={`Voir les transactions de ${name}`}
                        />

                        <div className="flex w-40 items-center justify-end gap-2">
                          {budgetDetailed ? (
                            <div className="flex flex-col items-end">
                              <span className="num text-meta font-medium">
                                {euro.format(
                                  sumBy(
                                    childNodes,
                                    (child) => child.budgetAmount ?? 0,
                                  ),
                                )}
                                /mois
                              </span>
                              <span className="text-muted text-label whitespace-nowrap">
                                somme de {childNodes.length} sous-cat.
                              </span>
                            </div>
                          ) : (
                            <AmountInput
                              value={budgetAmount}
                              onCommit={(amount) => onSetAmount(id, amount)}
                            />
                          )}
                        </div>

                        <Dropdown>
                          <Button
                            variant="ghost"
                            size="sm"
                            isIconOnly
                            aria-label={`Actions sur ${name}`}
                          >
                            <EllipsisIcon />
                          </Button>
                          <Dropdown.Popover placement="bottom end">
                            <Dropdown.Menu aria-label={`Actions sur ${name}`}>
                              <Dropdown.Item
                                textValue="Ajouter une sous-catégorie"
                                onAction={() => crud.onAddChild(id)}
                              >
                                <PlusIcon />
                                <Label>Ajouter une sous-catégorie</Label>
                              </Dropdown.Item>
                              {childNodes.length > 0 && (
                                <Dropdown.Item
                                  textValue="Régime de budget"
                                  onAction={() =>
                                    void onSetDetailed(id, !budgetDetailed)
                                  }
                                >
                                  <ListTreeIcon />
                                  <Label>
                                    {budgetDetailed
                                      ? "Budget global pour la catégorie"
                                      : "Détailler le budget par sous-catégorie"}
                                  </Label>
                                </Dropdown.Item>
                              )}
                              <Separator />
                              <Dropdown.Item
                                textValue="Supprimer la catégorie"
                                variant="danger"
                                onAction={() =>
                                  crud.onDelete({
                                    id: id,
                                    name: name,
                                    transactionCount: transactionCount,
                                    childCount: childNodes.length,
                                    childNames: childNodes.map(
                                      (c) =>
                                        `${c.name} · ${c.transactionCount}`,
                                    ),
                                  })
                                }
                              >
                                <Trash2Icon />
                                <Label>Supprimer la catégorie</Label>
                              </Dropdown.Item>
                            </Dropdown.Menu>
                          </Dropdown.Popover>
                        </Dropdown>
                      </div>
                    </div>
                    <Accordion.Panel>
                      <Accordion.Body>
                        {childNodes.map(
                          ({ id, name, transactionCount, budgetAmount }, i) => {
                            const shade = shadeCategoryColor(
                              resolvedColor,
                              i,
                              childNodes.length,
                            );
                            return (
                              <div
                                key={id}
                                className="flex min-h-10 flex-wrap items-center justify-between px-2 ps-16"
                              >
                                <div className="flex min-w-0 grow-2 basis-full items-center gap-2 md:basis-0">
                                  <span
                                    className="size-2 rounded-full"
                                    style={{ background: shade }}
                                  />
                                  <NameInput
                                    name={name}
                                    onRename={(newName) =>
                                      crud.onRename(id, newName)
                                    }
                                  />
                                </div>
                                <div className="flex basis-full items-center justify-end gap-2 md:grow md:basis-0">
                                  <CountButton
                                    count={transactionCount}
                                    label={`Voir les transactions de ${name}`}
                                    onPress={() =>
                                      preview.openCategory({
                                        name: name,
                                        includesChildren: false,
                                        color: shade,
                                        soft,
                                        icon: icon,
                                      })
                                    }
                                  />
                                  <div className="flex w-40 items-center justify-end gap-2">
                                    {budgetDetailed ? (
                                      <AmountInput
                                        value={budgetAmount}
                                        onCommit={(amount) =>
                                          onSetAmount(id, amount)
                                        }
                                      />
                                    ) : (
                                      "—"
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    isIconOnly
                                    aria-label={`Supprimer ${name}`}
                                    onPress={() =>
                                      crud.onDelete({
                                        id: id,
                                        name: name,
                                        transactionCount: transactionCount,
                                        childCount: 0,
                                        childNames: [],
                                      })
                                    }
                                  >
                                    <XIcon />
                                  </Button>
                                </div>
                              </div>
                            );
                          },
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => crud.onAddChild(id)}
                          className="ml-16"
                        >
                          <PlusIcon />
                          Ajouter une sous-catégorie
                        </Button>
                      </Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              },
            )}
          </Accordion>
          <Button variant="ghost" onPress={crud.onAddParent} className="m-2">
            <PlusIcon />
            Ajouter une catégorie parente
          </Button>
        </Card.Content>
      </Card>

      <CategoryDeleteDialog
        target={crud.deleteTarget}
        deleting={crud.deleting}
        onOpenChange={(open) => !open && crud.closeDelete()}
        onConfirm={() => void crud.confirmDelete()}
      />

      <CategoryIdentityDialog
        target={crud.identityTarget}
        onOpenChange={(open) => !open && crud.closeIdentity()}
        ownersByColor={stats.ownersByColor}
        usageByIcon={stats.usageByIcon}
        onColorChange={crud.changeColor}
        onIconChange={crud.changeIcon}
      />

      <TransactionPreviewDrawer
        open={preview.preview !== null}
        onOpenChange={(open) => !open && preview.close()}
        title={preview.preview?.title ?? ""}
        description={preview.preview?.description}
        transactions={preview.preview?.txns ?? []}
        badge={preview.preview?.badge}
      />
    </>
  );
}

function NameInput({
  name,
  onRename,
}: {
  name: string;
  onRename: (name: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(name);

  const commit = async () => {
    const trimmed = value.trim();
    if (trimmed === name || trimmed.length === 0) {
      setValue(name);
      return;
    }
    if (!(await onRename(trimmed))) setValue(name);
  };

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setValue(name);
          e.currentTarget.blur();
        }
      }}
      aria-label={`Renommer ${name}`}
      className="max-w-70"
    />
  );
}

function CountButton({
  count,
  onPress,
  label,
}: {
  count: number;
  onPress: () => void;
  label: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onPress={onPress}
      aria-label={label}
      isDisabled={count === 0}
      className="num"
    >
      {count} txns
    </Button>
  );
}

function AmountInput({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (amount: number | null) => void;
}) {
  const [state, setState] = useState({ text: value?.toString() ?? "", value });
  if (state.value !== value) setState({ text: value?.toString() ?? "", value });

  const commit = () => {
    const digits = state.text.replace(/\D/g, "").slice(0, 5);
    const next = digits === "" ? null : Number(digits);
    if (next !== value) onCommit(next);
    setState({ text: digits, value });
  };

  return (
    <span className="relative inline-flex items-center">
      <Input
        value={state.text}
        inputMode="numeric"
        placeholder="—"
        aria-label="Budget mensuel"
        onChange={(e) =>
          setState((s) => ({
            ...s,
            text: e.target.value.replace(/\D/g, "").slice(0, 5),
          }))
        }
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setState({ text: value?.toString() ?? "", value });
            e.currentTarget.blur();
          }
        }}
        className="num w-24 pr-5 text-right"
      />
      <span className="text-muted text-meta pointer-events-none absolute right-2">
        €
      </span>
    </span>
  );
}
