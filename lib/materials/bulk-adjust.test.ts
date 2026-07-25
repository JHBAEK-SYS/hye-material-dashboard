import { describe, expect, it } from "vitest";

import {
  buildBulkAdjustPreview,
  type BulkAdjustInputRow,
  type BulkAdjustMaterialInfo,
} from "@/lib/materials/bulk-adjust";

function materialsMap(
  entries: [string, BulkAdjustMaterialInfo][]
): Map<string, BulkAdjustMaterialInfo> {
  return new Map(entries);
}

describe("buildBulkAdjustPreview", () => {
  it("빈 배열이면 빈 배열을 반환한다", () => {
    expect(buildBulkAdjustPreview([], new Map())).toEqual([]);
  });

  it("정상 행: 역산 공식대로 새 기초재고를 계산하고 ok 상태를 반환한다", () => {
    const rows: BulkAdjustInputRow[] = [{ mdg_code: "536691", qty: "125" }];
    const materials = materialsMap([
      [
        "536691",
        {
          id: 1,
          material_name: "테스트자재",
          opening_stock: 100,
          in_total: 50,
          out_total: 30,
          current_stock: 120,
        },
      ],
    ]);

    const result = buildBulkAdjustPreview(rows, materials);
    expect(result).toEqual([
      {
        status: "ok",
        mdg_code: "536691",
        material_name: "테스트자재",
        currentStock: 120,
        target: 125,
        prevOpeningStock: 100,
        newOpeningStock: 105, // 125 - 50 + 30
        negativeWarning: false,
      },
    ]);
  });

  it("materials Map에 없는 mdg_code는 not_found", () => {
    const rows: BulkAdjustInputRow[] = [{ mdg_code: "999999", qty: "10" }];
    const result = buildBulkAdjustPreview(rows, new Map());
    expect(result).toEqual([
      { status: "not_found", mdg_code: "999999", qty: "10" },
    ]);
  });

  it("qty가 빈 문자열이면 invalid_qty (사유 포함)", () => {
    const rows: BulkAdjustInputRow[] = [{ mdg_code: "536691", qty: "" }];
    const materials = materialsMap([
      [
        "536691",
        {
          id: 1,
          material_name: "테스트자재",
          opening_stock: 100,
          in_total: 0,
          out_total: 0,
          current_stock: 100,
        },
      ],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("invalid_qty");
    if (result[0].status === "invalid_qty") {
      expect(result[0].reason).toBeTruthy();
    }
  });

  it("qty가 NaN이면 invalid_qty", () => {
    const rows: BulkAdjustInputRow[] = [{ mdg_code: "536691", qty: "abc" }];
    const materials = materialsMap([
      [
        "536691",
        {
          id: 1,
          material_name: "테스트자재",
          opening_stock: 100,
          in_total: 0,
          out_total: 0,
          current_stock: 100,
        },
      ],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result[0].status).toBe("invalid_qty");
  });

  it("qty가 음수면 invalid_qty", () => {
    const rows: BulkAdjustInputRow[] = [{ mdg_code: "536691", qty: "-5" }];
    const materials = materialsMap([
      [
        "536691",
        {
          id: 1,
          material_name: "테스트자재",
          opening_stock: 100,
          in_total: 0,
          out_total: 0,
          current_stock: 100,
        },
      ],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result[0].status).toBe("invalid_qty");
  });

  it("qty가 0이면 유효(ok)하다", () => {
    const rows: BulkAdjustInputRow[] = [{ mdg_code: "536691", qty: "0" }];
    const materials = materialsMap([
      [
        "536691",
        {
          id: 1,
          material_name: "테스트자재",
          opening_stock: 100,
          in_total: 0,
          out_total: 0,
          current_stock: 100,
        },
      ],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result[0].status).toBe("ok");
  });

  it("같은 mdg_code가 파일 안에서 2번 이상 중복되면 전부 duplicate로 표시하고 제외한다", () => {
    const rows: BulkAdjustInputRow[] = [
      { mdg_code: "536691", qty: "10" },
      { mdg_code: "111111", qty: "5" },
      { mdg_code: "536691", qty: "20" },
      { mdg_code: "536691", qty: "30" },
    ];
    const materials = materialsMap([
      [
        "536691",
        {
          id: 1,
          material_name: "테스트자재",
          opening_stock: 100,
          in_total: 0,
          out_total: 0,
          current_stock: 100,
        },
      ],
      [
        "111111",
        {
          id: 2,
          material_name: "다른자재",
          opening_stock: 50,
          in_total: 0,
          out_total: 0,
          current_stock: 50,
        },
      ],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      status: "duplicate",
      mdg_code: "536691",
      qty: "10",
    });
    expect(result[1].status).toBe("ok"); // 111111은 중복 아님
    expect(result[2]).toEqual({
      status: "duplicate",
      mdg_code: "536691",
      qty: "20",
    });
    expect(result[3]).toEqual({
      status: "duplicate",
      mdg_code: "536691",
      qty: "30",
    });
  });

  it("결과가 음수가 되면 negativeWarning=true (막지는 않음)", () => {
    const rows: BulkAdjustInputRow[] = [{ mdg_code: "536691", qty: "5" }];
    const materials = materialsMap([
      [
        "536691",
        {
          id: 1,
          material_name: "테스트자재",
          opening_stock: 100,
          in_total: 100,
          out_total: 0,
          current_stock: 200,
        },
      ],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result[0].status).toBe("ok");
    if (result[0].status === "ok") {
      expect(result[0].newOpeningStock).toBe(-95); // 5 - 100 + 0
      expect(result[0].negativeWarning).toBe(true);
    }
  });

  it("입력 순서를 유지한다", () => {
    const rows: BulkAdjustInputRow[] = [
      { mdg_code: "AAA", qty: "1" },
      { mdg_code: "BBB", qty: "2" },
      { mdg_code: "CCC", qty: "3" },
    ];
    const materials = materialsMap([
      [
        "AAA",
        {
          id: 1,
          material_name: "A",
          opening_stock: 0,
          in_total: 0,
          out_total: 0,
          current_stock: 0,
        },
      ],
      [
        "CCC",
        {
          id: 3,
          material_name: "C",
          opening_stock: 0,
          in_total: 0,
          out_total: 0,
          current_stock: 0,
        },
      ],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result.map((r) => r.mdg_code)).toEqual(["AAA", "BBB", "CCC"]);
    expect(result[0].status).toBe("ok");
    expect(result[1].status).toBe("not_found");
    expect(result[2].status).toBe("ok");
  });

  it("mdg_code 앞뒤 공백은 trim하여 비교한다", () => {
    const rows: BulkAdjustInputRow[] = [{ mdg_code: "  536691  ", qty: "10" }];
    const materials = materialsMap([
      [
        "536691",
        {
          id: 1,
          material_name: "테스트자재",
          opening_stock: 0,
          in_total: 0,
          out_total: 0,
          current_stock: 0,
        },
      ],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result[0].status).toBe("ok");
    expect(result[0].mdg_code).toBe("536691");
  });

  it("opening_stock/in_total/out_total/current_stock이 null이면 0으로 취급한다", () => {
    const rows: BulkAdjustInputRow[] = [{ mdg_code: "536691", qty: "10" }];
    const materials = materialsMap([
      [
        "536691",
        {
          id: 1,
          material_name: null,
          opening_stock: null,
          in_total: null,
          out_total: null,
          current_stock: null,
        },
      ],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result[0]).toEqual({
      status: "ok",
      mdg_code: "536691",
      material_name: null,
      currentStock: 0,
      target: 10,
      prevOpeningStock: 0,
      newOpeningStock: 10,
      negativeWarning: false,
    });
  });
});
