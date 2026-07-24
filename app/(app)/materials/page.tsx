import Link from "next/link";

import { MaterialForm } from "@/app/(app)/materials/material-form";
import { StatusBadge } from "@/components/status-badge";
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
import { getMaterials } from "@/lib/supabase/queries";
import { STOCK_STATUSES, type StockStatus } from "@/types/database";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  active?: string;
  page?: string;
}>;

function num(v: number | null): string {
  return (v ?? 0).toLocaleString("ko-KR");
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const search = sp.q ?? "";
  const status = STOCK_STATUSES.includes(sp.status as StockStatus)
    ? (sp.status as StockStatus)
    : undefined;
  const activeOnly = sp.active === "1";
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;

  const result = await getMaterials({ search, status, activeOnly, page });

  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (status) params.set("status", status);
    if (activeOnly) params.set("active", "1");
    params.set("page", String(nextPage));
    return `/materials?${params.toString()}`;
  };

  const rangeStart = result.count === 0 ? 0 : (page - 1) * result.pageSize + 1;
  const rangeEnd = Math.min(page * result.pageSize, result.count);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">자재 마스터</h1>
        <p className="text-sm text-muted-foreground">
          재고 현황(v_stock_status) 기준 · 총 {num(result.count)}건
        </p>
      </div>

      {/* 신규 등록 */}
      <details className="rounded-lg border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
          + 신규 자재 등록
        </summary>
        <div className="border-t p-4">
          <MaterialForm />
        </div>
      </details>

      {/* 필터 */}
      <form
        method="get"
        action="/materials"
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
            placeholder="MDG코드 · Part No · 자재명"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            상태
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">전체</option>
            {STOCK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            value="1"
            defaultChecked={activeOnly}
            className="size-4"
          />
          활성만
        </label>
        <Button type="submit">조회</Button>
        <Link
          href="/materials"
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
              <TableHead>MDG코드</TableHead>
              <TableHead>Part No</TableHead>
              <TableHead>자재명</TableHead>
              <TableHead>규격</TableHead>
              <TableHead>제조사</TableHead>
              <TableHead className="text-right">안전재고</TableHead>
              <TableHead className="text-right">현재고</TableHead>
              <TableHead>단위</TableHead>
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={9}
                >
                  조회 결과가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              result.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/materials/${row.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {row.mdg_code ?? "(상세)"}
                    </Link>
                  </TableCell>
                  <TableCell>{row.part_no ?? "-"}</TableCell>
                  <TableCell className="max-w-64 truncate">
                    {row.material_name ?? "-"}
                  </TableCell>
                  <TableCell>{row.size ?? "-"}</TableCell>
                  <TableCell>{row.manufacturer ?? "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {num(row.safety_stock)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {num(row.current_stock)}
                  </TableCell>
                  <TableCell>{row.unit ?? "-"}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {num(rangeStart)}–{num(rangeEnd)} / {num(result.count)}
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
          <span className="text-sm">
            {page} / {result.pageCount}
          </span>
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
