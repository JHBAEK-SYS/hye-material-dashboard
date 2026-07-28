import type { BulkAdjustMaterialInfo } from "@/lib/materials/bulk-adjust";
import { getStockStatusByMdgCodes } from "@/lib/supabase/queries";

/**
 * 일괄 재고조정 미리보기/확정 양쪽에서 공통으로 쓰는 자재 조회 헬퍼.
 * mdg_code 목록으로 v_stock_status 를 배치 조회한 뒤, buildBulkAdjustPreview
 * 가 기대하는 형태(BulkAdjustMaterialInfo)로 변환한다.
 *
 * 미리보기/확정 두 단계 모두 이 함수를 각자 호출 시점에 새로 실행한다 —
 * 확정 단계가 미리보기 시점의 값을 그대로 믿지 않기 위함.
 */
export async function fetchBulkAdjustMaterialsMap(
  mdgCodes: string[]
): Promise<Map<string, BulkAdjustMaterialInfo[]>> {
  const stockMap = await getStockStatusByMdgCodes(mdgCodes);
  const map = new Map<string, BulkAdjustMaterialInfo[]>();
  for (const [code, rows] of stockMap) {
    map.set(
      code,
      rows.map((row) => ({
        id: row.id,
        material_name: row.material_name,
        part_no: row.part_no,
        manufacturer: row.manufacturer,
        opening_stock: row.opening_stock,
        in_total: row.in_total,
        out_total: row.out_total,
        current_stock: row.current_stock,
      }))
    );
  }
  return map;
}
