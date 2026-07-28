import ExcelJS from "exceljs";

import type { BulkAdjustInputRow } from "@/lib/materials/bulk-adjust";

/**
 * exceljs 셀 값을 문자열로 정규화한다. 셀 값은 문자열/숫자/Date/richText/
 * 수식결과(formula result) 등 다양한 타입으로 올 수 있으므로, 표시상 의미
 * 있는 텍스트만 뽑아 trim된 문자열로 반환한다.
 */
function normalizeCell(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text).join("");
    }
    if ("result" in value && value.result !== undefined) {
      return normalizeCell(value.result as ExcelJS.CellValue);
    }
    if ("text" in value && value.text !== undefined) {
      return String(value.text);
    }
    return "";
  }
  return String(value);
}

/**
 * 업로드된 .xlsx 버퍼를 파싱해 실사 결과(MDG코드·실사수량[·Part No]) 원본 행
 * 배열로 변환한다. 검증/역산은 하지 않는다(순수 파싱만) — buildBulkAdjustPreview
 * 에서 이 결과를 받아 처리한다.
 *
 * - 첫 번째 비어있지 않은 행을 헤더로 본다.
 * - 헤더 텍스트에 "MDG"가 포함된 열을 mdg_code 열로, "수량"이 포함된 열을
 *   qty 열로 찾는다 (trim, 대소문자 무시). 둘 중 하나라도 못 찾으면 에러.
 * - "PART" 또는 "품번"이 포함된 열을 part_no 열로 찾는다(대소문자 무시) —
 *   선택 열이라 없어도 에러를 던지지 않고 각 행의 part_no를 빈 문자열로
 *   채운다. mdg_code/qty와 마찬가지로 이미 다른 용도로 잡힌 열 번호는
 *   재사용하지 않는다(claimedCols) — 예를 들어 "수량"으로 이미 잡힌 열은
 *   part_no 열로 다시 잡히지 않는다.
 * - 헤더 다음 행부터 순회하며 mdg_code 셀이 비어있으면 그 행에서 멈춘다.
 */
export async function parseBulkAdjustFile(
  buffer: Buffer
): Promise<BulkAdjustInputRow[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs의 타입 선언(index.d.ts)이 로컬로 선언하는 ambient `Buffer`(ArrayBuffer 확장)가
  // @types/node의 전역 Buffer<ArrayBufferLike>와 구조적으로 어긋나 tsc가 거부한다.
  // 런타임에는 Node Buffer를 그대로 받아 처리하므로, load()가 실제로 기대하는
  // 매개변수 타입을 Parameters<>로 뽑아 안전하게 캐스팅한다(any 사용 회피).
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("엑셀 파일에 시트가 없습니다.");
  }

  let headerRowNumber: number | null = null;
  sheet.eachRow({ includeEmpty: false }, (_row, rowNumber) => {
    if (headerRowNumber === null) {
      headerRowNumber = rowNumber;
    }
  });

  if (headerRowNumber === null) {
    throw new Error("엑셀 파일에 데이터가 없습니다.");
  }

  const headerRow = sheet.getRow(headerRowNumber);
  const headerTexts: string[] = [];
  let mdgColIndex: number | null = null;
  let qtyColIndex: number | null = null;
  let partColIndex: number | null = null;
  // 한 열 번호가 두 용도로 겹쳐 잡히지 않도록(예: "품번"이 "수량" 탐지와
  // 충돌하지 않도록) 이미 다른 필드에 배정된 열 번호는 재사용하지 않는다.
  const claimedCols = new Set<number>();

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = normalizeCell(cell.value).trim();
    headerTexts.push(text);
    const upper = text.toUpperCase();

    if (mdgColIndex === null && !claimedCols.has(colNumber) && upper.includes("MDG")) {
      mdgColIndex = colNumber;
      claimedCols.add(colNumber);
      return;
    }
    if (qtyColIndex === null && !claimedCols.has(colNumber) && text.includes("수량")) {
      qtyColIndex = colNumber;
      claimedCols.add(colNumber);
      return;
    }
    if (
      partColIndex === null &&
      !claimedCols.has(colNumber) &&
      (upper.includes("PART") || text.includes("품번"))
    ) {
      partColIndex = colNumber;
      claimedCols.add(colNumber);
    }
  });

  if (mdgColIndex === null || qtyColIndex === null) {
    const found = headerTexts.length > 0 ? headerTexts.join(", ") : "없음";
    throw new Error(
      `엑셀 헤더에서 MDG코드/수량 열을 찾을 수 없습니다. (발견된 헤더: ${found})`
    );
  }

  const rows: BulkAdjustInputRow[] = [];
  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const mdgText = normalizeCell(row.getCell(mdgColIndex).value).trim();
    if (mdgText === "") break;
    const qtyText = normalizeCell(row.getCell(qtyColIndex).value).trim();
    const inputRow: BulkAdjustInputRow = { mdg_code: mdgText, qty: qtyText };
    if (partColIndex !== null) {
      inputRow.part_no = normalizeCell(row.getCell(partColIndex).value).trim();
    }
    rows.push(inputRow);
  }

  return rows;
}
