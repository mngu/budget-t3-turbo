import { useState } from "react";
import {
  EllipsisIcon,
  ListTreeIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import type { NewCategoryOverviewType } from "@budget/api/schemas";
import { cn } from "@budget/ui";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@budget/ui/accordion";
import { Button } from "@budget/ui/button";
import { Card, CardContent } from "@budget/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@budget/ui/dropdown-menu";
import { Input } from "@budget/ui/input";

import type { computeStats } from "..";
import { CategoryIcon } from "~/component/category-icon";
import {
  shadeCategoryColor,
  softCategoryColor,
  useCategoryColor,
} from "~/lib/category-color";
import { euro0 } from "~/lib/format";
import { useTRPCClient } from "~/lib/trpc";
import { useRun } from "~/routes/_authed/settings/categories/-lib/use-run";
import { useCategoryCrud } from "../-lib/use-category-crud";
import { usePreview } from "../-lib/use-preview";
import { CategoryDeleteDialog } from "./category-delete-dialog";
import { CategoryIdentityDialog } from "./category-identity-dialog";
import { TransactionPreviewDrawer } from "./transaction-preview-drawer";

interface NewCategoryOverviewProps {
  categoryOverview: NewCategoryOverviewType;
  stats: ReturnType<typeof computeStats>;
}

export function NewCategoryOverview({
  categoryOverview,
  stats,
}: NewCategoryOverviewProps) {
  const trpcClient = useTRPCClient();
  const crud = useCategoryCrud();
  const preview = usePreview();
  const resolve = useCategoryColor();
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
        <CardContent className="p-0">
          <Accordion defaultValue={["shipping"]}>
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
                const soft = softCategoryColor(resolve(color));
                const childNodes = children ?? [];
                const previewParent = () =>
                  preview.openCategory({
                    name,
                    includesChildren: childNodes.length > 0,
                    color: resolve(color),
                    soft,
                    icon: icon,
                  });

                return (
                  <AccordionItem key={id} value={id}>
                    <div className="hover:bg-surface-2 flex w-full items-center justify-between gap-2 p-2">
                      <div className="flex items-center gap-2">
                        <AccordionTrigger />

                        <button
                          type="button"
                          onClick={() =>
                            crud.onOpenIdentity({ id, name, color, icon })
                          }
                          title="Couleur et icône"
                          aria-label={`Couleur et icône de ${name}`}
                          className="relative flex size-8 items-center justify-center rounded-md border"
                          style={{
                            background: softCategoryColor(resolvedColor),
                          }}
                        >
                          <CategoryIcon name={icon} color={resolvedColor} />
                          <span
                            className="border-card absolute -right-0.5 -bottom-0.5 size-2 rounded-full border-[1.5px]"
                            style={{ background: resolvedColor }}
                          />
                        </button>

                        <NameInput
                          name={name}
                          onRename={(newName) => crud.onRename(id, newName)}
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <CountButton
                          count={transactionCount}
                          onClick={previewParent}
                          title="Voir les transactions directes"
                        />

                        <div className="flex w-40 items-center justify-end gap-2">
                          {budgetDetailed ? (
                            <div className="flex flex-col items-end">
                              <span className={cn("num text-meta font-medium")}>
                                {euro0.format(
                                  childNodes.reduce(
                                    (sum: number, a) =>
                                      sum + (a.budgetAmount ?? 0),
                                    0,
                                  ),
                                )}
                                /mois
                              </span>
                              <span className="text-subtle text-label whitespace-nowrap">
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

                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions sur ${name}`}
                              />
                            }
                          >
                            <EllipsisIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => crud.onAddChild(id)}
                            >
                              <PlusIcon />
                              Ajouter une sous-catégorie
                            </DropdownMenuItem>
                            {childNodes.length > 0 && (
                              <DropdownMenuItem
                                onClick={() =>
                                  onSetDetailed(id, !budgetDetailed)
                                }
                              >
                                <ListTreeIcon />
                                {budgetDetailed
                                  ? "Budget global pour la catégorie"
                                  : "Détailler le budget par sous-catégorie"}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() =>
                                crud.onDelete({
                                  id: id,
                                  name: name,
                                  transactionCount: transactionCount,
                                  childCount: childNodes.length,
                                  childNames: childNodes.map(
                                    (c) => `${c.name} · ${c.transactionCount}`,
                                  ),
                                })
                              }
                            >
                              <Trash2Icon />
                              Supprimer la catégorie
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <AccordionContent>
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
                              className="hover:bg-surface-2 flex min-h-10 items-center justify-between px-2 ps-16"
                            >
                              <div className="flex flex-2 items-center gap-2">
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
                              <div className="flex flex-1 items-center justify-end gap-2">
                                <CountButton
                                  count={transactionCount}
                                  onClick={() =>
                                    preview.openCategory({
                                      name: name,
                                      includesChildren: false,
                                      // Palier de la teinte du parent, et son icône : une
                                      // sous-catégorie n'a ni l'une ni l'autre en propre. Le
                                      // fond reste l'aplat de la parente (voir
                                      // PreviewRequest.soft).
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
                                  size="icon-sm"
                                  aria-label={`Supprimer ${name}`}
                                  title="Supprimer"
                                  onClick={() =>
                                    crud.onDelete({
                                      id: id,
                                      name: name,
                                      transactionCount: transactionCount,
                                      childCount: 0,
                                      childNames: [],
                                    })
                                  }
                                  className="text-subtle hover:bg-bad-soft hover:text-bad flex items-center justify-center rounded-md"
                                >
                                  <XIcon className="size-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        },
                      )}

                      <Button
                        variant="ghost"
                        onClick={() => crud.onAddChild(id)}
                        className="border-border-strong text-muted-foreground hover:bg-accent hover:text-foreground text-control mt-1 ml-18 flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1"
                      >
                        <PlusIcon className="size-3" />
                        Ajouter une sous-catégorie
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                );
              },
            )}
            <button
              type="button"
              onClick={crud.onAddParent}
              className="text-muted-foreground hover:bg-surface-2 hover:text-foreground text-control flex w-full items-center gap-2.5 px-3 py-2.5"
            >
              <span className="border-border-strong flex size-8 items-center justify-center rounded-md border border-dashed">
                <PlusIcon className="size-3.5" />
              </span>
              Ajouter une catégorie parente
            </button>
          </Accordion>
        </CardContent>
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
        footer={preview.preview?.footer}
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
  className?: string;
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
      className="hover:border-border max-w-70 rounded-md border border-transparent bg-transparent"
    />
  );
}

function CountButton({
  count,
  onClick,
  title,
}: {
  count: number;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={count === 0}
      className={cn(
        "num hover:text-primary text-control text-right whitespace-nowrap disabled:pointer-events-none",
        count === 0 ? "text-subtle" : "text-muted-foreground",
      )}
    >
      {count} txns
    </button>
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
        className="num w-24 px-2 pr-5 text-right"
      />
      <span className="text-subtle text-meta pointer-events-none absolute right-2">
        €
      </span>
    </span>
  );
}
