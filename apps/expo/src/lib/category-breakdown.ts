import type { CategoryBreakdownItem } from "@budget/api";

export interface PieSlice {
  value: number;
  color: string;
  text: string;
}

export function toPieChartData(items: CategoryBreakdownItem[]): PieSlice[] {
  return items
    .filter((item) => item.total > 0)
    .map((item) => ({
      value: item.total,
      color: item.color,
      text: item.category,
    }));
}
