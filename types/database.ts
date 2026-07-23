/**
 * Supabase 스키마 타입 (실제 확인: 2026-07-23).
 *
 * 현재 authenticated 역할에서 접근 가능한 것은 v_stock_status 뷰뿐입니다.
 * (materials/purchase_orders/consigned_reqs/issues/v_warehouse_movements 는 RLS 로 차단됨 —
 *  authenticated 에게 select 정책을 부여하면 열립니다.)
 *
 * 전체 스키마 타입 생성은 secret 키로 아래를 실행:
 *   npx supabase gen types typescript --project-id ivqqnssgnhhtcdjtfjij > types/database.ts
 */

/** v_stock_status 재고 상태 자동 판정 값 */
export type StockStatus =
  | "정상"
  | "안전재고미달"
  | "결품"
  | "단종"
  | "오류";

export const STOCK_STATUSES: StockStatus[] = [
  "정상",
  "안전재고미달",
  "결품",
  "단종",
  "오류",
];

/** 자재 마스터 (materials) — 실제 컬럼 */
export interface MaterialRow {
  id: number;
  mdg_code: string | null;
  part_no: string | null;
  key: string | null;
  material_name: string | null;
  size: string | null;
  unit: string | null;
  manufacturer: string | null;
  safety_stock: number | null;
  opening_stock: number | null;
  remark: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_active: boolean;
}

/** 전표에서 조인해 표시할 자재 요약 */
export interface MaterialLite {
  id: number;
  mdg_code: string | null;
  material_name: string | null;
  part_no: string | null;
  unit: string | null;
}

/** 도급발주 (purchase_orders) */
export interface PurchaseOrderRow {
  id: number;
  po_no: string;
  order_date: string;
  vendor: string;
  material_id: number | null;
  order_qty: number;
  received_date: string | null;
  received_qty: number | null;
  remark: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  material?: MaterialLite | null;
}

/** 출고기록 (issues) */
export interface IssueRow {
  id: number;
  req_no: string;
  issue_date: string;
  material_id: number | null;
  qty: number;
  tool_name: string | null;
  staff: string | null;
  remark: string | null;
  created_by: string | null;
  created_at: string | null;
  material?: MaterialLite | null;
}

/** 샵 입출고 통합 뷰 (v_warehouse_movements) */
export interface WarehouseMovementRow {
  movement_type: string | null;
  ref_no: string | null;
  movement_date: string | null;
  material_id: number | null;
  qty: number | null;
  tool_name: string | null;
  staff: string | null;
  remark: string | null;
  material?: MaterialLite | null;
}

/** 재고 현황 뷰 (v_stock_status) — 실제 컬럼 */
export interface StockStatusRow {
  id: number;
  mdg_code: string | null;
  part_no: string | null;
  key: string | null;
  material_name: string | null;
  size: string | null;
  unit: string | null;
  manufacturer: string | null;
  safety_stock: number | null;
  opening_stock: number | null;
  is_active: boolean;
  in_total: number | null;
  out_total: number | null;
  current_stock: number | null;
  status: StockStatus | null;
}
