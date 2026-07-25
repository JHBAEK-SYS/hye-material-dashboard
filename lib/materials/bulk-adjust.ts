/**
 * 엑셀 일괄 업로드로 받은 실사 결과(MDG코드·실사수량)를 자재별로 미리보기
 * 행으로 변환하는 순수 함수. DB 접근 없이 파싱된 입력과 (이미 조회된)
 * materials 정보 Map만 다룬다.
 *
 * 개별 행 역산 로직은 lib/materials/stock-adjust.ts 를 재사용한다(로직 복제 금지).
 */
import {
  computeOpeningStockForTarget,
  validateStockAdjustment,
} from "@/lib/materials/stock-adjust";

/** 엑셀에서 파싱된 원본 행 (문자열 그대로 — 서버가 재검증 시 이걸 다시 쓴다) */
export type BulkAdjustInputRow = { mdg_code: string; qty: string };

/**
 * 미리보기 계산에 필요한 자재 정보. v_stock_status 뷰의 부분집합.
 * 호출부(Route Handler)가 mdg_code -> 이 타입의 Map을 만들어 전달한다.
 */
export type BulkAdjustMaterialInfo = {
  id: number;
  material_name: string | null;
  opening_stock: number | null;
  in_total: number | null;
  out_total: number | null;
  current_stock: number | null;
};

export type BulkAdjustPreviewRow =
  | {
      status: "ok";
      mdg_code: string;
      material_name: string | null;
      currentStock: number;
      target: number;
      prevOpeningStock: number;
      newOpeningStock: number;
      negativeWarning: boolean; // newOpeningStock < 0
    }
  | { status: "not_found"; mdg_code: string; qty: string }
  | { status: "invalid_qty"; mdg_code: string; qty: string; reason: string }
  | { status: "duplicate"; mdg_code: string; qty: string };

/**
 * 입력 순서를 유지하며 각 행의 상태를 판정한다.
 *
 * 판정 우선순위:
 * 1. 파일 안에서 mdg_code(trim 후)가 2회 이상 나오면 해당 mdg_code의 모든 행이
 *    duplicate — 다른 문제(not_found/invalid_qty) 여부와 무관하게 최우선 적용,
 *    적용 대상에서 제외한다.
 * 2. materials Map에 없는 mdg_code는 not_found.
 * 3. validateStockAdjustment 로 qty가 유효하지 않으면 invalid_qty(사유 포함).
 * 4. 나머지는 ok — computeOpeningStockForTarget 으로 새 기초재고를 역산하고,
 *    결과가 음수면 negativeWarning=true 로 표시만 한다(막지 않음).
 */
export function buildBulkAdjustPreview(
  rows: BulkAdjustInputRow[],
  materials: Map<string, BulkAdjustMaterialInfo>
): BulkAdjustPreviewRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const code = row.mdg_code.trim();
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  return rows.map((row): BulkAdjustPreviewRow => {
    const mdg_code = row.mdg_code.trim();
    const qty = row.qty;

    if ((counts.get(mdg_code) ?? 0) > 1) {
      return { status: "duplicate", mdg_code, qty };
    }

    const material = materials.get(mdg_code);
    if (!material) {
      return { status: "not_found", mdg_code, qty };
    }

    const validationError = validateStockAdjustment({ target: qty });
    if (validationError) {
      return {
        status: "invalid_qty",
        mdg_code,
        qty,
        reason: validationError,
      };
    }

    const target = Number(qty.trim());
    const inTotal = material.in_total ?? 0;
    const outTotal = material.out_total ?? 0;
    const prevOpeningStock = material.opening_stock ?? 0;
    const currentStock = material.current_stock ?? 0;
    const newOpeningStock = computeOpeningStockForTarget({
      target,
      inTotal,
      outTotal,
    });

    return {
      status: "ok",
      mdg_code,
      material_name: material.material_name,
      currentStock,
      target,
      prevOpeningStock,
      newOpeningStock,
      negativeWarning: newOpeningStock < 0,
    };
  });
}
