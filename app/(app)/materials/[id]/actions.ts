"use server";

import { revalidatePath } from "next/cache";

import { getCanEdit } from "@/lib/auth/editor";
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
