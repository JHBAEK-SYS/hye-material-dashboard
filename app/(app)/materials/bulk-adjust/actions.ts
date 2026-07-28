"use server";

import { revalidatePath } from "next/cache";

import {
  buildBulkAdjustPreview,
  type BulkAdjustInputRow,
  type BulkAdjustPreviewRow,
} from "@/lib/materials/bulk-adjust";
import { fetchBulkAdjustMaterialsMap } from "@/lib/materials/bulk-adjust-data";
import { parseBulkAdjustFile } from "@/lib/materials/parse-bulk-adjust-file";
import { getCanEdit } from "@/lib/auth/editor";
import { createClient } from "@/lib/supabase/server";

/**
 * 재고 일괄 조정(엑셀 업로드) — Server Action 2개로 구성.
 *
 * Route Handler 대신 Server Action을 택한 이유: 확정(commit) 단계는 파일이
 * 아닌 JSON rows만 주고받아 부담이 작고, 미리보기(preview) 단계도 실사 엑셀
 * 파일 자체는 서식을 포함해도 수 MB를 넘기 어려워 next.config.ts의
 * `experimental.serverActions.bodySizeLimit` 를 5MB로 올리는 것으로 충분히
 * 안전하다(기본 1MB 제한 — node_modules/next/dist/docs/01-app/02-guides/
 * server-actions.md 참고). Server Action으로 묶으면 별도 API 라우트 없이
 * 페이지 하나(app/(app)/materials/bulk-adjust)만 추가되어 라우트 구조가
 * 더 단순해진다.
 */

export type BulkAdjustPreviewResult =
  | { ok: false; error: string }
  | { ok: true; preview: BulkAdjustPreviewRow[]; rows: BulkAdjustInputRow[] };

/**
 * 1단계: 업로드된 엑셀을 파싱해 미리보기만 계산한다. DB에는 절대 쓰지 않는다.
 * 반환된 rows(원본 파싱 결과, 문자열 그대로)는 클라이언트가 보관했다가
 * 확정(commitBulkAdjust) 호출 시 다시 넘겨야 한다 — 확정 단계가 미리보기
 * 계산값을 그대로 믿지 않고 서버에서 다시 검증/재계산하기 위함이다.
 */
export async function previewBulkAdjust(
  formData: FormData
): Promise<BulkAdjustPreviewResult> {
  if (!(await getCanEdit())) {
    return { ok: false, error: "수정 권한이 없습니다. 관리자에게 문의하세요." };
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { ok: false, error: "엑셀 파일(.xlsx)을 첨부하세요." };
  }

  let rows: BulkAdjustInputRow[];
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    rows = await parseBulkAdjustFile(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return { ok: false, error: `엑셀 파싱 실패: ${message}` };
  }

  if (rows.length === 0) {
    return { ok: false, error: "엑셀에서 읽을 수 있는 데이터 행이 없습니다." };
  }

  try {
    const materialsMap = await fetchBulkAdjustMaterialsMap(
      rows.map((r) => r.mdg_code)
    );
    const preview = buildBulkAdjustPreview(rows, materialsMap);
    return { ok: true, preview, rows };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return { ok: false, error: `미리보기 생성 실패: ${message}` };
  }
}

export interface BulkAdjustCommitFailure {
  mdg_code: string;
  reason: string;
}

export type BulkAdjustCommitResult =
  | { ok: false; error: string }
  | {
      ok: true;
      message: string;
      summary: { applied: number; failed: number; skipped: number };
      failures: BulkAdjustCommitFailure[];
    };

function isValidInputRow(v: unknown): v is BulkAdjustInputRow {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.mdg_code !== "string" || typeof r.qty !== "string") return false;
  if (r.part_no !== undefined && typeof r.part_no !== "string") return false;
  return true;
}

// 상세 페이지까지 revalidatePath 하는 개수 상한. 이보다 많으면 목록/대시보드
// 무효화만으로 충분하다고 보고 생략한다(반영 건수가 많은 대량 업로드 상황).
const DETAIL_REVALIDATE_LIMIT = 50;

/**
 * 2단계: 확정 반영.
 *
 * 클라이언트가 1단계(previewBulkAdjust)에서 받은 원본 rows를 그대로 다시
 * 보내면, 미리보기 시점 값을 신뢰하지 않고 서버가 다시 materials 조회 +
 * buildBulkAdjustPreview 재계산을 수행한다(그 사이 다른 사용자가 값을
 * 바꿨을 수 있음). status === "ok" 인 행만 materials.opening_stock 을
 * 개별 update 한다 — Supabase/PostgREST 는 여러 자재를 서로 다른 값으로
 * 한 번에 갱신하는 단일 쿼리를 지원하지 않으므로 기존 adjustStock 액션과
 * 동일하게 루프를 돈다.
 */
export async function commitBulkAdjust(
  rows: BulkAdjustInputRow[]
): Promise<BulkAdjustCommitResult> {
  if (!(await getCanEdit())) {
    return { ok: false, error: "수정 권한이 없습니다. 관리자에게 문의하세요." };
  }

  if (!Array.isArray(rows) || rows.length === 0 || !rows.every(isValidInputRow)) {
    return { ok: false, error: "잘못된 요청입니다 (rows 형식 오류)." };
  }

  let materialsMap: Awaited<ReturnType<typeof fetchBulkAdjustMaterialsMap>>;
  try {
    materialsMap = await fetchBulkAdjustMaterialsMap(rows.map((r) => r.mdg_code));
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return { ok: false, error: `자재 조회 실패: ${message}` };
  }

  // 미리보기 값을 그대로 믿지 않고 여기서 다시 계산한다.
  const preview = buildBulkAdjustPreview(rows, materialsMap);

  const supabase = await createClient();

  let applied = 0;
  let failed = 0;
  const failures: BulkAdjustCommitFailure[] = [];
  const revalidateIds: number[] = [];

  for (const result of preview) {
    if (result.status !== "ok") continue;

    // materialsMap에서 mdg_code로 다시 찾지 않는다 — mdg_code는 유니크가
    // 아니라 여러 자재가 걸릴 수 있으므로, buildBulkAdjustPreview가 이미
    // part_no로 확정한 자재의 id를 그대로 쓴다.
    const { data, error } = await supabase
      .from("materials")
      .update({ opening_stock: result.newOpeningStock })
      .eq("id", result.id)
      .select();

    if (error) {
      failed++;
      failures.push({ mdg_code: result.mdg_code, reason: `저장 실패: ${error.message}` });
      continue;
    }
    if (!data || data.length === 0) {
      failed++;
      failures.push({
        mdg_code: result.mdg_code,
        reason: "저장이 반영되지 않았습니다. materials 테이블에 authenticated UPDATE 정책이 필요합니다.",
      });
      continue;
    }

    applied++;
    revalidateIds.push(result.id);
  }

  const skipped = preview.length - applied - failed;

  if (applied > 0) {
    revalidatePath("/materials");
    revalidatePath("/dashboard");
    if (revalidateIds.length <= DETAIL_REVALIDATE_LIMIT) {
      for (const id of revalidateIds) {
        revalidatePath(`/materials/${id}`);
      }
    }
  }

  const message = `${applied}건 반영 완료, ${failed}건 실패, ${skipped}건 제외(미확인/중복/오류)`;

  return {
    ok: true,
    message,
    summary: { applied, failed, skipped },
    failures,
  };
}
