import { describe, expect, it } from "vitest";

import {
  buildBulkAdjustPreview,
  type BulkAdjustInputRow,
  type BulkAdjustMaterialInfo,
} from "@/lib/materials/bulk-adjust";

function materialsMap(
  entries: [string, BulkAdjustMaterialInfo[]][]
): Map<string, BulkAdjustMaterialInfo[]> {
  return new Map(entries);
}

function material(
  overrides: Partial<BulkAdjustMaterialInfo> & { id: number }
): BulkAdjustMaterialInfo {
  return {
    material_name: "테스트자재",
    part_no: null,
    manufacturer: null,
    opening_stock: 100,
    in_total: 0,
    out_total: 0,
    current_stock: 100,
    ...overrides,
  };
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
        [
          material({
            id: 1,
            material_name: "테스트자재",
            opening_stock: 100,
            in_total: 50,
            out_total: 30,
            current_stock: 120,
          }),
        ],
      ],
    ]);

    const result = buildBulkAdjustPreview(rows, materials);
    expect(result).toEqual([
      {
        status: "ok",
        mdg_code: "536691",
        id: 1,
        material_name: "테스트자재",
        part_no: null,
        manufacturer: null,
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
      ["536691", [material({ id: 1 })]],
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
      ["536691", [material({ id: 1 })]],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result[0].status).toBe("invalid_qty");
  });

  it("qty가 음수면 invalid_qty", () => {
    const rows: BulkAdjustInputRow[] = [{ mdg_code: "536691", qty: "-5" }];
    const materials = materialsMap([
      ["536691", [material({ id: 1 })]],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result[0].status).toBe("invalid_qty");
  });

  it("qty가 0이면 유효(ok)하다", () => {
    const rows: BulkAdjustInputRow[] = [{ mdg_code: "536691", qty: "0" }];
    const materials = materialsMap([
      ["536691", [material({ id: 1 })]],
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
      ["536691", [material({ id: 1 })]],
      ["111111", [material({ id: 2, material_name: "다른자재", opening_stock: 50, current_stock: 50 })]],
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
        [
          material({
            id: 1,
            opening_stock: 100,
            in_total: 100,
            out_total: 0,
            current_stock: 200,
          }),
        ],
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
      ["AAA", [material({ id: 1, material_name: "A", opening_stock: 0, current_stock: 0 })]],
      ["CCC", [material({ id: 3, material_name: "C", opening_stock: 0, current_stock: 0 })]],
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
      ["536691", [material({ id: 1, opening_stock: 0, current_stock: 0 })]],
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
        [
          material({
            id: 1,
            material_name: null,
            opening_stock: null,
            in_total: null,
            out_total: null,
            current_stock: null,
          }),
        ],
      ],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result[0]).toEqual({
      status: "ok",
      mdg_code: "536691",
      id: 1,
      material_name: null,
      part_no: null,
      manufacturer: null,
      currentStock: 0,
      target: 10,
      prevOpeningStock: 0,
      newOpeningStock: 10,
      negativeWarning: false,
    });
  });

  // --- Part No 기반 모호성 해소 ---

  it("같은 mdg_code에 후보가 2건이고 part_no가 없으면 ambiguous, candidates는 id 오름차순", () => {
    const rows: BulkAdjustInputRow[] = [{ mdg_code: "536691", qty: "10" }];
    const materials = materialsMap([
      [
        "536691",
        [
          material({ id: 5, part_no: "P-B", manufacturer: "제조사B" }),
          material({ id: 2, part_no: "P-A", manufacturer: "제조사A" }),
        ],
      ],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result[0].status).toBe("ambiguous");
    if (result[0].status === "ambiguous") {
      expect(result[0].candidates.map((c) => c.id)).toEqual([2, 5]);
      expect(result[0].candidates[0].part_no).toBe("P-A");
    }
  });

  it("후보 2건이어도 part_no를 주면 정확히 1건으로 좁혀져 ok가 된다", () => {
    const rows: BulkAdjustInputRow[] = [
      { mdg_code: "536691", qty: "10", part_no: "P-B" },
    ];
    const materials = materialsMap([
      [
        "536691",
        [
          material({ id: 2, part_no: "P-A", opening_stock: 10, current_stock: 10 }),
          material({ id: 5, part_no: "P-B", opening_stock: 20, current_stock: 20 }),
        ],
      ],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result[0].status).toBe("ok");
    if (result[0].status === "ok") {
      expect(result[0].id).toBe(5);
      expect(result[0].part_no).toBe("P-B");
      expect(result[0].prevOpeningStock).toBe(20);
    }
  });

  it("part_no는 대소문자를 무시하고 매칭한다", () => {
    const rows: BulkAdjustInputRow[] = [
      { mdg_code: "536691", qty: "10", part_no: "p-b" },
    ];
    const materials = materialsMap([
      [
        "536691",
        [
          material({ id: 2, part_no: "P-A" }),
          material({ id: 5, part_no: "P-B" }),
        ],
      ],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result[0].status).toBe("ok");
    if (result[0].status === "ok") {
      expect(result[0].id).toBe(5);
    }
  });

  it("part_no를 줬는데 일치하는 후보가 없으면 not_found", () => {
    const rows: BulkAdjustInputRow[] = [
      { mdg_code: "536691", qty: "10", part_no: "P-Z" },
    ];
    const materials = materialsMap([
      [
        "536691",
        [
          material({ id: 2, part_no: "P-A" }),
          material({ id: 5, part_no: "P-B" }),
        ],
      ],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result[0]).toEqual({
      status: "not_found",
      mdg_code: "536691",
      qty: "10",
    });
  });

  it("파일 내 같은 mdg_code라도 part_no가 다르면 duplicate가 아니다", () => {
    const rows: BulkAdjustInputRow[] = [
      { mdg_code: "536691", qty: "10", part_no: "P-A" },
      { mdg_code: "536691", qty: "20", part_no: "P-B" },
    ];
    const materials = materialsMap([
      [
        "536691",
        [
          material({ id: 2, part_no: "P-A", opening_stock: 1, current_stock: 1 }),
          material({ id: 5, part_no: "P-B", opening_stock: 2, current_stock: 2 }),
        ],
      ],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result[0].status).toBe("ok");
    expect(result[1].status).toBe("ok");
    if (result[0].status === "ok" && result[1].status === "ok") {
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(5);
    }
  });

  it("파일 내 같은 mdg_code + 같은 part_no 두 줄이면 duplicate", () => {
    const rows: BulkAdjustInputRow[] = [
      { mdg_code: "536691", qty: "10", part_no: "P-A" },
      { mdg_code: "536691", qty: "20", part_no: "P-A" },
    ];
    const materials = materialsMap([
      ["536691", [material({ id: 2, part_no: "P-A" })]],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result[0]).toEqual({
      status: "duplicate",
      mdg_code: "536691",
      qty: "10",
    });
    expect(result[1]).toEqual({
      status: "duplicate",
      mdg_code: "536691",
      qty: "20",
    });
  });

  it("후보가 6건이면 candidates는 5건만 담긴다", () => {
    const rows: BulkAdjustInputRow[] = [{ mdg_code: "536691", qty: "10" }];
    const materials = materialsMap([
      [
        "536691",
        [1, 2, 3, 4, 5, 6].map((id) =>
          material({ id, part_no: `P-${id}` })
        ),
      ],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    expect(result[0].status).toBe("ambiguous");
    if (result[0].status === "ambiguous") {
      expect(result[0].candidates).toHaveLength(5);
      expect(result[0].candidates.map((c) => c.id)).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it("조합 키 구분자가 없으면 충돌할 수 있는 mdg/part 조합도 서로 다른 조합으로 취급한다", () => {
    const rows: BulkAdjustInputRow[] = [
      { mdg_code: "A", qty: "10", part_no: "X Y" },
      { mdg_code: "A", qty: "20", part_no: "X" },
    ];
    const materials = materialsMap([
      [
        "A",
        [
          material({ id: 1, part_no: "X Y", opening_stock: 1, current_stock: 1 }),
          material({ id: 2, part_no: "X", opening_stock: 2, current_stock: 2 }),
        ],
      ],
    ]);
    const result = buildBulkAdjustPreview(rows, materials);
    // 서로 다른 조합이므로 duplicate가 아니라 각각 part_no로 좁혀져 ok가 되어야 한다.
    expect(result[0].status).toBe("ok");
    expect(result[1].status).toBe("ok");
    if (result[0].status === "ok" && result[1].status === "ok") {
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    }
  });
});
