"use server";

import { revalidatePath } from "next/cache";

import {
  buildBulkNewPreview,
  summarizeBulkNewPreview,
  type BulkNewPreviewRow,
  type BulkNewSummary,
} from "@/lib/materials/bulk-new";
import { fetchAllMaterialsForBulkNew } from "@/lib/materials/bulk-new-data";
import {
  parseBulkNewFile,
  type BulkNewInputRow,
} from "@/lib/materials/parse-bulk-new-file";
import { getCanEdit } from "@/lib/auth/editor";
import { createClient } from "@/lib/supabase/server";

/**
 * 자재 마스터 신규 일괄 등록(엑셀 업로드) — 재고 일괄 조정(bulk-adjust)과
 * 완전히 같은 Server Action 2단계 구조. previewBulkNew는 DB에 절대 쓰지
 * 않고, commitBulkNew만 확정 반영한다.
 */

export type BulkNewPreviewResult =
  | { ok: false; error: string }
  | {
      ok: true;
      preview: BulkNewPreviewRow[];
      rows: BulkNewInputRow[];
      summary: BulkNewSummary;
    };

/**
 * 1단계: 업로드된 엑셀을 파싱해 미리보기만 계산한다. DB에는 절대 쓰지 않는다.
 * 반환된 rows(원본 파싱 결과, 문자열 그대로)는 클라이언트가 보관했다가
 * 확정(commitBulkNew) 호출 시 다시 넘겨야 한다 — 확정 단계가 미리보기
 * 계산값을 그대로 믿지 않고 서버에서 다시 검증/재계산하기 위함이다.
 */
export async function previewBulkNew(
  formData: FormData
): Promise<BulkNewPreviewResult> {
  if (!(await getCanEdit())) {
    return { ok: false, error: "수정 권한이 없습니다. 관리자에게 문의하세요." };
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "엑셀 파일(.xlsx)을 첨부하세요." };
  }

  let rows: BulkNewInputRow[];
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    rows = await parseBulkNewFile(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return { ok: false, error: `엑셀 파싱 실패: ${message}` };
  }

  if (rows.length === 0) {
    return { ok: false, error: "엑셀에서 읽을 수 있는 데이터 행이 없습니다." };
  }

  try {
    const existing = await fetchAllMaterialsForBulkNew();
    const preview = buildBulkNewPreview(rows, existing);
    const summary = summarizeBulkNewPreview(preview);
    return { ok: true, preview, rows, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return { ok: false, error: `미리보기 생성 실패: ${message}` };
  }
}

export interface BulkNewCommitFailure {
  mdg_code: string;
  part_no: string;
  reason: string;
}

export type BulkNewCommitResult =
  | { ok: false; error: string }
  | {
      ok: true;
      message: string;
      summary: { inserted: number; filled: number; failed: number; skipped: number };
      failures: BulkNewCommitFailure[];
    };

function isValidInputRow(v: unknown): v is BulkNewInputRow {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.mdg_code === "string" &&
    typeof r.part_no === "string" &&
    typeof r.manufacturer === "string"
  );
}

function isValidApprovedIds(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

// materials INSERT 를 한 번에 너무 많은 행으로 보내지 않도록 나누는 크기
// (URL/페이로드 과대 방지). bulk-adjust의 IN_CHUNK_SIZE와 같은 값을 쓴다.
const INSERT_CHUNK_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/**
 * 2단계: 확정 반영.
 *
 * 클라이언트가 1단계(previewBulkNew)에서 받은 원본 rows를 그대로 다시
 * 보내면, 미리보기 시점 값을 신뢰하지 않고 서버가 다시 materials 전량 조회
 * + buildBulkNewPreview 재계산을 수행한다(그 사이 다른 사용자가 자재를
 * 추가/수정했을 수 있음).
 *
 * - status === "new" 인 행만 materials INSERT 대상. 여러 건을 배열로 한 번에
 *   insert하되 INSERT_CHUNK_SIZE(500)건씩 나눠 보낸다. 청크 하나가 실패하면
 *   그 청크의 행들만 failures에 기록하고 나머지 청크는 계속 진행한다.
 * - status === "fill_existing" 이고 approvedFillTargetIds 에 targetId가
 *   포함된 경우에만 materials UPDATE { mdg_code } WHERE id = targetId.
 *   포함되어 있지 않으면 건너뛴다(skipped) — 기본은 사용자가 화면에서 직접
 *   체크한 것만 반영.
 * - 그 외 상태(already_registered/duplicate_in_file/fill_ambiguous/invalid)는
 *   전부 skipped.
 */
export async function commitBulkNew(
  rows: BulkNewInputRow[],
  approvedFillTargetIds: number[]
): Promise<BulkNewCommitResult> {
  if (!(await getCanEdit())) {
    return { ok: false, error: "수정 권한이 없습니다. 관리자에게 문의하세요." };
  }

  if (!Array.isArray(rows) || rows.length === 0 || !rows.every(isValidInputRow)) {
    return { ok: false, error: "잘못된 요청입니다 (rows 형식 오류)." };
  }
  if (!isValidApprovedIds(approvedFillTargetIds)) {
    return {
      ok: false,
      error: "잘못된 요청입니다 (approvedFillTargetIds 형식 오류).",
    };
  }

  let existing: Awaited<ReturnType<typeof fetchAllMaterialsForBulkNew>>;
  try {
    existing = await fetchAllMaterialsForBulkNew();
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return { ok: false, error: `자재 조회 실패: ${message}` };
  }

  // 미리보기 값을 그대로 믿지 않고 여기서 다시 계산한다.
  const preview = buildBulkNewPreview(rows, existing);
  const approvedSet = new Set(approvedFillTargetIds);

  const supabase = await createClient();

  let inserted = 0;
  let filled = 0;
  let failed = 0;
  const failures: BulkNewCommitFailure[] = [];

  // --- 신규 등록: status === "new" 행을 청크로 나눠 insert ---
  const newRows = preview.filter(
    (r): r is Extract<BulkNewPreviewRow, { status: "new" }> =>
      r.status === "new"
  );
  for (const batch of chunk(newRows, INSERT_CHUNK_SIZE)) {
    if (batch.length === 0) continue;
    const payload = batch.map((r) => ({
      mdg_code: r.mdg_code,
      part_no: r.part_no || null,
      manufacturer: r.manufacturer || null,
      material_name: r.inheritedName,
      size: r.inheritedSize,
      safety_stock: 0,
      opening_stock: 0,
      is_active: true,
    }));

    const { data, error } = await supabase
      .from("materials")
      .insert(payload)
      .select();

    if (error) {
      failed += batch.length;
      for (const r of batch) {
        failures.push({
          mdg_code: r.mdg_code,
          part_no: r.part_no,
          reason: `등록 실패: ${error.message}`,
        });
      }
      continue;
    }
    if (!data || data.length === 0) {
      failed += batch.length;
      for (const r of batch) {
        failures.push({
          mdg_code: r.mdg_code,
          part_no: r.part_no,
          reason:
            "저장이 반영되지 않았습니다. materials 테이블에 authenticated INSERT 정책이 필요합니다.",
        });
      }
      continue;
    }

    inserted += data.length;
    if (data.length < batch.length) {
      // 일부만 반영된 경우를 대비한 방어적 처리(정상적으로는 발생하지 않아야 함).
      failed += batch.length - data.length;
    }
  }

  // --- 기존 행에 MDG코드 채우기: status === "fill_existing" && 승인됨 ---
  const fillRows = preview.filter(
    (r): r is Extract<BulkNewPreviewRow, { status: "fill_existing" }> =>
      r.status === "fill_existing" && approvedSet.has(r.targetId)
  );
  for (const r of fillRows) {
    const { data, error } = await supabase
      .from("materials")
      .update({ mdg_code: r.mdg_code })
      .eq("id", r.targetId)
      .select();

    if (error) {
      failed++;
      failures.push({
        mdg_code: r.mdg_code,
        part_no: r.part_no,
        reason: `채우기 실패: ${error.message}`,
      });
      continue;
    }
    if (!data || data.length === 0) {
      failed++;
      failures.push({
        mdg_code: r.mdg_code,
        part_no: r.part_no,
        reason:
          "저장이 반영되지 않았습니다. materials 테이블에 authenticated UPDATE 정책이 필요합니다.",
      });
      continue;
    }

    filled++;
  }

  const skipped = preview.length - inserted - filled - failed;

  if (inserted > 0 || filled > 0) {
    revalidatePath("/materials");
    revalidatePath("/dashboard");
  }

  const message = `신규 ${inserted}건 등록, 기존 ${filled}건 채움, ${failed}건 실패, ${skipped}건 제외`;

  return {
    ok: true,
    message,
    summary: { inserted, filled, failed, skipped },
    failures,
  };
}
