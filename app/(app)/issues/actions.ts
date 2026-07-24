"use server";

import { revalidatePath } from "next/cache";

import {
  validateDeleteId,
  validateIssueHeader,
  validateIssueLines,
} from "@/lib/issues/validate";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/form-state";

/**
 * 신규 출고 등록 — 하나의 청구번호(req_no)에 여러 품목(MDG코드) 동시 등록.
 * 품목 수만큼 issues 행을 생성한다.
 */
export async function createIssue(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const req_no = String(formData.get("req_no") ?? "").trim();
  const issue_date = String(formData.get("issue_date") ?? "").trim();
  const tool_name = String(formData.get("tool_name") ?? "").trim() || null;
  const staff = String(formData.get("staff") ?? "").trim() || null;
  const remark = String(formData.get("remark") ?? "").trim() || null;

  const mdgCodes = formData.getAll("mdg_code").map((v) => String(v).trim());
  const qtys = formData.getAll("qty").map((v) => String(v).trim());

  const headerError = validateIssueHeader({ req_no, issue_date });
  if (headerError) {
    return { error: headerError, message: null };
  }

  // 품목 줄 취합 (빈 줄 건너뜀)
  const lines: { mdg_code: string; qty: string }[] = [];
  for (let i = 0; i < mdgCodes.length; i++) {
    const code = mdgCodes[i];
    if (!code) continue;
    lines.push({ mdg_code: code, qty: qtys[i] ?? "" });
  }

  const linesError = validateIssueLines(lines);
  if (linesError) {
    return { error: linesError, message: null };
  }

  const supabase = await createClient();

  // MDG코드 → material_id 일괄 해석
  const codes = [...new Set(lines.map((l) => l.mdg_code))];
  const { data: mats } = await supabase
    .from("materials")
    .select("id, mdg_code")
    .in("mdg_code", codes);
  const map = new Map(
    ((mats ?? []) as { id: number; mdg_code: string }[]).map((m) => [
      m.mdg_code,
      m.id,
    ])
  );
  const missing = codes.filter((c) => !map.has(c));
  if (missing.length > 0) {
    return { error: `존재하지 않는 MDG코드: ${missing.join(", ")}`, message: null };
  }

  const rows = lines.map((l) => ({
    req_no,
    issue_date,
    material_id: map.get(l.mdg_code)!,
    qty: Number(l.qty),
    tool_name,
    staff,
    remark,
  }));

  const { data, error } = await supabase.from("issues").insert(rows).select();

  if (error) {
    return { error: `저장 실패: ${error.message}`, message: null };
  }
  if (!data || data.length === 0) {
    return {
      error:
        "저장이 반영되지 않았습니다. issues 테이블에 authenticated INSERT 정책이 필요합니다. (아래 안내 SQL 참고)",
      message: null,
    };
  }

  revalidatePath("/issues");
  revalidatePath("/dashboard");
  return {
    error: null,
    message: `출고 '${req_no}' — ${data.length}개 품목이 등록되었습니다.`,
  };
}

/** 출고 품목 삭제 (실수 복구용) */
export async function deleteIssue(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = Number(formData.get("id"));
  const idError = validateDeleteId(id);
  if (idError) {
    return { error: idError, message: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("issues")
    .delete()
    .eq("id", id)
    .select();

  if (error) return { error: `삭제 실패: ${error.message}`, message: null };
  if (!data || data.length === 0) {
    return {
      error:
        "삭제가 반영되지 않았습니다. issues 테이블에 authenticated DELETE 정책이 필요합니다.",
      message: null,
    };
  }

  revalidatePath("/issues");
  revalidatePath("/dashboard");
  return { error: null, message: "삭제되었습니다." };
}
