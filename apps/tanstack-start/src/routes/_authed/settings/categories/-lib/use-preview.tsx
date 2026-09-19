import type { TransactionRow } from "@budget/api";
import type { ReactNode } from "react";

import { TagIcon } from "lucide-react";
import { useState } from "react";

import { CategoryIcon } from "~/component/category-icon";
import { useTRPCClient } from "~/lib/trpc";

// Supply the parent's soft color separately: mixing an already shaded child color
// again would make the background indistinguishable from the card.
interface PreviewRequest {
  name: string;
  includesChildren: boolean;
  color: string;
  soft: string;
  icon: string | null;
}

export interface PreviewBadge {
  color: string;
  soft: string;
  icon: ReactNode;
}

interface PreviewState {
  title: string;
  description: string;
  txns: TransactionRow[];
  badge: PreviewBadge;
}

export const PREVIEW_LIMIT = 25;

export function usePreview() {
  const trpcClient = useTRPCClient();
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const openCategory = async ({
    name,
    includesChildren,
    color,
    soft,
    icon,
  }: PreviewRequest) => {
    const result = await trpcClient.transactions.list.query({
      page: 1,
      sort: "date",
      order: "desc",
      category: name,
      limit: PREVIEW_LIMIT,
    });
    setPreview({
      title: name,
      description: `${result.rows.length} transaction(s) — aperçu de cette catégorie (${PREVIEW_LIMIT} plus récentes)${includesChildren ? ", y compris les sous-catégories" : ""}.`,
      txns: result.rows,
      badge: {
        color,
        soft,
        icon: <CategoryIcon name={icon} className="size-3.5" />,
      },
    });
  };

  const openUncategorized = async (count: number) => {
    const result = await trpcClient.transactions.list.query({
      page: 1,
      sort: "date",
      order: "desc",
      category: "none",
      limit: PREVIEW_LIMIT,
    });
    setPreview({
      title: "Sans catégorie",
      description: `${count} transaction(s) sans catégorie, les ${PREVIEW_LIMIT} plus récentes.`,
      txns: result.rows,
      badge: {
        color: "var(--warn)",
        soft: "var(--warn-soft)",
        icon: <TagIcon className="size-3.5" />,
      },
    });
  };

  return {
    preview,
    close: () => setPreview(null),
    openCategory,
    openUncategorized,
  };
}
