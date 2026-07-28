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

/**
 * 엑셀에서 파싱된 원본 행 (문자열 그대로 — 서버가 재검증 시 이걸 다시 쓴다).
 * part_no는 선택 속성 — 같은 mdg_code에 자재가 여러 개일 때만 모호성 해소에 쓰인다.
 */
export type BulkAdjustInputRow = { mdg_code: string; qty: string; part_no?: string };

/**
 * 미리보기 계산에 필요한 자재 정보. v_stock_status 뷰의 부분집합.
 * 호출부(Route Handler)가 mdg_code -> 이 타입의 배열 Map을 만들어 전달한다
 * (같은 mdg_code에 자재가 여러 개일 수 있다 — mdg_code는 유니크 제약이 없다).
 */
export type BulkAdjustMaterialInfo = {
  id: number;
  material_name: string | null;
  part_no: string | null;
  manufacturer: string | null;
  opening_stock: number | null;
  in_total: number | null;
  out_total: number | null;
  current_stock: number | null;
};

/** ambiguous 상태에서 화면에 보여줄 후보 정보(전체 BulkAdjustMaterialInfo 대신 표시에 필요한 부분만). */
export type BulkAdjustAmbiguousCandidate = {
  id: number;
  part_no: string | null;
  manufacturer: string | null;
  material_name: string | null;
};

export type BulkAdjustPreviewRow =
  | {
      status: "ok";
      mdg_code: string;
      id: number;
      material_name: string | null;
      part_no: string | null;
      manufacturer: string | null;
      currentStock: number;
      target: number;
      prevOpeningStock: number;
      newOpeningStock: number;
      negativeWarning: boolean; // newOpeningStock < 0
    }
  | { status: "not_found"; mdg_code: string; qty: string }
  | { status: "invalid_qty"; mdg_code: string; qty: string; reason: string }
  | { status: "duplicate"; mdg_code: string; qty: string }
  | {
      status: "ambiguous";
      mdg_code: string;
      qty: string;
      candidates: BulkAdjustAmbiguousCandidate[];
    };

/** 비교용 키를 만들기 위해 trim + 소문자 변환한다. null/undefined는 빈 문자열로 취급한다. */
function normKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** (mdg_code, part_no) 조합 키. 구분자는 raw NUL 대신 \u0000 이스케이프 표기를 쓴다. */
function comboKey(mdg: string, part: string | undefined): string {
  return `${normKey(mdg)}\u0000${normKey(part)}`;
}

/** 후보 목록을 id 오름차순으로 정렬하고 화면 표시에 필요한 필드만 최대 5건 추린다. */
function toAmbiguousCandidates(
  candidates: BulkAdjustMaterialInfo[]
): BulkAdjustAmbiguousCandidate[] {
  return [...candidates]
    .sort((a, b) => a.id - b.id)
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      part_no: c.part_no,
      manufacturer: c.manufacturer,
      material_name: c.material_name,
    }));
}

/**
 * 입력 순서를 유지하며 각 행의 상태를 판정한다.
 *
 * 판정 우선순위:
 * 1. 파일 안에서 (mdg_code, part_no) 조합(trim 후, part_no는 대소문자 무시)이
 *    2회 이상 나오면 그 조합의 모든 행이 duplicate — 다른 문제(not_found/
 *    ambiguous/invalid_qty) 여부와 무관하게 최우선 적용, 적용 대상에서
 *    제외한다. mdg_code가 같아도 part_no가 다르면 별개 물건이므로 duplicate가
 *    아니다.
 * 2. materials Map에 해당 mdg_code의 후보가 0건이면 not_found.
 * 3. 후보가 2건 이상이면(같은 mdg_code에 자재가 여러 개, mdg_code는 유니크가
 *    아니다): 입력 행에 part_no가 있으면 그것으로 좁힌다(trim + 대소문자
 *    무시). 정확히 1건으로 좁혀지면 통과, 0건이면 not_found, 여전히 2건
 *    이상이면 ambiguous(candidates는 id 오름차순, 최대 5건). part_no가
 *    없으면 그대로 ambiguous.
 * 4. validateStockAdjustment 로 qty가 유효하지 않으면 invalid_qty(사유 포함).
 * 5. 나머지는 ok — computeOpeningStockForTarget 으로 새 기초재고를 역산하고,
 *    결과가 음수면 negativeWarning=true 로 표시만 한다(막지 않음).
 */
export function buildBulkAdjustPreview(
  rows: BulkAdjustInputRow[],
  materials: Map<string, BulkAdjustMaterialInfo[]>
): BulkAdjustPreviewRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = comboKey(row.mdg_code, row.part_no);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return rows.map((row): BulkAdjustPreviewRow => {
    const mdg_code = row.mdg_code.trim();
    const qty = row.qty;
    const partNoInput = (row.part_no ?? "").trim();

    const key = comboKey(row.mdg_code, row.part_no);
    if ((counts.get(key) ?? 0) > 1) {
      return { status: "duplicate", mdg_code, qty };
    }

    const candidates = materials.get(mdg_code) ?? [];
    if (candidates.length === 0) {
      return { status: "not_found", mdg_code, qty };
    }

    let material: BulkAdjustMaterialInfo;
    if (candidates.length === 1) {
      material = candidates[0];
    } else if (partNoInput !== "") {
      const filtered = candidates.filter(
        (c) => normKey(c.part_no) === normKey(partNoInput)
      );
      if (filtered.length === 0) {
        return { status: "not_found", mdg_code, qty };
      }
      if (filtered.length > 1) {
        return {
          status: "ambiguous",
          mdg_code,
          qty,
          candidates: toAmbiguousCandidates(filtered),
        };
      }
      material = filtered[0];
    } else {
      return {
        status: "ambiguous",
        mdg_code,
        qty,
        candidates: toAmbiguousCandidates(candidates),
      };
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
      id: material.id,
      material_name: material.material_name,
      part_no: material.part_no,
      manufacturer: material.manufacturer,
      currentStock,
      target,
      prevOpeningStock,
      newOpeningStock,
      negativeWarning: newOpeningStock < 0,
    };
  });
}
