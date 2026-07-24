"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCanEdit } from "@/lib/auth/editor";
import { validateNewMaterial } from "@/lib/materials/validate";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/form-state";

/**
 * 자재 마스터 신규 등록.
 * mdg_code 는 업무 키 — 전표(orders/issues/consigned_reqs)가 사용자 입력 mdg_code로
 * 자재를 찾으므로 필수이며 중복이면 안 된다(테이블 UNIQUE 제약 가정, 23505 처리).
 * materials 테이블에 authenticated INSERT 정책이 없으면 0행 반환되므로 안내 메시지를 돌려준다.
 */
export async function createMaterial(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await getCanEdit())) {
    return { error: "수정 권한이 없습니다. 관리자에게 문의하세요.", message: null };
  }

  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };

  const mdg_code = String(formData.get("mdg_code") ?? "").trim();
  const safetyRaw = String(formData.get("safety_stock") ?? "").trim();
  const openingRaw = String(formData.get("opening_stock") ?? "").trim();

  const validationError = validateNewMaterial({
    mdg_code,
    safety_stock: safetyRaw,
    opening_stock: openingRaw,
  });
  if (validationError) {
    return { error: validationError, message: null };
  }

  const safety_stock = safetyRaw === "" ? 0 : Number(safetyRaw);
  const opening_stock = openingRaw === "" ? 0 : Number(openingRaw);

  const payload = {
    mdg_code,
    material_name: str("material_name"),
    part_no: str("part_no"),
    key: str("key"),
    size: str("size"),
    unit: str("unit"),
    manufacturer: str("manufacturer"),
    safety_stock,
    opening_stock,
    remark: str("remark"),
    is_active: formData.get("is_active") === "on",
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materials")
    .insert(payload)
    .select();

  if (error) {
    if (error.code === "23505") {
      return {
        error: `이미 등록된 MDG코드입니다: ${mdg_code}`,
        message: null,
      };
    }
    return { error: `저장 실패: ${error.message}`, message: null };
  }
  if (!data || data.length === 0) {
    return {
      error:
        "저장이 반영되지 않았습니다. materials 테이블에 authenticated INSERT 정책이 필요합니다.",
      message: null,
    };
  }

  revalidatePath("/materials");
  revalidatePath("/dashboard");
  return { error: null, message: `자재 '${mdg_code}' 가 등록되었습니다.` };
}

/**
 * 자재 마스터 삭제.
 * purchase_orders/issues/consigned_reqs 의 material_id FK 가 ON DELETE RESTRICT 이므로
 * 전표가 참조 중인 자재는 DB가 삭제를 거부하고 23503(foreign_key_violation)을 던진다.
 * 이 경우 편집에서 비활성 처리하도록 안내한다.
 */
export async function deleteMaterial(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await getCanEdit())) {
    return { error: "수정 권한이 없습니다. 관리자에게 문의하세요.", message: null };
  }

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
    return { error: "잘못된 자재 ID 입니다.", message: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materials")
    .delete()
    .eq("id", id)
    .select();

  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "이 자재를 참조하는 전표(발주/출고/사급청구)가 있어 삭제할 수 없습니다. 대신 편집에서 '활성 자재'를 꺼서 비활성 처리하세요.",
        message: null,
      };
    }
    return { error: `삭제 실패: ${error.message}`, message: null };
  }
  if (!data || data.length === 0) {
    return {
      error:
        "삭제가 반영되지 않았습니다. materials 테이블에 authenticated DELETE 정책이 필요합니다.",
      message: null,
    };
  }

  revalidatePath("/materials");
  revalidatePath("/dashboard");
  redirect("/materials");
}
