import type { BulkNewMaterialInfo } from "@/lib/materials/bulk-new";
import { getAllMaterialsForBulkNew } from "@/lib/supabase/queries";

/**
 * 자재 신규 일괄 등록 미리보기/확정 양쪽에서 공통으로 쓰는 자재 조회 헬퍼.
 * getAllMaterialsForBulkNew 로 materials 테이블을 전량 조회해 그대로
 * BulkNewMaterialInfo[] 로 돌려준다(변환이 필요 없다 — 이미 같은 형태).
 *
 * 미리보기/확정 두 단계 모두 이 함수를 각자 호출 시점에 새로 실행한다 —
 * 확정 단계가 미리보기 시점의 값을 그대로 믿지 않기 위함(bulk-adjust와 동일한
 * 이유: 그 사이 다른 사용자가 자재를 추가/수정했을 수 있다).
 */
export async function fetchAllMaterialsForBulkNew(): Promise<
  BulkNewMaterialInfo[]
> {
  return getAllMaterialsForBulkNew();
}
