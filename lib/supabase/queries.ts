import { createClient } from "@/lib/supabase/server";
import {
  STOCK_STATUSES,
  type IssueRow,
  type MaterialLite,
  type MaterialRow,
  type PurchaseOrderRow,
  type StockStatus,
  type StockStatusRow,
  type WarehouseMovementRow,
} from "@/types/database";

export const LEDGER_PAGE_SIZE = 25;

/**
 * material_id 를 가진 행들에 자재 요약(material)을 붙입니다.
 * FK 임베딩에 의존하지 않고 수동 조인하여 안정적으로 동작.
 */
async function attachMaterials<T extends { material_id: number | null }>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: T[]
): Promise<(T & { material: MaterialLite | null })[]> {
  const ids = [...new Set(rows.map((r) => r.material_id).filter((v): v is number => v != null))];
  const map = new Map<number, MaterialLite>();
  if (ids.length > 0) {
    const { data } = await supabase
      .from("materials")
      .select("id, mdg_code, material_name, part_no, unit")
      .in("id", ids);
    for (const m of (data ?? []) as MaterialLite[]) map.set(m.id, m);
  }
  return rows.map((r) => ({
    ...r,
    material: r.material_id != null ? map.get(r.material_id) ?? null : null,
  }));
}

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

/** mdg_code 로 자재 1건 조회 (전표 등록 시 material_id 해석용) */
export async function findMaterialByCode(
  code: string
): Promise<MaterialLite | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("materials")
    .select("id, mdg_code, material_name, part_no, unit")
    .eq("mdg_code", code.trim())
    .maybeSingle();
  return (data as MaterialLite | null) ?? null;
}

export interface PurchaseOrderResult {
  rows: PurchaseOrderRow[];
  count: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** 도급발주 목록. openOnly=true 면 미입고(received_date 없음)만. */
export async function getPurchaseOrders(params: {
  search?: string;
  openOnly?: boolean;
  page?: number;
} = {}): Promise<PurchaseOrderResult> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * LEDGER_PAGE_SIZE;
  const to = from + LEDGER_PAGE_SIZE - 1;

  let query = supabase.from("purchase_orders").select("*", { count: "exact" });
  if (params.openOnly) query = query.is("received_date", null);
  if (params.search?.trim()) {
    const term = params.search.trim().replace(/[%,()]/g, " ");
    query = query.or(`po_no.ilike.%${term}%,vendor.ilike.%${term}%`);
  }

  const { data, count, error } = await query
    .order("order_date", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (error) throw new Error(`발주 조회 실패: ${error.message}`);

  const rows = await attachMaterials(supabase, (data ?? []) as PurchaseOrderRow[]);
  const total = count ?? 0;
  return {
    rows,
    count: total,
    page,
    pageSize: LEDGER_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / LEDGER_PAGE_SIZE)),
  };
}

/** 미입고(Open) 발주 건수 */
export async function getOpenPOCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("purchase_orders")
    .select("*", { count: "exact", head: true })
    .is("received_date", null);
  return count ?? 0;
}

export interface IssueResult {
  rows: IssueRow[];
  count: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** 출고 목록 */
export async function getIssues(params: {
  search?: string;
  page?: number;
} = {}): Promise<IssueResult> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * LEDGER_PAGE_SIZE;
  const to = from + LEDGER_PAGE_SIZE - 1;

  let query = supabase.from("issues").select("*", { count: "exact" });
  if (params.search?.trim()) {
    const term = params.search.trim().replace(/[%,()]/g, " ");
    query = query.or(`req_no.ilike.%${term}%,tool_name.ilike.%${term}%,staff.ilike.%${term}%`);
  }

  const { data, count, error } = await query
    .order("issue_date", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (error) throw new Error(`출고 조회 실패: ${error.message}`);

  const rows = await attachMaterials(supabase, (data ?? []) as IssueRow[]);
  const total = count ?? 0;
  return {
    rows,
    count: total,
    page,
    pageSize: LEDGER_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / LEDGER_PAGE_SIZE)),
  };
}

/** 최근 입출고 (v_warehouse_movements) */
export async function getRecentMovements(
  limit = 8
): Promise<WarehouseMovementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_warehouse_movements")
    .select("*")
    .order("movement_date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`입출고 조회 실패: ${error.message}`);
  return attachMaterials(supabase, (data ?? []) as WarehouseMovementRow[]);
}
