"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/form-state";

/**
 * 신규 도급발주 등록 — 하나의 발주번호(po_no)에 여러 품목(MDG코드) 동시 등록.
 * 품목 수만큼 purchase_orders 행을 생성한다. (po_no, material_id) 복합 유니크 전제.
 */
export async function createPurchaseOrder(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const po_no = String(formData.get("po_no") ?? "").trim();
  const order_date = String(formData.get("order_date") ?? "").trim();
  const vendor = String(formData.get("vendor") ?? "").trim();
  const remark = String(formData.get("remark") ?? "").trim() || null;

  const mdgCodes = formData.getAll("mdg_code").map((v) => String(v).trim());
  const qtys = formData.getAll("qty").map((v) => String(v).trim());

  if (!po_no || !order_date || !vendor) {
    return { error: "발주번호·발주일·거래처는 필수입니다.", message: null };
  }

  // 품목 줄 취합 (빈 줄 건너뜀)
  const lines: { mdg_code: string; qty: number }[] = [];
  for (let i = 0; i < mdgCodes.length; i++) {
    const code = mdgCodes[i];
    if (!code) continue;
    const qty = Number(qtys[i]);
    if (!Number.isFinite(qty) || qty <= 0) {
      return { error: `'${code}' 품목의 수량이 올바르지 않습니다.`, message: null };
    }
    lines.push({ mdg_code: code, qty });
  }
  if (lines.length === 0) {
    return { error: "품목(MDG코드)을 1개 이상 입력하세요.", message: null };
  }

  // 제출 내 중복 품목 방지
  const seen = new Set<string>();
  for (const l of lines) {
    if (seen.has(l.mdg_code)) {
      return { error: `같은 발주에 중복된 품목: ${l.mdg_code}`, message: null };
    }
    seen.add(l.mdg_code);
  }

  const supabase = await createClient();

  // MDG코드 → material_id 일괄 해석
  const codes = [...seen];
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
    po_no,
    order_date,
    vendor,
    material_id: map.get(l.mdg_code)!,
    order_qty: l.qty,
    remark,
  }));

  const { data, error } = await supabase
    .from("purchase_orders")
    .insert(rows)
    .select();

  if (error) {
    if (error.code === "23505") {
      return {
        error: `발주번호 '${po_no}' 에 이미 등록된 품목이 포함되어 있습니다.`,
        message: null,
      };
    }
    return { error: `저장 실패: ${error.message}`, message: null };
  }
  if (!data || data.length === 0) {
    return {
      error:
        "저장이 반영되지 않았습니다. purchase_orders 테이블에 authenticated INSERT 정책이 필요합니다.",
      message: null,
    };
  }

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return {
    error: null,
    message: `발주 '${po_no}' — ${data.length}개 품목이 등록되었습니다.`,
  };
}

/** 발주 입고처리 (received_date=오늘, received_qty=입력값) */
export async function receivePurchaseOrder(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = Number(formData.get("id"));
  const qty = Number(formData.get("received_qty"));
  if (!Number.isFinite(id) || id <= 0) {
    return { error: "잘못된 발주 ID.", message: null };
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return { error: "입고수량은 0보다 커야 합니다.", message: null };
  }

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("purchase_orders")
    .update({ received_date: today, received_qty: qty })
    .eq("id", id)
    .select();

  if (error) return { error: `입고처리 실패: ${error.message}`, message: null };
  if (!data || data.length === 0) {
    return {
      error:
        "입고처리가 반영되지 않았습니다. purchase_orders 테이블에 authenticated UPDATE 정책이 필요합니다.",
      message: null,
    };
  }

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { error: null, message: "입고처리 되었습니다." };
}

/** 발주 품목 삭제 (실수 복구용) */
export async function deletePurchaseOrder(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return { error: "잘못된 발주 ID.", message: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .delete()
    .eq("id", id)
    .select();

  if (error) return { error: `삭제 실패: ${error.message}`, message: null };
  if (!data || data.length === 0) {
    return {
      error:
        "삭제가 반영되지 않았습니다. purchase_orders 테이블에 authenticated DELETE 정책이 필요합니다.",
      message: null,
    };
  }

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { error: null, message: "삭제되었습니다." };
}
