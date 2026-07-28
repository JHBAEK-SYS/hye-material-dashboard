"use client";

import { AlertTriangle, CircleAlert } from "lucide-react";
import { useId, useState } from "react";

import {
  commitBulkAdjust,
  previewBulkAdjust,
  type BulkAdjustCommitResult,
} from "@/app/(app)/materials/bulk-adjust/actions";
import { ReadOnlyNotice } from "@/components/read-only-notice";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  BulkAdjustInputRow,
  BulkAdjustPreviewRow,
} from "@/lib/materials/bulk-adjust";

function num(v: number): string {
  return v.toLocaleString("ko-KR");
}

/** 미리보기 성공 시 서버가 돌려주는 데이터(파싱 원본 rows 포함). */
type PreviewSuccess = {
  preview: BulkAdjustPreviewRow[];
  rows: BulkAdjustInputRow[];
};

/** 미리보기 표가 이보다 많으면 스크롤 가능한 컨테이너로 감싼다(렌더링 병목 방지). */
const LARGE_TABLE_THRESHOLD = 500;

const EXCLUDED_REASON: Record<"not_found" | "duplicate", string> = {
  not_found: "자재를 찾을 수 없습니다 (MDG코드·Part No 확인 필요)",
  duplicate: "파일 안에 같은 MDG코드·Part No 조합이 중복 등장함",
};

export function BulkAdjustForm({ canEdit }: { canEdit: boolean }) {
  const fileInputId = useId();

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewSuccess | null>(null);

  const [commitLoading, setCommitLoading] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitResult, setCommitResult] =
    useState<Extract<BulkAdjustCommitResult, { ok: true }> | null>(null);

  async function handlePreviewSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;

    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) {
      setPreviewError("엑셀 파일(.xlsx)을 선택하세요.");
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);
    setCommitResult(null);
    setCommitError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await previewBulkAdjust(formData);
      if (!result.ok) {
        setPreviewError(result.error);
        return;
      }
      setPreviewData({ preview: result.preview, rows: result.rows });
    } catch {
      setPreviewError("미리보기 생성 중 오류가 발생했습니다.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleCommit() {
    if (!canEdit || !previewData) return;

    setCommitLoading(true);
    setCommitError(null);
    setCommitResult(null);

    try {
      const result = await commitBulkAdjust(previewData.rows);
      if (!result.ok) {
        setCommitError(result.error);
        return;
      }
      setCommitResult(result);
    } catch {
      setCommitError("반영 중 오류가 발생했습니다.");
    } finally {
      setCommitLoading(false);
    }
  }

  const okRows =
    previewData?.preview.filter((r) => r.status === "ok") ?? [];
  const ambiguousRows =
    previewData?.preview.filter((r) => r.status === "ambiguous") ?? [];
  const otherExcludedRows =
    previewData?.preview.filter(
      (r) => r.status !== "ok" && r.status !== "ambiguous"
    ) ?? [];
  const excludedCount = ambiguousRows.length + otherExcludedRows.length;
  const negativeCount = okRows.filter(
    (r) => r.status === "ok" && r.negativeWarning
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {!canEdit ? <ReadOnlyNotice /> : null}

      <form
        onSubmit={handlePreviewSubmit}
        className="flex flex-col gap-3 rounded-lg border p-4"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fileInputId} className="text-sm font-medium">
            실사 결과 엑셀 (.xlsx)
          </label>
          <input
            id={fileInputId}
            name="file"
            type="file"
            accept=".xlsx"
            disabled={!canEdit}
            className="text-sm file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground">
            첫 행은 헤더여야 합니다. 헤더 텍스트에 &quot;MDG&quot;가 포함된 열을
            MDG코드 열로, &quot;수량&quot;이 포함된 열을 실사수량 열로 인식합니다.
            &quot;Part No&quot;(또는 &quot;품번&quot;) 열은 선택이며, 같은
            MDG코드로 등록된 자재가 2건 이상일 때 구분하는 용도로만 필요합니다.
          </p>
          <p className="text-xs text-muted-foreground">
            비활성 처리된 자재는 실사 조정 대상이 아닙니다 — 업로드 결과에
            반영되지 않습니다.
          </p>
        </div>
        <div>
          <Button type="submit" disabled={!canEdit || previewLoading}>
            {previewLoading ? "미리보기 생성 중…" : "미리보기"}
          </Button>
        </div>
      </form>

      <div aria-live="polite" className="flex flex-col gap-6">
        {previewError ? (
          <p className="text-sm text-destructive" role="alert">
            {previewError}
          </p>
        ) : null}

        {previewData ? (
          <>
            {/* 요약 */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border p-4 text-sm">
              <span className="font-medium">
                적용 대상 {num(okRows.length)}건 / 제외 {num(excludedCount)}건
              </span>
              {negativeCount > 0 ? (
                <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                  <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                  그중 음수 경고 {num(negativeCount)}건
                </span>
              ) : null}
              {ambiguousRows.length > 0 ? (
                <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                  <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                  구분 불가 {num(ambiguousRows.length)}건
                </span>
              ) : null}
            </div>

            {/* 적용 대상 (ok) */}
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">
                적용 대상 ({num(okRows.length)}건)
              </h2>
              <div
                className={
                  okRows.length > LARGE_TABLE_THRESHOLD
                    ? "max-h-[32rem] overflow-y-auto rounded-lg border"
                    : "rounded-lg border"
                }
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MDG코드</TableHead>
                      <TableHead>Part No</TableHead>
                      <TableHead>자재명</TableHead>
                      <TableHead className="text-right">현재고(전)</TableHead>
                      <TableHead className="text-right">실사수량(입력)</TableHead>
                      <TableHead>기초재고 변경(전→후)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {okRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-16 text-center text-muted-foreground"
                        >
                          적용 대상 행이 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      okRows.map((row, i) => {
                        if (row.status !== "ok") return null;
                        return (
                          <TableRow key={`${row.mdg_code}-${i}`}>
                            <TableCell className="font-medium">
                              {row.mdg_code}
                            </TableCell>
                            <TableCell>{row.part_no ?? "-"}</TableCell>
                            <TableCell className="max-w-64 truncate">
                              {row.material_name ?? "-"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {num(row.currentStock)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {num(row.target)}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              <span className="inline-flex flex-wrap items-center gap-1.5">
                                {num(row.prevOpeningStock)} → {num(row.newOpeningStock)}
                                {row.negativeWarning ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
                                    <AlertTriangle
                                      className="size-3.5 shrink-0"
                                      aria-hidden="true"
                                    />
                                    음수
                                  </span>
                                ) : null}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* 구분 불가 (ambiguous) — 같은 MDG코드에 자재가 여러 개라 Part No로 좁혀야 함 */}
            {ambiguousRows.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-destructive">
                  구분 불가 ({num(ambiguousRows.length)}건)
                </h2>
                <p className="text-xs text-muted-foreground">
                  같은 MDG코드로 등록된 자재가 여러 건이라 어느 자재인지 확정할
                  수 없습니다. 엑셀에 Part No 열을 추가해 아래 후보 중 하나로
                  좁혀 다시 업로드하세요.
                </p>
                <div
                  className={
                    ambiguousRows.length > LARGE_TABLE_THRESHOLD
                      ? "max-h-[24rem] overflow-y-auto rounded-lg border"
                      : "rounded-lg border"
                  }
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>MDG코드</TableHead>
                        <TableHead>입력 수량</TableHead>
                        <TableHead>후보 (Part No · 제조사 · 자재명)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ambiguousRows.map((row, i) => {
                        if (row.status !== "ambiguous") return null;
                        return (
                          <TableRow key={`${row.mdg_code}-${i}`}>
                            <TableCell className="font-medium">
                              {row.mdg_code}
                            </TableCell>
                            <TableCell>{row.qty || "(빈 값)"}</TableCell>
                            <TableCell className="whitespace-normal text-muted-foreground">
                              <ul className="flex flex-col gap-1">
                                {row.candidates.map((c) => (
                                  <li
                                    key={c.id}
                                    className="inline-flex items-center gap-1.5"
                                  >
                                    <CircleAlert
                                      className="size-3.5 shrink-0"
                                      aria-hidden="true"
                                    />
                                    {c.part_no ?? "(Part No 없음)"} ·{" "}
                                    {c.manufacturer ?? "-"} ·{" "}
                                    {c.material_name ?? "-"}
                                  </li>
                                ))}
                              </ul>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {/* 그 외 제외 (not_found / duplicate / invalid_qty) */}
            {otherExcludedRows.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold">
                  적용되지 않음 ({num(otherExcludedRows.length)}건)
                </h2>
                <div
                  className={
                    otherExcludedRows.length > LARGE_TABLE_THRESHOLD
                      ? "max-h-[24rem] overflow-y-auto rounded-lg border"
                      : "rounded-lg border"
                  }
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>MDG코드</TableHead>
                        <TableHead>입력 수량</TableHead>
                        <TableHead>사유</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {otherExcludedRows.map((row, i) => {
                        const reason =
                          row.status === "invalid_qty"
                            ? row.reason
                            : EXCLUDED_REASON[row.status];
                        return (
                          <TableRow key={`${row.mdg_code}-${i}`}>
                            <TableCell className="font-medium">
                              {row.mdg_code}
                            </TableCell>
                            <TableCell>{row.qty || "(빈 값)"}</TableCell>
                            <TableCell className="whitespace-normal text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <CircleAlert
                                  className="size-3.5 shrink-0"
                                  aria-hidden="true"
                                />
                                {reason}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {/* 확정 반영 */}
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div>
                <Button
                  type="button"
                  onClick={handleCommit}
                  disabled={!canEdit || commitLoading || okRows.length === 0}
                >
                  {commitLoading
                    ? "반영 중…"
                    : `일괄 반영 (${num(okRows.length)}건)`}
                </Button>
              </div>
              {commitError ? (
                <p className="text-sm text-destructive" role="alert">
                  {commitError}
                </p>
              ) : null}
              {commitResult ? (
                <div className="flex flex-col gap-2 text-sm">
                  <p
                    className="font-medium text-emerald-700 dark:text-emerald-400"
                    role="status"
                  >
                    {commitResult.message}
                  </p>
                  {commitResult.failures.length > 0 ? (
                    <ul className="list-inside list-disc text-destructive">
                      {commitResult.failures.map((f, i) => (
                        <li key={`${f.mdg_code}-${i}`}>
                          {f.mdg_code}: {f.reason}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
