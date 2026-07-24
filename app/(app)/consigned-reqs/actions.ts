"use server";

import { revalidatePath } from "next/cache";

import {
  validateConsignedReqHeader,
  validateConsignedReqLines,
} from "@/lib/consigned-reqs/validate";
import { validateReceiveInput } from "@/lib/receive/validate";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/form-state";

/**
 * 신규 사급청구 등록 — 하나의 사급청구번호(sg_no)에 여러 품목(MDG코드) 동시 등록.
 * 품목 수만큼 consigned_reqs 행을 생성한다. (sg_no, material_id) 복합 유니크 전제.
 */
export async function createConsignedReq(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const sg_no = String(formData.get("sg_no") ?? "").trim();
  const request_date = String(formData.get("request_date") ?? "").trim();
  const remark = String(formData.get("remark") ?? "").trim() || null;

  const mdgCodes = formData.getAll("mdg_code").map((v) => String(v).trim());
  const qtys = formData.getAll("qty").map((v) => String(v).trim());

  const headerError = validateConsignedReqHeader({ sg_no, request_date });
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

  const linesError = validateConsignedReqLines(lines);
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
    sg_no,
    request_date,
    material_id: map.get(l.mdg_code)!,
    request_qty: Number(l.qty),
    remark,
  }));

  const { data, error } = await supabase
    .from("consigned_reqs")
    .insert(rows)
    .select();

  if (error) {
    if (error.code === "23505") {
      return {
        error: `사급청구번호 '${sg_no}' 에 이미 등록된 품목이 포함되어 있습니다.`,
        message: null,
      };
    }
    return { error: `저장 실패: ${error.message}`, message: null };
  }
  if (!data || data.length === 0) {
    return {
      error:
        "저장이 반영되지 않았습니다. consigned_reqs 테이블에 authenticated INSERT 정책이 필요합니다.",
      message: null,
    };
  }

  revalidatePath("/consigned-reqs");
  revalidatePath("/dashboard");
  return {
    error: null,
    message: `사급청구 '${sg_no}' — ${data.length}개 품목이 등록되었습니다.`,
  };
}

/** 사급청구 입고처리 (received_date=사용자 입력값, received_qty=입력값) */
export async function receiveConsignedReq(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = Number(formData.get("id"));
  const received_date = String(formData.get("received_date") ?? "").trim();
  const received_qty = String(formData.get("received_qty") ?? "").trim();

  const validationError = validateReceiveInput({
    id,
    received_date,
    received_qty: received_qty,
  });
  if (validationError) {
    return { error: validationError, message: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consigned_reqs")
    .update({ received_date, received_qty: Number(received_qty) })
    .eq("id", id)
    .select();

  if (error) return { error: `입고처리 실패: ${error.message}`, message: null };
  if (!data || data.length === 0) {
    return {
      error:
        "입고처리가 반영되지 않았습니다. consigned_reqs 테이블에 authenticated UPDATE 정책이 필요합니다.",
      message: null,
    };
  }

  revalidatePath("/consigned-reqs");
  revalidatePath("/dashboard");
  return { error: null, message: "입고처리 되었습니다." };
}

/** 사급청구 삭제 (실수 복구용) */
export async function deleteConsignedReq(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return { error: "잘못된 사급청구 ID.", message: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consigned_reqs")
    .delete()
    .eq("id", id)
    .select();

  if (error) return { error: `삭제 실패: ${error.message}`, message: null };
  if (!data || data.length === 0) {
    return {
      error:
        "삭제가 반영되지 않았습니다. consigned_reqs 테이블에 authenticated DELETE 정책이 필요합니다.",
      message: null,
    };
  }

  revalidatePath("/consigned-reqs");
  revalidatePath("/dashboard");
  return { error: null, message: "삭제되었습니다." };
}
