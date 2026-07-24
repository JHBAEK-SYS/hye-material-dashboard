import { describe, expect, it } from "vitest";

import {
  EXPORT_TYPES,
  consignedReqsSheet,
  issuesSheet,
  materialsSheet,
  parseExportType,
  purchaseOrdersSheet,
} from "@/lib/excel/sheets";
import type {
  ConsignedReqRow,
  IssueRow,
  PurchaseOrderRow,
  StockStatusRow,
} from "@/types/database";

describe("materialsSheet", () => {
  const baseRow: StockStatusRow = {
    id: 1,
    mdg_code: "536691",
    part_no: "PN-1",
    key: "K-1",
    material_name: "테스트자재",
    size: "10mm",
    unit: "EA",
    manufacturer: "제조사A",
    safety_stock: 10,
    opening_stock: 100,
    is_active: true,
    in_total: 50,
    out_total: 30,
    current_stock: 120,
    status: "정상",
  };

  it("헤더 개수와 행의 열 개수가 일치한다", () => {
    const spec = materialsSheet([baseRow]);
    expect(spec.rows).toHaveLength(1);
    expect(spec.rows[0]).toHaveLength(spec.columns.length);
  });

  it("시트 이름이 지정된다", () => {
    const spec = materialsSheet([baseRow]);
    expect(spec.sheetName).toBeTruthy();
  });

  it("빈 배열 입력이면 rows가 빈 배열이다", () => {
    const spec = materialsSheet([]);
    expect(spec.rows).toEqual([]);
    expect(spec.columns.length).toBeGreaterThan(0);
  });

  it("숫자 컬럼은 숫자 타입 그대로 들어간다", () => {
    const spec = materialsSheet([baseRow]);
    const row = spec.rows[0];
    // safety_stock, opening_stock, in_total, out_total, current_stock 는 숫자
    const numericValues = row.filter((v) => typeof v === "number");
    expect(numericValues.length).toBeGreaterThanOrEqual(5);
  });

  it("null 값은 null로 일관되게 처리한다", () => {
    const nullRow: StockStatusRow = {
      ...baseRow,
      mdg_code: null,
      part_no: null,
      key: null,
      material_name: null,
      size: null,
      unit: null,
      manufacturer: null,
      safety_stock: null,
      opening_stock: null,
      in_total: null,
      out_total: null,
      current_stock: null,
      status: null,
    };
    const spec = materialsSheet([nullRow]);
    const row = spec.rows[0];
    expect(row.every((v) => v === null || typeof v === "string")).toBe(true);
    // 활성여부는 문자열이므로 null이 아니어야 함
  });

  it("활성여부(boolean)를 한글로 변환한다", () => {
    const activeSpec = materialsSheet([baseRow]);
    const inactiveSpec = materialsSheet([{ ...baseRow, is_active: false }]);
    const activeIdx = activeSpec.columns.findIndex((c) => c.header === "활성여부");
    expect(activeIdx).toBeGreaterThanOrEqual(0);
    expect(activeSpec.rows[0][activeIdx]).toBe("활성");
    expect(inactiveSpec.rows[0][activeIdx]).toBe("비활성");
  });

  it("헤더에 요구된 한글 컬럼이 모두 포함된다", () => {
    const spec = materialsSheet([baseRow]);
    const headers = spec.columns.map((c) => c.header);
    expect(headers).toEqual([
      "MDG코드",
      "Part No",
      "KEY",
      "자재명",
      "규격",
      "단위",
      "제조사",
      "안전재고",
      "기초재고",
      "입고합계",
      "출고합계",
      "현재고",
      "상태",
      "활성여부",
    ]);
  });
});

describe("purchaseOrdersSheet", () => {
  const baseRow: PurchaseOrderRow = {
    id: 1,
    po_no: "PO-001",
    order_date: "2026-07-01",
    vendor: "거래처A",
    material_id: 10,
    order_qty: 100,
    received_date: "2026-07-10",
    received_qty: 100,
    remark: "비고내용",
    created_by: null,
    created_at: null,
    updated_at: null,
    material: {
      id: 10,
      mdg_code: "536691",
      material_name: "테스트자재",
      part_no: "PN-1",
      unit: "EA",
    },
  };

  it("헤더 개수와 행의 열 개수가 일치한다", () => {
    const spec = purchaseOrdersSheet([baseRow]);
    expect(spec.rows[0]).toHaveLength(spec.columns.length);
  });

  it("헤더가 요구 사양과 일치한다", () => {
    const spec = purchaseOrdersSheet([baseRow]);
    expect(spec.columns.map((c) => c.header)).toEqual([
      "발주번호",
      "발주일",
      "거래처",
      "MDG코드",
      "자재명",
      "발주수량",
      "입고수량",
      "입고일",
      "비고",
    ]);
  });

  it("material 조인이 null인 행도 죽지 않고 빈 값으로 처리된다", () => {
    const row: PurchaseOrderRow = { ...baseRow, material: null, material_id: null };
    const spec = purchaseOrdersSheet([row]);
    const mdgIdx = spec.columns.findIndex((c) => c.header === "MDG코드");
    const nameIdx = spec.columns.findIndex((c) => c.header === "자재명");
    expect(spec.rows[0][mdgIdx]).toBeNull();
    expect(spec.rows[0][nameIdx]).toBeNull();
  });

  it("material 필드가 아예 없는(undefined) 행도 처리된다", () => {
    const { material, ...rest } = baseRow;
    void material;
    const spec = purchaseOrdersSheet([rest as PurchaseOrderRow]);
    expect(spec.rows[0]).toHaveLength(spec.columns.length);
  });

  it("빈 배열 입력이면 rows가 빈 배열이다", () => {
    expect(purchaseOrdersSheet([]).rows).toEqual([]);
  });

  it("수량은 숫자 타입이다", () => {
    const spec = purchaseOrdersSheet([baseRow]);
    const qtyIdx = spec.columns.findIndex((c) => c.header === "발주수량");
    expect(typeof spec.rows[0][qtyIdx]).toBe("number");
  });
});

describe("consignedReqsSheet", () => {
  const baseRow: ConsignedReqRow = {
    id: 1,
    sg_no: "SG-001",
    request_date: "2026-07-01",
    material_id: 10,
    request_qty: 50,
    received_date: null,
    received_qty: null,
    remark: null,
    bl_no: "BL-2026-001",
    created_by: null,
    created_at: null,
    updated_at: null,
    material: {
      id: 10,
      mdg_code: "536691",
      material_name: "테스트자재",
      part_no: "PN-1",
      unit: "EA",
    },
  };

  it("헤더가 요구 사양과 일치한다", () => {
    const spec = consignedReqsSheet([baseRow]);
    expect(spec.columns.map((c) => c.header)).toEqual([
      "사급청구번호",
      "B/L NO",
      "요청일",
      "MDG코드",
      "자재명",
      "요청수량",
      "입고수량",
      "입고일",
      "비고",
    ]);
  });

  it("B/L NO 값이 그대로 들어간다", () => {
    const spec = consignedReqsSheet([baseRow]);
    const blIdx = spec.columns.findIndex((c) => c.header === "B/L NO");
    expect(spec.rows[0][blIdx]).toBe("BL-2026-001");
  });

  it("B/L NO가 null이면 null로 처리된다", () => {
    const spec = consignedReqsSheet([{ ...baseRow, bl_no: null }]);
    const blIdx = spec.columns.findIndex((c) => c.header === "B/L NO");
    expect(spec.rows[0][blIdx]).toBeNull();
  });

  it("헤더 개수와 행의 열 개수가 일치한다", () => {
    const spec = consignedReqsSheet([baseRow]);
    expect(spec.rows[0]).toHaveLength(spec.columns.length);
  });

  it("material null 처리", () => {
    const spec = consignedReqsSheet([{ ...baseRow, material: null }]);
    const mdgIdx = spec.columns.findIndex((c) => c.header === "MDG코드");
    expect(spec.rows[0][mdgIdx]).toBeNull();
  });

  it("null 입고수량/입고일/비고는 null로 처리된다", () => {
    const spec = consignedReqsSheet([baseRow]);
    const qtyIdx = spec.columns.findIndex((c) => c.header === "입고수량");
    const dateIdx = spec.columns.findIndex((c) => c.header === "입고일");
    const remarkIdx = spec.columns.findIndex((c) => c.header === "비고");
    expect(spec.rows[0][qtyIdx]).toBeNull();
    expect(spec.rows[0][dateIdx]).toBeNull();
    expect(spec.rows[0][remarkIdx]).toBeNull();
  });

  it("빈 배열 입력이면 rows가 빈 배열이다", () => {
    expect(consignedReqsSheet([]).rows).toEqual([]);
  });
});

describe("issuesSheet", () => {
  const baseRow: IssueRow = {
    id: 1,
    req_no: "REQ-001",
    issue_date: "2026-07-01",
    material_id: 10,
    qty: 5,
    tool_name: "장비A",
    staff: "홍길동",
    remark: null,
    created_by: null,
    created_at: null,
    material: {
      id: 10,
      mdg_code: "536691",
      material_name: "테스트자재",
      part_no: "PN-1",
      unit: "EA",
    },
  };

  it("헤더가 요구 사양과 일치한다", () => {
    const spec = issuesSheet([baseRow]);
    expect(spec.columns.map((c) => c.header)).toEqual([
      "청구번호",
      "출고일",
      "MDG코드",
      "자재명",
      "수량",
      "장비명",
      "담당자",
      "비고",
    ]);
  });

  it("헤더 개수와 행의 열 개수가 일치한다", () => {
    const spec = issuesSheet([baseRow]);
    expect(spec.rows[0]).toHaveLength(spec.columns.length);
  });

  it("material null 처리 및 빈 배열", () => {
    expect(issuesSheet([]).rows).toEqual([]);
    const spec = issuesSheet([{ ...baseRow, material: null, material_id: null }]);
    const mdgIdx = spec.columns.findIndex((c) => c.header === "MDG코드");
    expect(spec.rows[0][mdgIdx]).toBeNull();
  });

  it("수량은 숫자 타입이다", () => {
    const spec = issuesSheet([baseRow]);
    const qtyIdx = spec.columns.findIndex((c) => c.header === "수량");
    expect(typeof spec.rows[0][qtyIdx]).toBe("number");
  });
});

describe("parseExportType", () => {
  it("EXPORT_TYPES에 4종류가 정의된다", () => {
    expect(EXPORT_TYPES).toEqual(["materials", "orders", "consigned-reqs", "issues"]);
  });

  it.each(EXPORT_TYPES)("유효한 값 '%s'는 그대로 반환한다", (t) => {
    expect(parseExportType(t)).toBe(t);
  });

  it("유효하지 않은 값은 null을 반환한다", () => {
    expect(parseExportType("invalid")).toBeNull();
    expect(parseExportType("")).toBeNull();
    expect(parseExportType("Materials")).toBeNull();
  });
});
