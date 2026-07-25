"use server";

import { revalidatePath } from "next/cache";

import { getCanEdit } from "@/lib/auth/editor";
import {
  computeOpeningStockForTarget,
  validateStockAdjustment,
} from "@/lib/materials/stock-adjust";
import { createClient } from "@/lib/supabase/server";
import type { UpdateState } from "@/app/(app)/materials/[id]/update-state";

/**
 * 자재 마스터 편집 저장.
 * id 는 hidden 필드로 전달. materials 테이블에 authenticated UPDATE 정책이 없으면
 * RLS 로 0행 갱신되므로, 반환 행이 비면 정책 안내 메시지를 돌려줍니다.
 */
export async function updateMaterial(
  _prev: UpdateState,
  formData: FormData
): Promise<UpdateState> {
  if (!(await getCanEdit())) {
    return { error: "수정 권한이 없습니다. 관리자에게 문의하세요.", message: null };
  }

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return { error: "잘못된 자재 ID 입니다.", message: null };
  }

  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const safetyRaw = String(formData.get("safety_stock") ?? "").trim();
  const safety_stock = safetyRaw === "" ? null : Number(safetyRaw);
  if (safety_stock !== null && (!Number.isFinite(safety_stock) || safety_stock < 0)) {
    return { error: "안전재고는 0 이상의 숫자여야 합니다.", message: null };
  }

  const payload = {
    material_name: str("material_name"),
    part_no: str("part_no"),
    size: str("size"),
    unit: str("unit"),
    manufacturer: str("manufacturer"),
    safety_stock,
    remark: str("remark"),
    is_active: formData.get("is_active") === "on",
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materials")
    .update(payload)
    .eq("id", id)
    .select();

  if (error) {
    return { error: `저장 실패: ${error.message}`, message: null };
  }
  if (!data || data.length === 0) {
    return {
      error:
        "저장이 반영되지 않았습니다. materials 테이블에 authenticated UPDATE 정책이 필요합니다. (아래 안내 SQL 참고)",
      message: null,
    };
  }

  revalidatePath(`/materials/${id}`);
  revalidatePath("/materials");
  revalidatePath("/dashboard");
  return { error: null, message: "저장되었습니다." };
}

/**
 * 실사(재고조사) 결과로 재고 조정.
 *
 * 사용자는 "실사 결과 수량"(=원하는 현재고)을 입력하고, 새 기초재고는
 * 서버에서 역산해 materials.opening_stock 만 갱신한다.
 * 새 기초재고 = 실사수량 - 입고누계 + 출고누계
 *
 * 입고누계/출고누계는 클라이언트를 신뢰하지 않고 v_stock_status 를 서버에서
 * 다시 조회해 사용한다 (hidden 필드로 받으면 조작될 수 있음).
 */
export async function adjustStock(
  _prev: UpdateState,
  formData: FormData
): Promise<UpdateState> {
  if (!(await getCanEdit())) {
    return { error: "수정 권한이 없습니다. 관리자에게 문의하세요.", message: null };
  }

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return { error: "잘못된 자재 ID 입니다.", message: null };
  }

  const target = String(formData.get("target") ?? "");
  const validationError = validateStockAdjustment({ target });
  if (validationError) {
    return { error: validationError, message: null };
  }

  const supabase = await createClient();

  const { data: stockData, error: stockError } = await supabase
    .from("v_stock_status")
    .select("in_total, out_total, opening_stock")
    .eq("id", id)
    .maybeSingle();

  if (stockError) {
    return { error: `재고 조회 실패: ${stockError.message}`, message: null };
  }
  if (!stockData) {
    return { error: "잘못된 자재 ID 입니다.", message: null };
  }

  const inTotal = (stockData as { in_total: number | null }).in_total ?? 0;
  const outTotal = (stockData as { out_total: number | null }).out_total ?? 0;
  const prevOpeningStock =
    (stockData as { opening_stock: number | null }).opening_stock ?? 0;

  const targetNum = Number(target.trim());
  const newOpeningStock = computeOpeningStockForTarget({
    target: targetNum,
    inTotal,
    outTotal,
  });

  const { data, error } = await supabase
    .from("materials")
    .update({ opening_stock: newOpeningStock })
    .eq("id", id)
    .select();

  if (error) {
    return { error: `저장 실패: ${error.message}`, message: null };
  }
  if (!data || data.length === 0) {
    return {
      error:
        "저장이 반영되지 않았습니다. materials 테이블에 authenticated UPDATE 정책이 필요합니다. (아래 안내 SQL 참고)",
      message: null,
    };
  }

  revalidatePath(`/materials/${id}`);
  revalidatePath("/materials");
  revalidatePath("/dashboard");
  return {
    error: null,
    message: `현재고를 ${targetNum.toLocaleString("ko-KR")}로 조정했습니다. (기초재고 ${prevOpeningStock.toLocaleString("ko-KR")} → ${newOpeningStock.toLocaleString("ko-KR")})`,
  };
}
