import { createClient } from "@/lib/supabase/server";
import {
  STOCK_STATUSES,
  type MaterialRow,
  type StockStatus,
  type StockStatusRow,
} from "@/types/database";

export const MATERIALS_PAGE_SIZE = 25;

export interface MaterialsQuery {
  search?: string;
  status?: StockStatus;
  activeOnly?: boolean;
  page?: number;
}

export interface MaterialsResult {
  rows: StockStatusRow[];
  count: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * 자재 목록 (v_stock_status 기반).
 * 검색: mdg_code / part_no / material_name 부분일치.
 */
export async function getMaterials(
  params: MaterialsQuery = {}
): Promise<MaterialsResult> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = MATERIALS_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("v_stock_status")
    .select("*", { count: "exact" });

  if (params.activeOnly) {
    query = query.eq("is_active", true);
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.search) {
    const term = params.search.trim();
    if (term) {
      const escaped = term.replace(/[%,()]/g, " ");
      query = query.or(
        `mdg_code.ilike.%${escaped}%,part_no.ilike.%${escaped}%,material_name.ilike.%${escaped}%`
      );
    }
  }

  const { data, count, error } = await query
    .order("mdg_code", { ascending: true })
    .range(from, to);

  if (error) {
    throw new Error(`자재 목록 조회 실패: ${error.message}`);
  }

  const total = count ?? 0;
  return {
    rows: (data ?? []) as StockStatusRow[],
    count: total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface StockSummary {
  total: number;
  byStatus: Record<StockStatus, number>;
}

/**
 * 재고 상태별 집계 (KPI 용). head+count 쿼리를 병렬 실행해 효율적으로 계산.
 */
export async function getStockSummary(): Promise<StockSummary> {
  const supabase = await createClient();

  const totalPromise = supabase
    .from("v_stock_status")
    .select("*", { count: "exact", head: true });

  const statusPromises = STOCK_STATUSES.map((s) =>
    supabase
      .from("v_stock_status")
      .select("*", { count: "exact", head: true })
      .eq("status", s)
      .then(({ count }) => [s, count ?? 0] as const)
  );

  const [totalRes, ...statusRes] = await Promise.all([
    totalPromise,
    ...statusPromises,
  ]);

  const byStatus = Object.fromEntries(statusRes) as Record<
    StockStatus,
    number
  >;

  return {
    total: totalRes.count ?? 0,
    byStatus,
  };
}

export interface ShortageList {
  rows: StockStatusRow[];
  total: number;
}

/**
 * 즉시 조치가 필요한 활성 결품 자재 목록 (대시보드 상단 노출용).
 */
export async function getShortageList(limit = 8): Promise<ShortageList> {
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("v_stock_status")
    .select("*", { count: "exact" })
    .eq("status", "결품")
    .eq("is_active", true)
    .order("mdg_code", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`결품 목록 조회 실패: ${error.message}`);
  }

  return { rows: (data ?? []) as StockStatusRow[], total: count ?? 0 };
}

export interface MaterialDetail {
  material: MaterialRow;
  stock: StockStatusRow | null;
}

/**
 * 자재 상세: materials 원본 + v_stock_status 재고 지표를 함께 조회.
 * 없는 id 면 null.
 */
export async function getMaterialById(
  id: number
): Promise<MaterialDetail | null> {
  const supabase = await createClient();

  const [materialRes, stockRes] = await Promise.all([
    supabase.from("materials").select("*").eq("id", id).maybeSingle(),
    supabase.from("v_stock_status").select("*").eq("id", id).maybeSingle(),
  ]);

  if (materialRes.error) {
    throw new Error(`자재 조회 실패: ${materialRes.error.message}`);
  }
  if (!materialRes.data) {
    return null;
  }

  return {
    material: materialRes.data as MaterialRow,
    stock: (stockRes.data as StockStatusRow | null) ?? null,
  };
}

export interface LedgerCounts {
  purchase_orders: number;
  consigned_reqs: number;
  issues: number;
  v_warehouse_movements: number;
}

/**
 * 원장/입출고 소스별 행 수 (head+count). 빈 테이블이면 0 을 반환.
 * RLS 로 차단된 경우에도 0 이 반환되므로, 접근 가능 여부와 별개로 현재 데이터량을 나타냅니다.
 */
export async function getLedgerCounts(): Promise<LedgerCounts> {
  const supabase = await createClient();
  const countOf = (table: string) =>
    supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .then(({ count }) => count ?? 0);

  const [po, cr, iss, mv] = await Promise.all([
    countOf("purchase_orders"),
    countOf("consigned_reqs"),
    countOf("issues"),
    countOf("v_warehouse_movements"),
  ]);

  return {
    purchase_orders: po,
    consigned_reqs: cr,
    issues: iss,
    v_warehouse_movements: mv,
  };
}
