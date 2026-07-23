import { Badge } from "@/components/ui/badge";
import type { StockStatus } from "@/types/database";

const STYLES: Record<StockStatus, string> = {
  정상: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  안전재고미달:
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  결품: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  단종: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  오류: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
};

export function StatusBadge({ status }: { status: StockStatus | null }) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        미상
      </Badge>
    );
  }
  return (
    <Badge className={`border-transparent ${STYLES[status] ?? ""}`}>
      {status}
    </Badge>
  );
}
