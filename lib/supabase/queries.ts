import type { BulkNewMaterialInfo } from "@/lib/materials/bulk-new";
import { isOutstanding } from "@/lib/receive/validate";
import { createClient } from "@/lib/supabase/server";
import {
  STOCK_STATUSES,
  type ConsignedReqRow,
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

/**
 * 도급발주 목록. openOnly=true 면 "아직 전량 입고되지 않은 건"(미입고 + 부분입고)만.
 *
 * openOnly=false: 기존과 동일하게 DB 레벨 .range() 페이지네이션 + count:"exact" 사용.
 *
 * openOnly=true: PostgREST(Supabase) 는 `received_qty < order_qty` 처럼 같은 행의
 * 두 컬럼을 비교하는 필터를 지원하지 않는다. DB에서 거르려면 generated column이나
 * 뷰를 새로 만들어야 하지만 이번 작업은 스키마를 건드리지 않기로 했으므로, 검색
 * 조건에 맞는 행을 fetchAllRows 로 전량 조회한 뒤 isOutstanding() 으로 앱에서
 * 걸러내고 그 결과를 페이지 단위로 잘라 반환한다. 데이터량이 크게 늘어나면
 * (수만 건 이상) 이 방식은 비효율적이므로 그때는 generated column/뷰로 옮겨야 한다.
 */
export async function getPurchaseOrders(params: {
  search?: string;
  openOnly?: boolean;
  page?: number;
} = {}): Promise<PurchaseOrderResult> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * LEDGER_PAGE_SIZE;
  const to = from + LEDGER_PAGE_SIZE - 1;

  const buildBase = (withCount: boolean) => {
    let query = withCount
      ? supabase.from("purchase_orders").select("*", { count: "exact" })
      : supabase.from("purchase_orders").select("*");
    if (params.search?.trim()) {
      const term = params.search.trim().replace(/[%,()]/g, " ");
      query = query.or(`po_no.ilike.%${term}%,vendor.ilike.%${term}%`);
    }
    return query
      .order("order_date", { ascending: false })
      .order("id", { ascending: false });
  };

  if (!params.openOnly) {
    const { data, count, error } = await buildBase(true).range(from, to);
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

  const all = await fetchAllRows<PurchaseOrderRow>(
    (batchFrom, batchTo) => buildBase(false).range(batchFrom, batchTo),
    "발주 조회 실패"
  );
  const filtered = all.filter((r) => isOutstanding(r.order_qty, r.received_qty));
  const total = filtered.length;
  const pageRows = filtered.slice(from, to + 1);
  const rows = await attachMaterials(supabase, pageRows);
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

// ---------------------------------------------------------------------------
// 사급청구 검색: 사급청구번호(sg_no) · B/L NO(bl_no) · MDG코드/Part No 통합 검색
//
// mdg_code/part_no는 materials 테이블에 있고, 이 프로젝트는 FK 임베딩 대신
// attachMaterials()로 수동 조인한다. PostgREST는 한 번의 .or() 안에서 다른
// 테이블의 컬럼을 참조할 수 없으므로, 검색어로 materials에서 먼저 매칭되는
// id 목록을 구한 뒤 consigned_reqs 쪽 OR 조건에 material_id.in.(...)로 끼워
// 넣는 2단계 조회로 구현한다.
// ---------------------------------------------------------------------------

const MATERIAL_MATCH_ID_LIMIT = 300;

/**
 * 검색어로 materials에서 mdg_code/part_no 부분일치하는 id 목록을 조회한다.
 *
 * 상한(300건) 한계: 흔한 부분 문자열로 검색하면 수백~수천 개의 id가 매칭될 수
 * 있는데, 이를 모두 `material_id.in.(1,2,3,...)` 쿼리스트링에 담으면 URL이
 * 과도하게 길어지거나 요청이 비효율적으로 커진다. 300건으로 제한했기 때문에
 * 매칭 id가 300개를 초과하는 검색어의 경우, 301번째 이후의 material_id를 가진
 * consigned_reqs 행은 검색 결과에서 누락될 수 있다(자재 마스터가 훨씬 커지면
 * 전용 검색 인덱스/뷰로 옮겨야 한다).
 */
async function findMatchingMaterialIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  term: string
): Promise<number[]> {
  const { data } = await supabase
    .from("materials")
    .select("id")
    .or(`mdg_code.ilike.%${term}%,part_no.ilike.%${term}%`)
    .limit(MATERIAL_MATCH_ID_LIMIT);
  return ((data ?? []) as { id: number }[]).map((m) => m.id);
}

/**
 * consigned_reqs .or() 조건 문자열 조립: sg_no/bl_no 부분일치 OR 매칭된 material_id.
 * matchedIds가 비어 있으면 `material_id.in.()` 은 문법 오류가 날 수 있어 생략한다
 * (이 경우 sg_no/bl_no 조건만으로 검색).
 */
function buildConsignedReqsSearchOr(term: string, matchedIds: number[]): string {
  const parts = [`sg_no.ilike.%${term}%`, `bl_no.ilike.%${term}%`];
  if (matchedIds.length > 0) {
    parts.push(`material_id.in.(${matchedIds.join(",")})`);
  }
  return parts.join(",");
}

export interface ConsignedReqResult {
  rows: ConsignedReqRow[];
  count: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * 사급청구 목록. openOnly=true 면 "아직 전량 입고되지 않은 건"(미입고 + 부분입고)만.
 *
 * openOnly=false: 기존과 동일하게 DB 레벨 .range() 페이지네이션 + count:"exact" 사용.
 *
 * openOnly=true: PostgREST(Supabase) 는 `received_qty < request_qty` 처럼 같은 행의
 * 두 컬럼을 비교하는 필터를 지원하지 않는다. DB에서 거르려면 generated column이나
 * 뷰를 새로 만들어야 하지만 이번 작업은 스키마를 건드리지 않기로 했으므로, 검색
 * 조건에 맞는 행을 fetchAllRows 로 전량 조회한 뒤 isOutstanding() 으로 앱에서
 * 걸러내고 그 결과를 페이지 단위로 잘라 반환한다. 데이터량이 크게 늘어나면
 * (수만 건 이상) 이 방식은 비효율적이므로 그때는 generated column/뷰로 옮겨야 한다.
 */
export async function getConsignedReqs(params: {
  search?: string;
  openOnly?: boolean;
  page?: number;
} = {}): Promise<ConsignedReqResult> {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * LEDGER_PAGE_SIZE;
  const to = from + LEDGER_PAGE_SIZE - 1;

  const term = params.search?.trim()
    ? params.search.trim().replace(/[%,()]/g, " ")
    : "";
  const matchedIds = term ? await findMatchingMaterialIds(supabase, term) : [];

  const buildBase = (withCount: boolean) => {
    let query = withCount
      ? supabase.from("consigned_reqs").select("*", { count: "exact" })
      : supabase.from("consigned_reqs").select("*");
    if (term) {
      query = query.or(buildConsignedReqsSearchOr(term, matchedIds));
    }
    return query
      .order("request_date", { ascending: false })
      .order("id", { ascending: false });
  };

  if (!params.openOnly) {
    const { data, count, error } = await buildBase(true).range(from, to);
    if (error) throw new Error(`사급청구 조회 실패: ${error.message}`);

    const rows = await attachMaterials(supabase, (data ?? []) as ConsignedReqRow[]);
    const total = count ?? 0;
    return {
      rows,
      count: total,
      page,
      pageSize: LEDGER_PAGE_SIZE,
      pageCount: Math.max(1, Math.ceil(total / LEDGER_PAGE_SIZE)),
    };
  }

  const all = await fetchAllRows<ConsignedReqRow>(
    (batchFrom, batchTo) => buildBase(false).range(batchFrom, batchTo),
    "사급청구 조회 실패"
  );
  const filtered = all.filter((r) => isOutstanding(r.request_qty, r.received_qty));
  const total = filtered.length;
  const pageRows = filtered.slice(from, to + 1);
  const rows = await attachMaterials(supabase, pageRows);
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

// ---------------------------------------------------------------------------
// Export(엑셀 다운로드) 전용 전량 조회
//
// Supabase(PostgREST) 는 한 번의 select 에서 기본 최대 1,000행만 반환한다.
// 목록 화면의 페이지네이션 함수(getMaterials 등)는 25건씩만 가져오므로 문제가
// 없지만, 엑셀 export 는 "현재 필터 조건에 맞는 전체 행"을 내려줘야 하므로
// 1,000행 단위로 .range(from, to) 를 반복 호출해 더 이상 행이 없을 때까지
// 모아야 한다. 무한 루프 방지를 위한 안전 상한도 둔다.
// ---------------------------------------------------------------------------

const EXPORT_BATCH_SIZE = 1000;
const EXPORT_MAX_BATCHES = 50; // 안전 상한: 최대 50,000행

/**
 * `buildQuery(from, to)` 가 반환하는 쿼리를 배치 크기(EXPORT_BATCH_SIZE)만큼
 * 반복 실행해 전체 행을 모으는 헬퍼. 마지막 배치의 행 수가 배치 크기보다
 * 작으면(=더 가져올 행이 없으면) 종료한다. EXPORT_MAX_BATCHES 를 넘으면
 * 무한 루프를 막기 위해 강제 종료한다.
 */
async function fetchAllRows<T>(
  buildQuery: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  errorPrefix: string
): Promise<T[]> {
  const all: T[] = [];
  for (let batch = 0; batch < EXPORT_MAX_BATCHES; batch++) {
    const from = batch * EXPORT_BATCH_SIZE;
    const to = from + EXPORT_BATCH_SIZE - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw new Error(`${errorPrefix}: ${error.message}`);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < EXPORT_BATCH_SIZE) break;
  }
  return all;
}

export interface MaterialsExportQuery {
  search?: string;
  status?: StockStatus;
  activeOnly?: boolean;
}

/**
 * 자재 목록 전량 조회 (엑셀 export 용).
 * getMaterials 와 완전히 동일한 필터/정렬을 적용하되, 페이지네이션 없이
 * 조건에 맞는 전체 행을 1,000건씩 배치로 모아 반환한다.
 */
export async function getAllMaterialsForExport(
  params: MaterialsExportQuery = {}
): Promise<StockStatusRow[]> {
  const supabase = await createClient();

  const buildBase = () => {
    let query = supabase.from("v_stock_status").select("*");
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
    return query.order("mdg_code", { ascending: true });
  };

  return fetchAllRows<StockStatusRow>(
    (from, to) => buildBase().range(from, to),
    "자재 전체 조회 실패"
  );
}

export interface PurchaseOrdersExportQuery {
  search?: string;
  openOnly?: boolean;
}

/**
 * 도급발주 전량 조회 (엑셀 export 용). getPurchaseOrders 와 동일한 필터/정렬.
 * openOnly=true 는 "아직 전량 입고되지 않은 건"(미입고 + 부분입고) 기준으로,
 * PostgREST 가 컬럼 간 비교를 지원하지 않아 isOutstanding() 으로 앱에서 거른다.
 * attachMaterials 는 불필요한 조인을 줄이기 위해 필터 이후에 적용한다.
 */
export async function getAllPurchaseOrdersForExport(
  params: PurchaseOrdersExportQuery = {}
): Promise<PurchaseOrderRow[]> {
  const supabase = await createClient();

  const buildBase = () => {
    let query = supabase.from("purchase_orders").select("*");
    if (params.search?.trim()) {
      const term = params.search.trim().replace(/[%,()]/g, " ");
      query = query.or(`po_no.ilike.%${term}%,vendor.ilike.%${term}%`);
    }
    return query
      .order("order_date", { ascending: false })
      .order("id", { ascending: false });
  };

  const rows = await fetchAllRows<PurchaseOrderRow>(
    (from, to) => buildBase().range(from, to),
    "발주 전체 조회 실패"
  );
  const filtered = params.openOnly
    ? rows.filter((r) => isOutstanding(r.order_qty, r.received_qty))
    : rows;
  return attachMaterials(supabase, filtered);
}

export interface ConsignedReqsExportQuery {
  search?: string;
  openOnly?: boolean;
}

/**
 * 사급청구 전량 조회 (엑셀 export 용). getConsignedReqs 와 동일한 필터/정렬.
 * openOnly=true 는 "아직 전량 입고되지 않은 건"(미입고 + 부분입고) 기준으로,
 * PostgREST 가 컬럼 간 비교를 지원하지 않아 isOutstanding() 으로 앱에서 거른다.
 * attachMaterials 는 불필요한 조인을 줄이기 위해 필터 이후에 적용한다.
 */
export async function getAllConsignedReqsForExport(
  params: ConsignedReqsExportQuery = {}
): Promise<ConsignedReqRow[]> {
  const supabase = await createClient();

  const term = params.search?.trim()
    ? params.search.trim().replace(/[%,()]/g, " ")
    : "";
  const matchedIds = term ? await findMatchingMaterialIds(supabase, term) : [];

  const buildBase = () => {
    let query = supabase.from("consigned_reqs").select("*");
    if (term) {
      query = query.or(buildConsignedReqsSearchOr(term, matchedIds));
    }
    return query
      .order("request_date", { ascending: false })
      .order("id", { ascending: false });
  };

  const rows = await fetchAllRows<ConsignedReqRow>(
    (from, to) => buildBase().range(from, to),
    "사급청구 전체 조회 실패"
  );
  const filtered = params.openOnly
    ? rows.filter((r) => isOutstanding(r.request_qty, r.received_qty))
    : rows;
  return attachMaterials(supabase, filtered);
}

export interface IssuesExportQuery {
  search?: string;
}

/** 출고기록 전량 조회 (엑셀 export 용). getIssues 와 동일한 필터/정렬. */
export async function getAllIssuesForExport(
  params: IssuesExportQuery = {}
): Promise<IssueRow[]> {
  const supabase = await createClient();

  const buildBase = () => {
    let query = supabase.from("issues").select("*");
    if (params.search?.trim()) {
      const term = params.search.trim().replace(/[%,()]/g, " ");
      query = query.or(
        `req_no.ilike.%${term}%,tool_name.ilike.%${term}%,staff.ilike.%${term}%`
      );
    }
    return query
      .order("issue_date", { ascending: false })
      .order("id", { ascending: false });
  };

  const rows = await fetchAllRows<IssueRow>(
    (from, to) => buildBase().range(from, to),
    "출고 전체 조회 실패"
  );
  return attachMaterials(supabase, rows);
}

// ---------------------------------------------------------------------------
// 재고 일괄 조정(엑셀 업로드) 용: mdg_code 목록으로 v_stock_status 를 조회한다.
// Supabase/PostgREST 는 .in() 에 넘기는 배열이 너무 크면(예: URL 길이 제한)
// 문제가 될 수 있으므로 IN_CHUNK_SIZE 단위로 나눠 여러 번 조회해 합친다.
// ---------------------------------------------------------------------------

const IN_CHUNK_SIZE = 500;

/**
 * mdg_code 목록(중복/공백 허용)을 받아 v_stock_status 를 배치 조회하고,
 * trim된 mdg_code -> StockStatusRow[] Map으로 반환한다.
 * mdg_code는 materials 테이블에 유니크 제약이 없어(Part No가 다른 별개
 * 자재가 같은 코드를 가질 수 있다) 코드당 여러 행이 나올 수 있으므로 배열로
 * 반환한다 — 호출부(buildBulkAdjustPreview)가 후보 개수에 따라 not_found/
 * ambiguous/ok를 판정한다. 존재하지 않는 mdg_code는 그냥 Map에 없는 것으로
 * 처리한다.
 *
 * is_active=true 인 자재만 조회한다 — 비활성 자재는 의도적으로 꺼둔
 * 것이라 실사 조정 대상이 아니고, 조회 범위를 좁히면 불필요한 ambiguous
 * 판정도 줄어든다.
 *
 * 같은 mdg_code의 후보 배열은 id 오름차순으로 정렬해 candidates 표시
 * 순서가 매번 같게 한다.
 */
export async function getStockStatusByMdgCodes(
  mdgCodes: string[]
): Promise<Map<string, StockStatusRow[]>> {
  const supabase = await createClient();
  const map = new Map<string, StockStatusRow[]>();

  const uniqueCodes = [
    ...new Set(
      mdgCodes.map((c) => c.trim()).filter((c) => c !== "")
    ),
  ];

  for (let i = 0; i < uniqueCodes.length; i += IN_CHUNK_SIZE) {
    const chunk = uniqueCodes.slice(i, i + IN_CHUNK_SIZE);
    if (chunk.length === 0) continue;

    const { data, error } = await supabase
      .from("v_stock_status")
      .select("*")
      .eq("is_active", true)
      .in("mdg_code", chunk);

    if (error) {
      throw new Error(`자재 일괄 조회 실패: ${error.message}`);
    }

    for (const row of (data ?? []) as StockStatusRow[]) {
      if (row.mdg_code) {
        const code = row.mdg_code.trim();
        const existing = map.get(code);
        if (existing) {
          existing.push(row);
        } else {
          map.set(code, [row]);
        }
      }
    }
  }

  for (const rows of map.values()) {
    rows.sort((a, b) => a.id - b.id);
  }

  return map;
}

// ---------------------------------------------------------------------------
// 자재 신규 일괄 등록(엑셀 업로드) 용: materials 테이블 전량 조회.
// ---------------------------------------------------------------------------

/**
 * 자재 신규 일괄 등록 미리보기/확정에 쓸 기존 자재 전량 조회.
 *
 * `v_stock_status` 뷰가 아니라 `materials` 테이블을 직접 조회한다 — 뷰는
 * mdg_code 가 NULL 인 행(현재 4건)을 제외할 수 있는데, 그 행들이 바로
 * fill_existing(Part No만 있고 MDG코드가 비어 있는 기존 행) 판정 대상이라
 * 반드시 포함되어야 한다.
 *
 * Supabase/PostgREST 는 단일 select 응답을 최대 1,000행으로 제한한다.
 * materials 는 2025-07 기준 2,908행이라 한 번에 다 못 읽으므로, 반드시
 * fetchAllRows 로 1,000행씩 배치 조회해 합친다. 이걸 빠뜨리면 뒤쪽 1,900여
 * 행이 "존재하지 않음"으로 오판되어 대량 중복 자재가 생성된다.
 *
 * .order("id", { ascending: true }) 로 정렬해 fill_ambiguous 의 candidateIds
 * 순서와 상속(inherit) 결과가 호출마다 항상 같게 만든다.
 */
export async function getAllMaterialsForBulkNew(): Promise<
  BulkNewMaterialInfo[]
> {
  const supabase = await createClient();

  return fetchAllRows<BulkNewMaterialInfo>(
    (from, to) =>
      supabase
        .from("materials")
        .select("id, mdg_code, part_no, manufacturer, material_name, size, unit")
        .order("id", { ascending: true })
        .range(from, to),
    "자재 전체 조회 실패"
  );
}
