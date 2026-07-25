import Link from "next/link";

import { DeleteButton } from "@/app/(app)/issues/delete-button";
import { IssueForm } from "@/app/(app)/issues/issue-form";
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
import { getCanEdit } from "@/lib/auth/editor";
import { getIssues } from "@/lib/supabase/queries";

type SearchParams = Promise<{ q?: string; page?: string }>;

function num(v: number | null): string {
  return (v ?? 0).toLocaleString("ko-KR");
}

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const search = sp.q ?? "";
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;

  const result = await getIssues({ search, page });
  const canEdit = await getCanEdit();

  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("page", String(nextPage));
    return `/issues?${params.toString()}`;
  };

  const exportHref = (() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    const qs = params.toString();
    return `/api/export/issues${qs ? `?${qs}` : ""}`;
  })();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">출고기록</h1>
          <a href={exportHref} className={buttonVariants({ variant: "outline" })}>
            엑셀 다운로드
          </a>
        </div>
        <p className="text-sm text-muted-foreground">
          자재 출고 등록 및 이력 · 총 {num(result.count)}건
        </p>
      </div>

      {/* 신규 등록 */}
      <details className="rounded-lg border" open>
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
          신규 출고 등록
        </summary>
        <div className="border-t p-4">
          <IssueForm canEdit={canEdit} />
        </div>
      </details>

      {/* 필터 */}
      <form
        method="get"
        action="/issues"
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
            placeholder="청구번호 · 장비명 · 담당자"
          />
        </div>
        <Button type="submit">조회</Button>
        <Link
          href="/issues"
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
              <TableHead>청구번호</TableHead>
              <TableHead>출고일</TableHead>
              <TableHead>자재</TableHead>
              <TableHead className="text-right">수량</TableHead>
              <TableHead>장비명</TableHead>
              <TableHead>담당자</TableHead>
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
                  출고 내역이 없습니다. 위 &ldquo;신규 출고 등록&rdquo;으로 추가하세요.
                </TableCell>
              </TableRow>
            ) : (
              result.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.req_no}</TableCell>
                  <TableCell>{row.issue_date}</TableCell>
                  <TableCell className="max-w-56 truncate">
                    {row.material
                      ? `${row.material.mdg_code ?? "-"} · ${row.material.material_name ?? ""}`
                      : `#${row.material_id ?? "-"}`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {num(row.qty)}
                  </TableCell>
                  <TableCell>{row.tool_name ?? "-"}</TableCell>
                  <TableCell>{row.staff ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    <DeleteButton id={row.id} label={row.req_no} canEdit={canEdit} />
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
