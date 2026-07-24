import type {
  ConsignedReqRow,
  IssueRow,
  PurchaseOrderRow,
  StockStatusRow,
} from "@/types/database";

/**
 * DB 행 배열 -> 엑셀 시트 정의로 변환하는 순수 함수 모음.
 * exceljs / DB 클라이언트에 의존하지 않으며, Route Handler에서
 * 이 SheetSpec을 받아 실제 워크북을 생성한다.
 */
export type SheetSpec = {
  sheetName: string;
  columns: { header: string; width?: number }[];
  rows: (string | number | null)[][];
};

/** 값이 없으면 null, 있으면 그대로(문자열/숫자) 반환. 빈 셀 표현을 일관되게 유지. */
function cell<T extends string | number>(value: T | null | undefined): T | null {
  return value === undefined || value === null ? null : value;
}

/** boolean -> 한글 활성/비활성 */
function activeLabel(isActive: boolean | null | undefined): string {
  return isActive ? "활성" : "비활성";
}

export function materialsSheet(rows: StockStatusRow[]): SheetSpec {
  const columns: SheetSpec["columns"] = [
    { header: "MDG코드", width: 14 },
    { header: "Part No", width: 16 },
    { header: "KEY", width: 12 },
    { header: "자재명", width: 32 },
    { header: "규격", width: 16 },
    { header: "단위", width: 8 },
    { header: "제조사", width: 16 },
    { header: "안전재고", width: 10 },
    { header: "기초재고", width: 10 },
    { header: "입고합계", width: 10 },
    { header: "출고합계", width: 10 },
    { header: "현재고", width: 10 },
    { header: "상태", width: 12 },
    { header: "활성여부", width: 10 },
  ];

  const dataRows = rows.map((row) => [
    cell(row.mdg_code),
    cell(row.part_no),
    cell(row.key),
    cell(row.material_name),
    cell(row.size),
    cell(row.unit),
    cell(row.manufacturer),
    cell(row.safety_stock),
    cell(row.opening_stock),
    cell(row.in_total),
    cell(row.out_total),
    cell(row.current_stock),
    cell(row.status),
    activeLabel(row.is_active),
  ]);

  return { sheetName: "자재마스터", columns, rows: dataRows };
}

export function purchaseOrdersSheet(rows: PurchaseOrderRow[]): SheetSpec {
  const columns: SheetSpec["columns"] = [
    { header: "발주번호", width: 16 },
    { header: "발주일", width: 12 },
    { header: "거래처", width: 20 },
    { header: "MDG코드", width: 14 },
    { header: "자재명", width: 32 },
    { header: "발주수량", width: 10 },
    { header: "입고수량", width: 10 },
    { header: "입고일", width: 12 },
    { header: "비고", width: 24 },
  ];

  const dataRows = rows.map((row) => [
    cell(row.po_no),
    cell(row.order_date),
    cell(row.vendor),
    cell(row.material?.mdg_code),
    cell(row.material?.material_name),
    cell(row.order_qty),
    cell(row.received_qty),
    cell(row.received_date),
    cell(row.remark),
  ]);

  return { sheetName: "도급발주", columns, rows: dataRows };
}

export function consignedReqsSheet(rows: ConsignedReqRow[]): SheetSpec {
  const columns: SheetSpec["columns"] = [
    { header: "사급청구번호", width: 18 },
    { header: "B/L NO", width: 16 },
    { header: "요청일", width: 12 },
    { header: "MDG코드", width: 14 },
    { header: "자재명", width: 32 },
    { header: "요청수량", width: 10 },
    { header: "입고수량", width: 10 },
    { header: "입고일", width: 12 },
    { header: "비고", width: 24 },
  ];

  const dataRows = rows.map((row) => [
    cell(row.sg_no),
    cell(row.bl_no),
    cell(row.request_date),
    cell(row.material?.mdg_code),
    cell(row.material?.material_name),
    cell(row.request_qty),
    cell(row.received_qty),
    cell(row.received_date),
    cell(row.remark),
  ]);

  return { sheetName: "사급청구", columns, rows: dataRows };
}

export function issuesSheet(rows: IssueRow[]): SheetSpec {
  const columns: SheetSpec["columns"] = [
    { header: "청구번호", width: 16 },
    { header: "출고일", width: 12 },
    { header: "MDG코드", width: 14 },
    { header: "자재명", width: 32 },
    { header: "수량", width: 10 },
    { header: "장비명", width: 20 },
    { header: "담당자", width: 14 },
    { header: "비고", width: 24 },
  ];

  const dataRows = rows.map((row) => [
    cell(row.req_no),
    cell(row.issue_date),
    cell(row.material?.mdg_code),
    cell(row.material?.material_name),
    cell(row.qty),
    cell(row.tool_name),
    cell(row.staff),
    cell(row.remark),
  ]);

  return { sheetName: "출고기록", columns, rows: dataRows };
}

export const EXPORT_TYPES = [
  "materials",
  "orders",
  "consigned-reqs",
  "issues",
] as const;

export type ExportType = (typeof EXPORT_TYPES)[number];

export function parseExportType(value: string): ExportType | null {
  return (EXPORT_TYPES as readonly string[]).includes(value)
    ? (value as ExportType)
    : null;
}
