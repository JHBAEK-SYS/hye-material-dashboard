import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getOpenPOCount,
  getRecentMovements,
  getShortageList,
  getStockSummary,
} from "@/lib/supabase/queries";
import { STOCK_STATUSES, type StockStatus } from "@/types/database";

function num(v: number | null): string {
  return (v ?? 0).toLocaleString("ko-KR");
}

const BAR_COLOR: Record<StockStatus, string> = {
  정상: "bg-emerald-500",
  안전재고미달: "bg-amber-500",
  결품: "bg-red-500",
  단종: "bg-zinc-400",
  오류: "bg-purple-500",
};

const statusHref = (s: StockStatus) =>
  `/materials?status=${encodeURIComponent(s)}`;

function KpiCard({
  title,
  description,
  value,
  accent,
  href,
}: {
  title: string;
  description: string;
  value: string;
  accent?: string;
  href?: string;
}) {
  const inner = (
    <Card className="h-full transition-colors hover:bg-muted/40">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <span className={`text-3xl font-semibold ${accent ?? ""}`}>{value}</span>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}

export default async function DashboardPage() {
  const [summary, shortage, openPO, movements] = await Promise.all([
    getStockSummary(),
    getShortageList(8),
    getOpenPOCount(),
    getRecentMovements(8),
  ]);

  const total = summary.total || 1;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
          <p className="text-sm text-muted-foreground">
            재고 현황(v_stock_status) 실시간 집계 · 총 {num(summary.total)}개 자재
          </p>
        </div>
        <Link
          href="/materials"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          자재 목록 →
        </Link>
      </div>

      {/* KPI 요약 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="총 SKU"
          description="등록된 전체 자재"
          value={num(summary.total)}
          href="/materials"
        />
        <KpiCard
          title="결품"
          description="현재고 0 · 즉시 조치"
          value={num(summary.byStatus.결품 ?? 0)}
          accent="text-red-600 dark:text-red-400"
          href={statusHref("결품")}
        />
        <KpiCard
          title="안전재고 미달"
          description="안전재고 아래로 하락"
          value={num(summary.byStatus.안전재고미달 ?? 0)}
          accent="text-amber-600 dark:text-amber-400"
          href={statusHref("안전재고미달")}
        />
        <KpiCard
          title="정상"
          description="안전재고 이상 보유"
          value={num(summary.byStatus.정상 ?? 0)}
          accent="text-emerald-600 dark:text-emerald-400"
          href={statusHref("정상")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 상태 분포 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">재고 상태 분포</CardTitle>
            <CardDescription>전체 {num(summary.total)}건 기준</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {STOCK_STATUSES.map((s) => {
              const c = summary.byStatus[s] ?? 0;
              const pct = (c / total) * 100;
              return (
                <Link
                  key={s}
                  href={statusHref(s)}
                  className="group flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium group-hover:underline">{s}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {num(c)} · {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${BAR_COLOR[s]}`}
                      style={{ width: `${Math.max(pct, c > 0 ? 1.5 : 0)}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {/* 긴급 조치: 결품 자재 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">긴급 조치 필요 · 결품</CardTitle>
            <CardDescription>
              활성 결품 자재 {num(shortage.total)}건 중 상위 {shortage.rows.length}건
            </CardDescription>
          </CardHeader>
          <CardContent>
            {shortage.rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                결품 자재가 없습니다. 👍
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>MDG코드</TableHead>
                    <TableHead>자재명</TableHead>
                    <TableHead>규격</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shortage.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.mdg_code ?? "-"}
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        {row.material_name ?? "-"}
                      </TableCell>
                      <TableCell>{row.size ?? "-"}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          <div className="px-6">
            <Link
              href={statusHref("결품")}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              전체 결품 목록 보기 →
            </Link>
          </div>
        </Card>
      </div>

      {/* 발주 · 입출고 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <KpiCard
          title="Open 발주 (PO)"
          description="미입고 도급발주"
          value={num(openPO)}
          accent={openPO > 0 ? "text-blue-600 dark:text-blue-400" : undefined}
          href="/orders?open=1"
        />

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">최근 입출고</CardTitle>
            <CardDescription>샵 입출고 최근 이동</CardDescription>
          </CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                입출고 내역이 없습니다.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>일자</TableHead>
                    <TableHead>구분</TableHead>
                    <TableHead>자재</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m, i) => (
                    <TableRow key={`${m.ref_no ?? "m"}-${i}`}>
                      <TableCell>{m.movement_date ?? "-"}</TableCell>
                      <TableCell>{m.movement_type ?? "-"}</TableCell>
                      <TableCell className="max-w-48 truncate">
                        {m.material
                          ? `${m.material.mdg_code ?? "-"} · ${m.material.material_name ?? ""}`
                          : `#${m.material_id ?? "-"}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(m.qty)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
