import { Card, CardContent, CardHeader, CardTitle } from "@budget/ui/card";

export function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="flex-1">
      <CardHeader className="pb-0">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
