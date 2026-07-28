import ExcelJS from "exceljs";

export interface BulkNewInputRow {
  mdg_code: string;
  part_no: string;
  manufacturer: string;
}

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
 * 업로드된 .xlsx 버퍼를 파싱해 자재 마스터 신규 일괄 등록 원본 행 배열로
 * 변환한다. 검증/중복판정/DB조회는 하지 않는다(순수 파싱만).
 *
 * - 첫 번째 워크시트를 쓴다(시트명에 의존하지 않는다).
 * - 위에서부터 각 행을 훑어, 셀 텍스트에 "MDG"(대소문자 무시)가 포함된 셀이
 *   있는 첫 번째 행을 헤더 행으로 삼는다. 앞에 제목 행이나 빈 행이 붙은
 *   파일이 흔하므로 "첫 번째 비어있지 않은 행"을 헤더로 보지 않는다.
 * - 헤더 텍스트에 "MDG"가 포함된 열을 mdg_code 열로, "PART" 또는 "품번"이
 *   포함된 열을 part_no 열로, "MANUFACTURER"/"제조사"/"MAKER"가 포함된
 *   열을 manufacturer 열로 찾는다(모두 대소문자 무시). 셋 중 하나라도
 *   못 찾으면 에러.
 * - 헤더 다음 행부터 sheet.rowCount까지 순회한다. 세 값이 모두 빈 문자열인
 *   행은 건너뛴다(중간에 빈 줄이 섞인 파일이 있다).
 */
export async function parseBulkNewFile(
  buffer: Buffer
): Promise<BulkNewInputRow[]> {
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
  // 헤더를 못 찾았을 때 사용자에게 "무엇을 봤는지" 알려주기 위해 첫 번째
  // 비어있지 않은 행의 텍스트를 따로 보관한다.
  let firstRowTexts: string[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (headerRowNumber !== null) return;
    const texts: string[] = [];
    let hasMdgCell = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      const text = normalizeCell(cell.value).trim();
      texts.push(text);
      if (text.toUpperCase().includes("MDG")) {
        hasMdgCell = true;
      }
    });
    if (firstRowTexts.length === 0 && texts.length > 0) {
      firstRowTexts = texts;
    }
    if (hasMdgCell) {
      headerRowNumber = rowNumber;
    }
  });

  if (headerRowNumber === null) {
    // 행이 아예 없는 파일과, 행은 있지만 MDG 헤더가 없는 파일을 구분한다.
    // 후자에 "데이터가 없습니다"라고 안내하면 원인을 못 찾는다.
    if (firstRowTexts.length === 0) {
      throw new Error("엑셀 파일에 데이터가 없습니다.");
    }
    throw new Error(
      `엑셀 헤더에서 MDG코드 열을 찾을 수 없습니다. 헤더 행에 'MDG'가 들어간 열 이름이 있어야 합니다. (첫 행에서 발견된 값: ${firstRowTexts.join(", ")})`
    );
  }

  const headerRow = sheet.getRow(headerRowNumber);
  const headerTexts: string[] = [];
  let mdgColIndex: number | null = null;
  let partColIndex: number | null = null;
  let manufacturerColIndex: number | null = null;

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = normalizeCell(cell.value).trim();
    headerTexts.push(text);
    const upper = text.toUpperCase();
    if (mdgColIndex === null && upper.includes("MDG")) {
      mdgColIndex = colNumber;
    }
    if (
      partColIndex === null &&
      (upper.includes("PART") || text.includes("품번"))
    ) {
      partColIndex = colNumber;
    }
    if (
      manufacturerColIndex === null &&
      (upper.includes("MANUFACTURER") ||
        text.includes("제조사") ||
        upper.includes("MAKER"))
    ) {
      manufacturerColIndex = colNumber;
    }
  });

  if (
    mdgColIndex === null ||
    partColIndex === null ||
    manufacturerColIndex === null
  ) {
    const found = headerTexts.length > 0 ? headerTexts.join(", ") : "없음";
    throw new Error(
      `엑셀 헤더에서 MDG코드/Part No/제조사 열을 찾을 수 없습니다. (발견된 헤더: ${found})`
    );
  }

  const rows: BulkNewInputRow[] = [];
  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const mdgText = normalizeCell(row.getCell(mdgColIndex).value).trim();
    const partText = normalizeCell(row.getCell(partColIndex).value).trim();
    const manufacturerText = normalizeCell(
      row.getCell(manufacturerColIndex).value
    ).trim();
    if (mdgText === "" && partText === "" && manufacturerText === "") {
      continue;
    }
    rows.push({
      mdg_code: mdgText,
      part_no: partText,
      manufacturer: manufacturerText,
    });
  }

  return rows;
}
