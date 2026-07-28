import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { parseBulkNewFile } from "@/lib/materials/parse-bulk-new-file";

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

describe("parseBulkNewFile", () => {
  it("실제 파일과 같은 배치(1행 비었고 2행 헤더, C·D·E 열, 데이터 3행부터)를 파싱한다", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet4");
    // 1행은 완전히 비워둔다.
    sheet.getRow(1).values = [];
    // 2행 헤더: A, B는 비어있고 C, D, E에 Manufacturer / MDG Code / Part Number
    sheet.getRow(2).getCell(3).value = "Manufacturer";
    sheet.getRow(2).getCell(4).value = "MDG Code";
    sheet.getRow(2).getCell(5).value = "Part Number";
    // 3행부터 데이터
    sheet.getRow(3).getCell(3).value = "Above All";
    sheet.getRow(3).getCell(4).value = "602731";
    sheet.getRow(3).getCell(5).value = "041DI060";
    sheet.getRow(4).getCell(3).value = "Aeroflex";
    sheet.getRow(4).getCell(4).value = "607401";
    sheet.getRow(4).getCell(5).value = "3MNEBST11034 (Aeroflex)";
    sheet.getRow(5).getCell(3).value = "Amphenol";
    sheet.getRow(5).getCell(4).value = "610001";
    sheet.getRow(5).getCell(5).value = "AMP-001";

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await parseBulkNewFile(buffer);
    expect(result).toEqual([
      {
        manufacturer: "Above All",
        mdg_code: "602731",
        part_no: "041DI060",
        material_name: "",
        size: "",
        unit: "",
      },
      {
        manufacturer: "Aeroflex",
        mdg_code: "607401",
        part_no: "3MNEBST11034 (Aeroflex)",
        material_name: "",
        size: "",
        unit: "",
      },
      {
        manufacturer: "Amphenol",
        mdg_code: "610001",
        part_no: "AMP-001",
        material_name: "",
        size: "",
        unit: "",
      },
    ]);
  });

  it("헤더가 1행에 바로 있는 경우도 동작한다", async () => {
    const buffer = await buildBuffer([
      ["Manufacturer", "MDG Code", "Part Number"],
      ["Above All", "602731", "041DI060"],
    ]);
    const result = await parseBulkNewFile(buffer);
    expect(result).toEqual([
      {
        manufacturer: "Above All",
        mdg_code: "602731",
        part_no: "041DI060",
        material_name: "",
        size: "",
        unit: "",
      },
    ]);
  });

  it("한글 헤더(제조사, MDG코드, 품번)도 동작한다", async () => {
    const buffer = await buildBuffer([
      ["제조사", "MDG코드", "품번"],
      ["에이보올", "602731", "041DI060"],
    ]);
    const result = await parseBulkNewFile(buffer);
    expect(result).toEqual([
      {
        manufacturer: "에이보올",
        mdg_code: "602731",
        part_no: "041DI060",
        material_name: "",
        size: "",
        unit: "",
      },
    ]);
  });

  it("헤더 열 순서가 뒤바뀐 경우(MDG Code가 Manufacturer보다 앞)도 동작한다", async () => {
    const buffer = await buildBuffer([
      ["MDG Code", "Part Number", "Manufacturer"],
      ["602731", "041DI060", "Above All"],
    ]);
    const result = await parseBulkNewFile(buffer);
    expect(result).toEqual([
      {
        manufacturer: "Above All",
        mdg_code: "602731",
        part_no: "041DI060",
        material_name: "",
        size: "",
        unit: "",
      },
    ]);
  });

  it("중간 빈 행을 건너뛰고 그 뒤 데이터까지 읽는다", async () => {
    const buffer = await buildBuffer([
      ["Manufacturer", "MDG Code", "Part Number"],
      ["Above All", "602731", "041DI060"],
      ["", "", ""],
      ["", "", ""],
      ["Aeroflex", "607401", "3MNEBST11034 (Aeroflex)"],
    ]);
    const result = await parseBulkNewFile(buffer);
    expect(result).toEqual([
      {
        manufacturer: "Above All",
        mdg_code: "602731",
        part_no: "041DI060",
        material_name: "",
        size: "",
        unit: "",
      },
      {
        manufacturer: "Aeroflex",
        mdg_code: "607401",
        part_no: "3MNEBST11034 (Aeroflex)",
        material_name: "",
        size: "",
        unit: "",
      },
    ]);
  });

  it("MDG코드가 숫자 셀일 때 문자열로 정규화한다", async () => {
    const buffer = await buildBuffer([
      ["Manufacturer", "MDG Code", "Part Number"],
      ["Above All", 602731, "041DI060"],
    ]);
    const result = await parseBulkNewFile(buffer);
    expect(result).toEqual([
      {
        manufacturer: "Above All",
        mdg_code: "602731",
        part_no: "041DI060",
        material_name: "",
        size: "",
        unit: "",
      },
    ]);
  });

  it("Part No 열을 찾지 못하면 에러를 던진다", async () => {
    const buffer = await buildBuffer([
      ["Manufacturer", "MDG Code", "제품군"],
      ["Above All", "602731", "041DI060"],
    ]);
    await expect(parseBulkNewFile(buffer)).rejects.toThrow(
      /MDG코드\/Part No\/제조사/
    );
  });

  it("에러 메시지에 발견된 헤더 텍스트를 포함한다", async () => {
    const buffer = await buildBuffer([
      ["MDG코드", "이름", "구분"],
      ["602731", "Above All", "041DI060"],
    ]);
    await expect(parseBulkNewFile(buffer)).rejects.toThrow(/MDG코드/);
  });

  it("데이터는 있지만 MDG 헤더가 없으면, 빈 파일이 아니라 헤더 문제임을 알린다", async () => {
    const buffer = await buildBuffer([
      ["제조사", "품번", "수량"],
      ["Above All", "041DI060", "10"],
    ]);
    // "데이터가 없습니다"로 안내하면 원인을 못 찾으므로, 헤더 문제임과
    // 실제로 읽은 첫 행 값을 함께 보여줘야 한다.
    await expect(parseBulkNewFile(buffer)).rejects.toThrow(/헤더/);
    await expect(parseBulkNewFile(buffer)).rejects.toThrow(/제조사, 품번, 수량/);
    await expect(parseBulkNewFile(buffer)).rejects.not.toThrow(
      /엑셀 파일에 데이터가 없습니다/
    );
  });

  it("시트가 비어있으면(행 없음) 에러를 던진다", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Sheet1");
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await expect(parseBulkNewFile(buffer)).rejects.toThrow();
  });

  it("워크북에 시트가 없으면 에러를 던진다", async () => {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await expect(parseBulkNewFile(buffer)).rejects.toThrow(
      "엑셀 파일에 시트가 없습니다."
    );
  });

  it("자재명·규격 열이 있으면 값을 읽는다", async () => {
    const buffer = await buildBuffer([
      ["Manufacturer", "MDG Code", "Part Number", "Material Name", "Size"],
      ["Above All", "602731", "041DI060", "Foam Strip", "1/4 inch"],
    ]);
    const result = await parseBulkNewFile(buffer);
    expect(result).toEqual([
      {
        manufacturer: "Above All",
        mdg_code: "602731",
        part_no: "041DI060",
        material_name: "Foam Strip",
        size: "1/4 inch",
        unit: "",
      },
    ]);
  });

  it("자재명·규격 열이 없는 파일(기존 3열만)은 에러 없이 빈 문자열로 채운다", async () => {
    const buffer = await buildBuffer([
      ["Manufacturer", "MDG Code", "Part Number"],
      ["Above All", "602731", "041DI060"],
    ]);
    const result = await parseBulkNewFile(buffer);
    expect(result).toEqual([
      {
        manufacturer: "Above All",
        mdg_code: "602731",
        part_no: "041DI060",
        material_name: "",
        size: "",
        unit: "",
      },
    ]);
  });

  it("Manufacturer와 Material Name이 둘 다 있으면 서로 다른 열로 정확히 잡는다", async () => {
    const buffer = await buildBuffer([
      ["MDG Code", "Part Number", "Manufacturer", "Material Name"],
      ["602731", "041DI060", "Above All", "Foam Strip"],
    ]);
    const result = await parseBulkNewFile(buffer);
    expect(result).toEqual([
      {
        mdg_code: "602731",
        part_no: "041DI060",
        manufacturer: "Above All",
        material_name: "Foam Strip",
        size: "",
        unit: "",
      },
    ]);
  });

  it("품번과 품명이 둘 다 있으면 각각 part_no/material_name으로 잡는다", async () => {
    const buffer = await buildBuffer([
      ["제조사", "MDG코드", "품번", "품명"],
      ["에이보올", "602731", "041DI060", "폼 스트립"],
    ]);
    const result = await parseBulkNewFile(buffer);
    expect(result).toEqual([
      {
        manufacturer: "에이보올",
        mdg_code: "602731",
        part_no: "041DI060",
        material_name: "폼 스트립",
        size: "",
        unit: "",
      },
    ]);
  });

  it("Unit(단위) 열을 포함한 6열 전부 있는 파일을 파싱한다", async () => {
    const buffer = await buildBuffer([
      [
        "Manufacturer",
        "MDG Code",
        "Part Number",
        "Material Name",
        "Size",
        "Unit",
      ],
      ["Above All", "602731", "041DI060", "Foam Strip", "1/4 inch", "EA"],
    ]);
    const result = await parseBulkNewFile(buffer);
    expect(result).toEqual([
      {
        manufacturer: "Above All",
        mdg_code: "602731",
        part_no: "041DI060",
        material_name: "Foam Strip",
        size: "1/4 inch",
        unit: "EA",
      },
    ]);
  });

  it("Unit 열이 없는 기존 파일도 그대로 동작한다(unit은 빈 문자열)", async () => {
    const buffer = await buildBuffer([
      ["Manufacturer", "MDG Code", "Part Number", "Material Name", "Size"],
      ["Above All", "602731", "041DI060", "Foam Strip", "1/4 inch"],
    ]);
    const result = await parseBulkNewFile(buffer);
    expect(result).toEqual([
      {
        manufacturer: "Above All",
        mdg_code: "602731",
        part_no: "041DI060",
        material_name: "Foam Strip",
        size: "1/4 inch",
        unit: "",
      },
    ]);
  });

  it("한글 '단위' 헤더도 단위 열로 인식한다", async () => {
    const buffer = await buildBuffer([
      ["제조사", "MDG코드", "품번", "품명", "규격", "단위"],
      ["에이보올", "602731", "041DI060", "폼 스트립", "1/4 인치", "EA"],
    ]);
    const result = await parseBulkNewFile(buffer);
    expect(result).toEqual([
      {
        manufacturer: "에이보올",
        mdg_code: "602731",
        part_no: "041DI060",
        material_name: "폼 스트립",
        size: "1/4 인치",
        unit: "EA",
      },
    ]);
  });

  it("Unit과 다른 열(Manufacturer/Material Name/Size)이 서로 다른 열로 구분된다", async () => {
    const buffer = await buildBuffer([
      [
        "Unit",
        "MDG Code",
        "Part Number",
        "Manufacturer",
        "Material Name",
        "Size",
      ],
      ["EA", "602731", "041DI060", "Above All", "Foam Strip", "1/4 inch"],
    ]);
    const result = await parseBulkNewFile(buffer);
    expect(result).toEqual([
      {
        mdg_code: "602731",
        part_no: "041DI060",
        manufacturer: "Above All",
        material_name: "Foam Strip",
        size: "1/4 inch",
        unit: "EA",
      },
    ]);
  });
});
