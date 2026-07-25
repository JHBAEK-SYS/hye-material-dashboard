import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { parseBulkAdjustFile } from "@/lib/materials/parse-bulk-adjust-file";

/** 테스트용 워크북을 만들어 buffer로 직렬화한다. rows[0]은 헤더. */
async function buildBuffer(
  rows: (string | number | null)[][],
  sheetName = "Sheet1"
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  for (const row of rows) {
    sheet.addRow(row);
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe("parseBulkAdjustFile", () => {
  it("MDG코드·실사수량 헤더를 찾아 데이터 행을 파싱한다 (왕복 테스트)", async () => {
    const buffer = await buildBuffer([
      ["MDG코드", "실사수량"],
      ["536691", 125],
      ["111111", "40"],
    ]);
    const result = await parseBulkAdjustFile(buffer);
    expect(result).toEqual([
      { mdg_code: "536691", qty: "125" },
      { mdg_code: "111111", qty: "40" },
    ]);
  });

  it("헤더 열 순서가 반대여도(수량이 먼저) 열 이름으로 찾는다", async () => {
    const buffer = await buildBuffer([
      ["실사수량", "MDG코드"],
      [10, "AAA"],
    ]);
    const result = await parseBulkAdjustFile(buffer);
    expect(result).toEqual([{ mdg_code: "AAA", qty: "10" }]);
  });

  it("헤더 텍스트에 다른 단어가 섞여도(예: 'MDG 코드', '실사 수량') 부분 포함으로 찾는다", async () => {
    const buffer = await buildBuffer([
      ["MDG 코드", "실사 수량"],
      ["536691", 5],
    ]);
    const result = await parseBulkAdjustFile(buffer);
    expect(result).toEqual([{ mdg_code: "536691", qty: "5" }]);
  });

  it("헤더 대소문자를 무시한다", async () => {
    const buffer = await buildBuffer([
      ["mdg코드", "수량"],
      ["536691", 5],
    ]);
    const result = await parseBulkAdjustFile(buffer);
    expect(result).toEqual([{ mdg_code: "536691", qty: "5" }]);
  });

  it("숫자 셀 값을 문자열로 정규화한다", async () => {
    const buffer = await buildBuffer([
      ["MDG코드", "수량"],
      [536691, 125],
    ]);
    const result = await parseBulkAdjustFile(buffer);
    expect(result).toEqual([{ mdg_code: "536691", qty: "125" }]);
  });

  it("MDG코드 셀이 비어있는 행을 만나면 그 행에서 멈춘다", async () => {
    const buffer = await buildBuffer([
      ["MDG코드", "수량"],
      ["536691", 10],
      ["", 20],
      ["111111", 30],
    ]);
    const result = await parseBulkAdjustFile(buffer);
    expect(result).toEqual([{ mdg_code: "536691", qty: "10" }]);
  });

  it("첫 번째 비어있는 행은 건너뛰고 첫 비어있지 않은 행을 헤더로 삼는다", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    // 1행은 완전히 비워둔 채로, 2행부터 헤더
    sheet.getRow(2).values = ["MDG코드", "수량"];
    sheet.getRow(3).values = ["536691", 10];
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await parseBulkAdjustFile(buffer);
    expect(result).toEqual([{ mdg_code: "536691", qty: "10" }]);
  });

  it("MDG 헤더를 찾지 못하면 에러를 던진다", async () => {
    const buffer = await buildBuffer([
      ["코드", "수량"],
      ["536691", 10],
    ]);
    await expect(parseBulkAdjustFile(buffer)).rejects.toThrow();
  });

  it("수량 헤더를 찾지 못하면 에러를 던진다", async () => {
    const buffer = await buildBuffer([
      ["MDG코드", "개수"],
      ["536691", 10],
    ]);
    await expect(parseBulkAdjustFile(buffer)).rejects.toThrow();
  });

  it("에러 메시지에 발견된 헤더 텍스트를 포함한다", async () => {
    const buffer = await buildBuffer([
      ["코드", "개수"],
      ["536691", 10],
    ]);
    await expect(parseBulkAdjustFile(buffer)).rejects.toThrow(/코드/);
  });

  it("데이터 행이 없으면(헤더만 있으면) 빈 배열을 반환한다", async () => {
    const buffer = await buildBuffer([["MDG코드", "수량"]]);
    const result = await parseBulkAdjustFile(buffer);
    expect(result).toEqual([]);
  });

  it("빈 워크북(행 없음)이면 에러를 던진다", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Sheet1");
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await expect(parseBulkAdjustFile(buffer)).rejects.toThrow();
  });

  it("셀 값 앞뒤 공백을 trim한다", async () => {
    const buffer = await buildBuffer([
      ["MDG코드", "수량"],
      ["  536691  ", "  10  "],
    ]);
    const result = await parseBulkAdjustFile(buffer);
    expect(result).toEqual([{ mdg_code: "536691", qty: "10" }]);
  });
});
