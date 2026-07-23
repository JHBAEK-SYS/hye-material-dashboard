"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/form-state";

function rlsHint(entity: string) {
  return `저장이 반영되지 않았습니다. ${entity} 테이블에 authenticated INSERT/UPDATE 정책이 필요합니다. (아래 안내 SQL 참고)`;
}

/** 신규 도급발주 등록 */
export async function createPurchaseOrder(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const po_no = String(formData.get("po_no") ?? "").trim();
  const order_date = String(formData.get("order_date") ?? "").trim();
  const vendor = String(formData.get("vendor") ?? "").trim();
  const mdg_code = String(formData.get("mdg_code") ?? "").trim();
  const order_qty = Number(formData.get("order_qty"));
  const remark = String(formData.get("remark") ?? "").trim() || null;

  if (!po_no || !order_date || !vendor || !mdg_code) {
    return { error: "발주번호·발주일·거래처·MDG코드는 필수입니다.", message: null };
  }
  if (!Number.isFinite(order_qty) || order_qty <= 0) {
    return { error: "발주수량은 0보다 큰 숫자여야 합니다.", message: null };
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
    .from("purchase_orders")
    .insert({
      po_no,
      order_date,
      vendor,
      material_id: (material as { id: number }).id,
      order_qty,
      remark,
    })
    .select();

  if (error) {
    if (error.code === "23505") {
      return { error: `발주번호 '${po_no}' 는 이미 존재합니다.`, message: null };
    }
    return { error: `저장 실패: ${error.message}`, message: null };
  }
  if (!data || data.length === 0) {
    return { error: rlsHint("purchase_orders"), message: null };
  }

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { error: null, message: `발주 '${po_no}' 가 등록되었습니다.` };
}

/** 발주 입고처리 (received_date=오늘, received_qty=발주수량) */
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
    return { error: rlsHint("purchase_orders"), message: null };
  }

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { error: null, message: "입고처리 되었습니다." };
}
