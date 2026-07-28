"use client";

import { CircleAlert } from "lucide-react";
import { useId, useState } from "react";

import {
  commitBulkNew,
  previewBulkNew,
  type BulkNewCommitResult,
} from "@/app/(app)/materials/bulk-new/actions";
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
  BulkNewPreviewRow,
  BulkNewSummary,
} from "@/lib/materials/bulk-new";
import type { BulkNewInputRow } from "@/lib/materials/parse-bulk-new-file";

function num(v: number): string {
  return v.toLocaleString("ko-KR");
}

/** 미리보기 성공 시 서버가 돌려주는 데이터(파싱 원본 rows 포함). */
type PreviewSuccess = {
  preview: BulkNewPreviewRow[];
  rows: BulkNewInputRow[];
  summary: BulkNewSummary;
};

/** 상태별 그룹에서 이보다 많은 행은 표에 표시하지 않고 "외 N건"으로 줄인다. */
const MAX_VISIBLE_ROWS = 50;

type NewRow = Extract<BulkNewPreviewRow, { status: "new" }>;
type FillExistingRow = Extract<BulkNewPreviewRow, { status: "fill_existing" }>;
type FillAmbiguousRow = Extract<
  BulkNewPreviewRow,
  { status: "fill_ambiguous" }
>;
type AlreadyRegisteredRow = Extract<
  BulkNewPreviewRow,
  { status: "already_registered" }
>;
type DuplicateInFileRow = Extract<
  BulkNewPreviewRow,
  { status: "duplicate_in_file" }
>;
type InvalidRow = Extract<BulkNewPreviewRow, { status: "invalid" }>;

function visibleSlice<T>(rows: T[]): { visible: T[]; hiddenCount: number } {
  return {
    visible: rows.slice(0, MAX_VISIBLE_ROWS),
    hiddenCount: Math.max(0, rows.length - MAX_VISIBLE_ROWS),
  };
}

export function BulkNewForm({ canEdit }: { canEdit: boolean }) {
  const fileInputId = useId();

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewSuccess | null>(null);
  // fillRows 배열과 같은 순서/길이로 유지되는 체크박스 상태. 기본값은
  // 전부 해제 — 기존 데이터를 바꾸는 작업이라 사용자가 직접 골라야 한다.
  const [selectedFill, setSelectedFill] = useState<boolean[]>([]);

  const [commitLoading, setCommitLoading] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitResult, setCommitResult] =
    useState<Extract<BulkNewCommitResult, { ok: true }> | null>(null);

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
    setSelectedFill([]);
    setCommitResult(null);
    setCommitError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await previewBulkNew(formData);
      if (!result.ok) {
        setPreviewError(result.error);
        return;
      }
      setPreviewData({
        preview: result.preview,
        rows: result.rows,
        summary: result.summary,
      });
      const fillCount = result.preview.filter(
        (r) => r.status === "fill_existing"
      ).length;
      setSelectedFill(new Array(fillCount).fill(false));
    } catch {
      setPreviewError("미리보기 생성 중 오류가 발생했습니다.");
    } finally {
      setPreviewLoading(false);
    }
  }

  const fillRows: FillExistingRow[] =
    (previewData?.preview.filter(
      (r): r is FillExistingRow => r.status === "fill_existing"
    ) as FillExistingRow[]) ?? [];

  const checkedCount = selectedFill.filter(Boolean).length;
  const allChecked = fillRows.length > 0 && checkedCount === fillRows.length;

  function toggleOne(index: number) {
    setSelectedFill((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }

  function toggleAll() {
    setSelectedFill((prev) => prev.map(() => !allChecked));
  }

  async function handleCommit() {
    if (!canEdit || !previewData) return;

    setCommitLoading(true);
    setCommitError(null);
    setCommitResult(null);

    try {
      const approvedFillTargetIds = fillRows
        .filter((_, i) => selectedFill[i])
        .map((r) => r.targetId);
      const result = await commitBulkNew(
        previewData.rows,
        approvedFillTargetIds
      );
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

  const summary = previewData?.summary;
  const newRows: NewRow[] =
    (previewData?.preview.filter(
      (r): r is NewRow => r.status === "new"
    ) as NewRow[]) ?? [];
  const alreadyRows: AlreadyRegisteredRow[] =
    (previewData?.preview.filter(
      (r): r is AlreadyRegisteredRow => r.status === "already_registered"
    ) as AlreadyRegisteredRow[]) ?? [];
  const dupRows: DuplicateInFileRow[] =
    (previewData?.preview.filter(
      (r): r is DuplicateInFileRow => r.status === "duplicate_in_file"
    ) as DuplicateInFileRow[]) ?? [];
  const ambiguousRows: FillAmbiguousRow[] =
    (previewData?.preview.filter(
      (r): r is FillAmbiguousRow => r.status === "fill_ambiguous"
    ) as FillAmbiguousRow[]) ?? [];
  const invalidRows: InvalidRow[] =
    (previewData?.preview.filter(
      (r): r is InvalidRow => r.status === "invalid"
    ) as InvalidRow[]) ?? [];

  const applyTotal = (summary?.new ?? 0) + checkedCount;

  return (
    <div className="flex flex-col gap-6">
      {!canEdit ? <ReadOnlyNotice /> : null}

      <form
        onSubmit={handlePreviewSubmit}
        className="flex flex-col gap-3 rounded-lg border p-4"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fileInputId} className="text-sm font-medium">
            자재 목록 엑셀 (.xlsx)
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
            첫 행은 헤더여야 합니다. 헤더 행에 &quot;Manufacturer&quot;(제조사),
            &quot;MDG Code&quot;(MDG코드), &quot;Part Number&quot;(Part No)
            이름들이 포함된 열이 있어야 합니다.
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

        {previewData && summary ? (
          <>
            {/* 요약 배지 */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border p-4 text-sm">
              <span className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-1 font-medium">
                신규 등록 {num(summary.new)}건
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2.5 py-1 font-medium">
                기존 행에 MDG코드 채움 {num(summary.fill_existing)}건
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-muted-foreground">
                이미 등록됨 {num(summary.already_registered)}건
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-muted-foreground">
                파일 내 중복 {num(summary.duplicate_in_file)}건
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium text-destructive">
                구분 불가 {num(summary.fill_ambiguous)}건
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium text-destructive">
                오류 {num(summary.invalid)}건
              </span>
            </div>

            {/* 신규 등록 */}
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">
                신규 등록 ({num(newRows.length)}건)
              </h2>
              <PreviewTable
                emptyMessage="신규 등록 대상 행이 없습니다."
                rows={visibleSlice(newRows)}
                columns={["MDG코드", "Part No", "제조사", "자재명(상속)", "규격(상속)"]}
                renderRow={(row, i) => (
                  <TableRow key={`new-${row.mdg_code}-${i}`}>
                    <TableCell className="font-medium">{row.mdg_code}</TableCell>
                    <TableCell>{row.part_no || "-"}</TableCell>
                    <TableCell>{row.manufacturer || "-"}</TableCell>
                    <TableCell className="max-w-64 truncate">
                      {row.inheritedName ?? "-"}
                    </TableCell>
                    <TableCell>{row.inheritedSize ?? "-"}</TableCell>
                  </TableRow>
                )}
              />
            </div>

            {/* 기존 행에 MDG코드 채움 (체크박스 별도 섹션) */}
            <div className="flex flex-col gap-2 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">
                  기존 행에 MDG코드 채움 ({num(fillRows.length)}건 중{" "}
                  {num(checkedCount)}건 선택됨)
                </h2>
                {fillRows.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canEdit}
                    onClick={toggleAll}
                  >
                    {allChecked ? "전체 해제" : "전체 선택"}
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                기존 자재 데이터를 바꾸는 작업이라 기본값은 전부 해제되어
                있습니다. 반영할 행만 체크하세요.
              </p>
              <div
                className={
                  fillRows.length > MAX_VISIBLE_ROWS
                    ? "max-h-[24rem] overflow-y-auto rounded-lg border"
                    : "rounded-lg border"
                }
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>MDG코드</TableHead>
                      <TableHead>Part No</TableHead>
                      <TableHead>제조사</TableHead>
                      <TableHead>대상 자재(기존 자재명)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fillRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-16 text-center text-muted-foreground"
                        >
                          채우기 대상 행이 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleSlice(fillRows).visible.map((row, i) => (
                        <TableRow key={`fill-${row.mdg_code}-${i}`}>
                          <TableCell>
                            <input
                              type="checkbox"
                              className="size-4"
                              checked={selectedFill[i] ?? false}
                              disabled={!canEdit}
                              onChange={() => toggleOne(i)}
                              aria-label={`${row.mdg_code} 채우기 선택`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.mdg_code}
                          </TableCell>
                          <TableCell>{row.part_no || "-"}</TableCell>
                          <TableCell>{row.manufacturer || "-"}</TableCell>
                          <TableCell className="max-w-64 truncate">
                            {row.targetName ?? "-"} (id={row.targetId})
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {visibleSlice(fillRows).hiddenCount > 0 ? (
                <p className="text-xs text-muted-foreground">
                  외 {num(visibleSlice(fillRows).hiddenCount)}건 (표에는 최대{" "}
                  {MAX_VISIBLE_ROWS}건까지만 표시됩니다)
                </p>
              ) : null}
            </div>

            {/* 이미 등록됨 */}
            {alreadyRows.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold">
                  이미 등록됨 ({num(alreadyRows.length)}건)
                </h2>
                <PreviewTable
                  emptyMessage="없음"
                  rows={visibleSlice(alreadyRows)}
                  columns={["MDG코드", "Part No", "제조사", "기존 자재ID"]}
                  renderRow={(row, i) => (
                    <TableRow key={`already-${row.mdg_code}-${i}`}>
                      <TableCell className="font-medium">
                        {row.mdg_code}
                      </TableCell>
                      <TableCell>{row.part_no || "-"}</TableCell>
                      <TableCell>{row.manufacturer || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.existingId}
                      </TableCell>
                    </TableRow>
                  )}
                />
              </div>
            ) : null}

            {/* 파일 내 중복 */}
            {dupRows.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold">
                  파일 내 중복 ({num(dupRows.length)}건)
                </h2>
                <PreviewTable
                  emptyMessage="없음"
                  rows={visibleSlice(dupRows)}
                  columns={["MDG코드", "Part No", "제조사"]}
                  renderRow={(row, i) => (
                    <TableRow key={`dup-${row.mdg_code}-${i}`}>
                      <TableCell className="font-medium">
                        {row.mdg_code}
                      </TableCell>
                      <TableCell>{row.part_no || "-"}</TableCell>
                      <TableCell>{row.manufacturer || "-"}</TableCell>
                    </TableRow>
                  )}
                />
              </div>
            ) : null}

            {/* 구분 불가 */}
            {ambiguousRows.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold">
                  구분 불가 ({num(ambiguousRows.length)}건)
                </h2>
                <PreviewTable
                  emptyMessage="없음"
                  rows={visibleSlice(ambiguousRows)}
                  columns={["MDG코드", "Part No", "제조사", "후보 자재ID"]}
                  renderRow={(row, i) => (
                    <TableRow key={`ambiguous-${row.mdg_code}-${i}`}>
                      <TableCell className="font-medium">
                        {row.mdg_code}
                      </TableCell>
                      <TableCell>{row.part_no || "-"}</TableCell>
                      <TableCell>{row.manufacturer || "-"}</TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CircleAlert
                            className="size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          {row.candidateIds.join(", ")}
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                />
              </div>
            ) : null}

            {/* 오류 */}
            {invalidRows.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold">
                  오류 ({num(invalidRows.length)}건)
                </h2>
                <PreviewTable
                  emptyMessage="없음"
                  rows={visibleSlice(invalidRows)}
                  columns={["MDG코드", "Part No", "제조사", "사유"]}
                  renderRow={(row, i) => (
                    <TableRow key={`invalid-${row.mdg_code}-${i}`}>
                      <TableCell className="font-medium">
                        {row.mdg_code || "(빈 값)"}
                      </TableCell>
                      <TableCell>{row.part_no || "-"}</TableCell>
                      <TableCell>{row.manufacturer || "-"}</TableCell>
                      <TableCell className="whitespace-normal text-destructive">
                        <span className="inline-flex items-center gap-1.5">
                          <CircleAlert
                            className="size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          {row.reason}
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                />
              </div>
            ) : null}

            {/* 확정 반영 */}
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div>
                <Button
                  type="button"
                  onClick={handleCommit}
                  disabled={!canEdit || commitLoading || applyTotal === 0}
                >
                  {commitLoading
                    ? "반영 중…"
                    : `신규 ${num(summary.new)}건 등록 + 기존 ${num(
                        checkedCount
                      )}건 채우기`}
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
                        <li key={`${f.mdg_code}-${f.part_no}-${i}`}>
                          {f.mdg_code} / {f.part_no}: {f.reason}
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

function PreviewTable<T>({
  rows,
  columns,
  renderRow,
  emptyMessage,
}: {
  rows: { visible: T[]; hiddenCount: number };
  columns: string[];
  renderRow: (row: T, index: number) => React.ReactNode;
  emptyMessage: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className={
          rows.visible.length > MAX_VISIBLE_ROWS
            ? "max-h-[24rem] overflow-y-auto rounded-lg border"
            : "rounded-lg border"
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c}>{c}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-16 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.visible.map((row, i) => renderRow(row, i))
            )}
          </TableBody>
        </Table>
      </div>
      {rows.hiddenCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          외 {num(rows.hiddenCount)}건 (표에는 최대 {MAX_VISIBLE_ROWS}건까지만
          표시됩니다)
        </p>
      ) : null}
    </div>
  );
}
