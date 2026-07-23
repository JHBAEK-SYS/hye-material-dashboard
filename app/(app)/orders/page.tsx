import Link from "next/link";

import { OrderForm } from "@/app/(app)/orders/order-form";
import { ReceiveForm } from "@/app/(app)/orders/receive-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPurchaseOrders } from "@/lib/supabase/queries";

type SearchParams = Promise<{ q?: string; open?: string; page?: string }>;

function num(v: number | null): string {
  return (v ?? 0).toLocaleString("ko-KR");
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const search = sp.q ?? "";
  const openOnly = sp.open === "1";
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;

  const result = await getPurchaseOrders({ search, openOnly, page });

  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (openOnly) params.set("open", "1");
    params.set("page", String(nextPage));
    return `/orders?${params.toString()}`;
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">도급발주</h1>
        <p className="text-sm text-muted-foreground">
          발주 등록 · 입고처리 · 미입고 현황 · 총 {num(result.count)}건
        </p>
      </div>

      {/* 신규 등록 */}
      <details className="rounded-lg border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
          + 신규 발주 등록
        </summary>
        <div className="border-t p-4">
          <OrderForm />
        </div>
      </details>

      {/* 필터 */}
      <form
        method="get"
        action="/orders"
        className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
      >
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">
            검색
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={search}
            placeholder="발주번호 · 거래처"
          />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="open"
            value="1"
            defaultChecked={openOnly}
            className="size-4"
          />
          미입고만
        </label>
        <Button type="submit">조회</Button>
        <Link
          href="/orders"
          className={buttonVariants({ variant: "outline" })}
        >
          초기화
        </Link>
      </form>

      {/* 목록 */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>발주번호</TableHead>
              <TableHead>발주일</TableHead>
              <TableHead>거래처</TableHead>
              <TableHead>자재</TableHead>
              <TableHead className="text-right">발주수량</TableHead>
              <TableHead className="text-right">입고수량</TableHead>
              <TableHead>상태 / 입고처리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={7}
                >
                  발주 내역이 없습니다. 위 &ldquo;신규 발주 등록&rdquo;으로 추가하세요.
                </TableCell>
              </TableRow>
            ) : (
              result.rows.map((row) => {
                const received = row.received_date != null;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.po_no}</TableCell>
                    <TableCell>{row.order_date}</TableCell>
                    <TableCell>{row.vendor}</TableCell>
                    <TableCell className="max-w-56 truncate">
                      {row.material
                        ? `${row.material.mdg_code ?? "-"} · ${row.material.material_name ?? ""}`
                        : `#${row.material_id ?? "-"}`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(row.order_qty)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {received ? num(row.received_qty) : "-"}
                    </TableCell>
                    <TableCell>
                      {received ? (
                        <Badge className="border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          입고완료 {row.received_date}
                        </Badge>
                      ) : (
                        <ReceiveForm id={row.id} defaultQty={row.order_qty} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {page} / {result.pageCount} 페이지
        </span>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={buildHref(page - 1)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              이전
            </Link>
          ) : (
            <Button variant="outline" size="sm" disabled>
              이전
            </Button>
          )}
          {page < result.pageCount ? (
            <Link
              href={buildHref(page + 1)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              다음
            </Link>
          ) : (
            <Button variant="outline" size="sm" disabled>
              다음
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
