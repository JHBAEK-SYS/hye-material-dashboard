"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/form-state";

/** 신규 출고 등록 */
export async function createIssue(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const req_no = String(formData.get("req_no") ?? "").trim();
  const issue_date = String(formData.get("issue_date") ?? "").trim();
  const mdg_code = String(formData.get("mdg_code") ?? "").trim();
  const qty = Number(formData.get("qty"));
  const tool_name = String(formData.get("tool_name") ?? "").trim() || null;
  const staff = String(formData.get("staff") ?? "").trim() || null;
  const remark = String(formData.get("remark") ?? "").trim() || null;

  if (!req_no || !issue_date || !mdg_code) {
    return { error: "청구번호·출고일·MDG코드는 필수입니다.", message: null };
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return { error: "출고수량은 0보다 큰 숫자여야 합니다.", message: null };
  }

  const supabase = await createClient();

  const { data: material } = await supabase
    .from("materials")
    .select("id")
    .eq("mdg_code", mdg_code)
    .maybeSingle();
  if (!material) {
    return { error: `MDG코드 '${mdg_code}' 에 해당하는 자재가 없습니다.`, message: null };
  }

  const { data, error } = await supabase
    .from("issues")
    .insert({
      req_no,
      issue_date,
      material_id: (material as { id: number }).id,
      qty,
      tool_name,
      staff,
      remark,
    })
    .select();

  if (error) return { error: `저장 실패: ${error.message}`, message: null };
  if (!data || data.length === 0) {
    return {
      error:
        "저장이 반영되지 않았습니다. issues 테이블에 authenticated INSERT 정책이 필요합니다. (아래 안내 SQL 참고)",
      message: null,
    };
  }

  revalidatePath("/issues");
  revalidatePath("/dashboard");
  return { error: null, message: `출고 '${req_no}' 가 등록되었습니다.` };
}
