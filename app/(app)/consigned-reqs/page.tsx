import Link from "next/link";

import { ConsignedReqForm } from "@/app/(app)/consigned-reqs/consigned-req-form";
import { DeleteButton } from "@/app/(app)/consigned-reqs/delete-button";
import { ReceiveForm } from "@/app/(app)/consigned-reqs/receive-form";
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
import { receiptStatus, remainingQty } from "@/lib/receive/validate";
import { getConsignedReqs } from "@/lib/supabase/queries";

type SearchParams = Promise<{ q?: string; open?: string; page?: string }>;

function num(v: number | null): string {
  return (v ?? 0).toLocaleString("ko-KR");
}

export default async function ConsignedReqsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const search = sp.q ?? "";
  const openOnly = sp.open === "1";
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;

  const result = await getConsignedReqs({ search, openOnly, page });

  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (openOnly) params.set("open", "1");
    params.set("page", String(nextPage));
    return `/consigned-reqs?${params.toString()}`;
  };

  const exportHref = (() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (openOnly) params.set("open", "1");
    const qs = params.toString();
    return `/api/export/consigned-reqs${qs ? `?${qs}` : ""}`;
  })();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">사급청구</h1>
          <a href={exportHref} className={buttonVariants({ variant: "outline" })}>
            엑셀 다운로드
          </a>
        </div>
        <p className="text-sm text-muted-foreground">
          사급청구 등록 · 입고처리 · 미입고 현황 · 총 {num(result.count)}건
        </p>
      </div>

      {/* 신규 등록 */}
      <details className="rounded-lg border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
          + 신규 사급청구 등록
        </summary>
        <div className="border-t p-4">
          <ConsignedReqForm />
        </div>
      </details>

      {/* 필터 */}
      <form
        method="get"
        action="/consigned-reqs"
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
            placeholder="사급청구번호"
          />
        </div>
        <label
          className="flex h-9 items-center gap-2 text-sm"
          title="전량 입고되지 않은 건 (미입고 · 부분입고)"
        >
          <input
            type="checkbox"
            name="open"
            value="1"
            defaultChecked={openOnly}
            className="size-4"
          />
          미완료만
        </label>
        <Button type="submit">조회</Button>
        <Link
          href="/consigned-reqs"
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
              <TableHead>사급청구번호</TableHead>
              <TableHead>요청일</TableHead>
              <TableHead>자재</TableHead>
              <TableHead className="text-right">요청수량</TableHead>
              <TableHead className="text-right">입고수량</TableHead>
              <TableHead>상태 / 입고처리</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={7}
                >
                  사급청구 내역이 없습니다. 위 &ldquo;신규 사급청구 등록&rdquo;으로 추가하세요.
                </TableCell>
              </TableRow>
            ) : (
              result.rows.map((row) => {
                const status = receiptStatus(row.request_qty, row.received_qty);
                const remaining = remainingQty(row.request_qty, row.received_qty);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.sg_no}</TableCell>
                    <TableCell>{row.request_date}</TableCell>
                    <TableCell className="max-w-56 truncate">
                      {row.material
                        ? `${row.material.mdg_code ?? "-"} · ${row.material.material_name ?? ""}`
                        : `#${row.material_id ?? "-"}`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(row.request_qty)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {(row.received_qty ?? 0) > 0 ? num(row.received_qty) : "-"}
                    </TableCell>
                    <TableCell>
                      {status === "입고완료" ? (
                        <Badge className="border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          입고완료 {row.received_date}
                        </Badge>
                      ) : status === "부분입고" ? (
                        <div className="flex flex-col gap-1.5">
                          <Badge className="border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            부분입고 {num(row.received_qty)}/{num(row.request_qty)}
                            {row.received_date ? ` · ${row.received_date}` : ""}
                          </Badge>
                          <ReceiveForm
                            id={row.id}
                            defaultQty={remaining}
                            defaultRemark={row.remark}
                          />
                        </div>
                      ) : (
                        <ReceiveForm
                          id={row.id}
                          defaultQty={remaining}
                          defaultRemark={row.remark}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteButton id={row.id} label={row.sg_no} />
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
