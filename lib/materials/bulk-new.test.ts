import { describe, expect, it } from "vitest";

import {
  buildBulkNewPreview,
  summarizeBulkNewPreview,
  type BulkNewMaterialInfo,
} from "@/lib/materials/bulk-new";
import type { BulkNewInputRow } from "@/lib/materials/parse-bulk-new-file";

describe("buildBulkNewPreview", () => {
  it("빈 배열이면 빈 배열을 반환한다", () => {
    expect(buildBulkNewPreview([], [])).toEqual([]);
  });

  it("기존 행의 빈 MDG코드를 채운다 (fill_existing)", () => {
    const existing: BulkNewMaterialInfo[] = [
      {
        id: 1457,
        mdg_code: null,
        part_no: "CNES591/4x1x50T",
        manufacturer: null,
        material_name: "Foam Strip",
        size: null,
        unit: null,
      },
    ];
    const rows: BulkNewInputRow[] = [
      {
        mdg_code: "615131",
        part_no: "CNES591/4x1x50T",
        manufacturer: "ASC Engineering Solution",
      },
    ];

    const result = buildBulkNewPreview(rows, existing);
    expect(result).toEqual([
      {
        status: "fill_existing",
        mdg_code: "615131",
        part_no: "CNES591/4x1x50T",
        manufacturer: "ASC Engineering Solution",
        targetId: 1457,
        targetName: "Foam Strip",
      },
    ]);
  });

  it("같은 MDG·같은 제조사·다른 Part No는 new로 판정하고 이름/규격을 상속한다 (528191 사례)", () => {
    const existing: BulkNewMaterialInfo[] = [
      {
        id: 1,
        mdg_code: "528191",
        part_no: "38SL-1-304",
        manufacturer: "Steel O'Brien",
        material_name: "Lap Joint Flange Ring SS304",
        size: "1",
        unit: null,
      },
    ];
    const rows: BulkNewInputRow[] = [
      { mdg_code: "528191", part_no: "38SL-2-304", manufacturer: "Steel O'Brien" },
    ];

    const result = buildBulkNewPreview(rows, existing);
    expect(result).toEqual([
      {
        status: "new",
        mdg_code: "528191",
        part_no: "38SL-2-304",
        manufacturer: "Steel O'Brien",
        resolvedName: "Lap Joint Flange Ring SS304",
        resolvedSize: "1",
        resolvedUnit: null,
      },
    ]);
  });

  it("완전히 동일한 조합이고 규격·단위가 이미 채워져 있으면 already_registered", () => {
    const existing: BulkNewMaterialInfo[] = [
      {
        id: 1,
        mdg_code: "528191",
        part_no: "38SL-1-304",
        manufacturer: "Steel O'Brien",
        material_name: "Lap Joint Flange Ring SS304",
        size: "1",
        unit: "EA",
      },
    ];
    const rows: BulkNewInputRow[] = [
      { mdg_code: "528191", part_no: "38SL-1-304", manufacturer: "Steel O'Brien" },
    ];

    const result = buildBulkNewPreview(rows, existing);
    expect(result).toEqual([
      {
        status: "already_registered",
        mdg_code: "528191",
        part_no: "38SL-1-304",
        manufacturer: "Steel O'Brien",
        existingId: 1,
      },
    ]);
  });

  it("제조사가 null(기존)과 빈 문자열(업로드)이면 같은 것으로 취급한다", () => {
    const existing: BulkNewMaterialInfo[] = [
      {
        id: 9,
        mdg_code: "603351",
        part_no: "NF5037C000",
        manufacturer: null,
        material_name: "테스트자재",
        size: "규격A",
        unit: "EA",
      },
    ];
    const rows: BulkNewInputRow[] = [
      { mdg_code: "603351", part_no: "NF5037C000", manufacturer: "" },
    ];

    const result = buildBulkNewPreview(rows, existing);
    expect(result[0].status).toBe("already_registered");
    if (result[0].status === "already_registered") {
      expect(result[0].existingId).toBe(9);
    }
  });

  it("대소문자를 무시하고 비교한다 (part_no 대소문자 달라도 fill_existing)", () => {
    const existing: BulkNewMaterialInfo[] = [
      {
        id: 1457,
        mdg_code: null,
        part_no: "CNES591/4x1x50T",
        manufacturer: null,
        material_name: "Foam Strip",
        size: null,
        unit: null,
      },
    ];
    const rows: BulkNewInputRow[] = [
      {
        mdg_code: "615131",
        part_no: "cnes591/4x1x50t",
        manufacturer: "ASC Engineering Solution",
      },
    ];

    const result = buildBulkNewPreview(rows, existing);
    expect(result[0].status).toBe("fill_existing");
    if (result[0].status === "fill_existing") {
      expect(result[0].targetId).toBe(1457);
    }
  });

  it("파일 안에서 같은 조합이 2번 등장하면 두 행 모두 duplicate_in_file", () => {
    const rows: BulkNewInputRow[] = [
      { mdg_code: "111111", part_no: "P1", manufacturer: "M1" },
      { mdg_code: "111111", part_no: "P1", manufacturer: "M1" },
    ];

    const result = buildBulkNewPreview(rows, []);
    expect(result).toEqual([
      {
        status: "duplicate_in_file",
        mdg_code: "111111",
        part_no: "P1",
        manufacturer: "M1",
      },
      {
        status: "duplicate_in_file",
        mdg_code: "111111",
        part_no: "P1",
        manufacturer: "M1",
      },
    ]);
  });

  it("mdg_code가 빈 기존 행이 같은 part_no로 2건이면 fill_ambiguous (candidateIds 오름차순)", () => {
    const existing: BulkNewMaterialInfo[] = [
      {
        id: 20,
        mdg_code: null,
        part_no: "SHARED-PART",
        manufacturer: null,
        material_name: "후보B",
        size: null,
        unit: null,
      },
      {
        id: 5,
        mdg_code: "",
        part_no: "SHARED-PART",
        manufacturer: null,
        material_name: "후보A",
        size: null,
        unit: null,
      },
    ];
    const rows: BulkNewInputRow[] = [
      { mdg_code: "999000", part_no: "SHARED-PART", manufacturer: "Any" },
    ];

    const result = buildBulkNewPreview(rows, existing);
    expect(result).toEqual([
      {
        status: "fill_ambiguous",
        mdg_code: "999000",
        part_no: "SHARED-PART",
        manufacturer: "Any",
        candidateIds: [5, 20],
      },
    ]);
  });

  it("mdg_code가 빈 문자열이면 invalid", () => {
    const rows: BulkNewInputRow[] = [
      { mdg_code: "", part_no: "P1", manufacturer: "M1" },
    ];

    const result = buildBulkNewPreview(rows, []);
    expect(result).toEqual([
      {
        status: "invalid",
        mdg_code: "",
        part_no: "P1",
        manufacturer: "M1",
        reason: "MDG코드가 비어 있습니다.",
      },
    ]);
  });

  it("duplicate_in_file이 already_registered보다 먼저 적용된다", () => {
    const existing: BulkNewMaterialInfo[] = [
      {
        id: 1,
        mdg_code: "528191",
        part_no: "38SL-1-304",
        manufacturer: "Steel O'Brien",
        material_name: "Lap Joint Flange Ring SS304",
        size: "1",
        unit: "EA",
      },
    ];
    const rows: BulkNewInputRow[] = [
      { mdg_code: "528191", part_no: "38SL-1-304", manufacturer: "Steel O'Brien" },
      { mdg_code: "528191", part_no: "38SL-1-304", manufacturer: "Steel O'Brien" },
    ];

    const result = buildBulkNewPreview(rows, existing);
    expect(result[0].status).toBe("duplicate_in_file");
    expect(result[1].status).toBe("duplicate_in_file");
  });

  it("업로드 행의 part_no가 비어 있으면 fill 판정을 건너뛰고 new가 된다", () => {
    const existing: BulkNewMaterialInfo[] = [
      {
        id: 1457,
        mdg_code: null,
        part_no: "",
        manufacturer: null,
        material_name: "Foam Strip",
        size: null,
        unit: null,
      },
    ];
    const rows: BulkNewInputRow[] = [
      {
        mdg_code: "700000",
        part_no: "",
        manufacturer: "Any",
        material_name: "새 자재",
      },
    ];

    const result = buildBulkNewPreview(rows, existing);
    expect(result).toEqual([
      {
        status: "new",
        mdg_code: "700000",
        part_no: "",
        manufacturer: "Any",
        resolvedName: "새 자재",
        resolvedSize: null,
        resolvedUnit: null,
      },
    ]);
  });

  it("입력 순서를 유지한다", () => {
    const rows: BulkNewInputRow[] = [
      { mdg_code: "", part_no: "P1", manufacturer: "M1" },
      { mdg_code: "AAA", part_no: "P2", manufacturer: "M2", material_name: "이름" },
    ];
    const result = buildBulkNewPreview(rows, []);
    expect(result.map((r) => r.status)).toEqual(["invalid", "new"]);
  });

  it("new 판정 시 mdg_code가 같은 기존 행 중 material_name이 null이 아닌 첫 번째 행에서 상속한다", () => {
    const existing: BulkNewMaterialInfo[] = [
      {
        id: 1,
        mdg_code: "528191",
        part_no: "OLD-1",
        manufacturer: "M1",
        material_name: null,
        size: null,
        unit: null,
      },
      {
        id: 2,
        mdg_code: "528191",
        part_no: "OLD-2",
        manufacturer: "M2",
        material_name: "두번째 이름",
        size: "2",
        unit: "EA",
      },
    ];
    const rows: BulkNewInputRow[] = [
      { mdg_code: "528191", part_no: "NEW-PART", manufacturer: "M3" },
    ];

    const result = buildBulkNewPreview(rows, existing);
    expect(result[0].status).toBe("new");
    if (result[0].status === "new") {
      expect(result[0].resolvedName).toBe("두번째 이름");
      expect(result[0].resolvedSize).toBe("2");
      expect(result[0].resolvedUnit).toBe("EA");
    }
  });

  it("상속할 기존 행이 없고 파일에 자재명이 있으면 그 값을 쓰고, 규격은 null이 된다", () => {
    const rows: BulkNewInputRow[] = [
      {
        mdg_code: "NEWCODE",
        part_no: "P1",
        manufacturer: "M1",
        material_name: "새 자재명",
      },
    ];
    const result = buildBulkNewPreview(rows, []);
    expect(result).toEqual([
      {
        status: "new",
        mdg_code: "NEWCODE",
        part_no: "P1",
        manufacturer: "M1",
        resolvedName: "새 자재명",
        resolvedSize: null,
        resolvedUnit: null,
      },
    ]);
  });

  it("값 앞뒤 공백은 trim하여 출력한다(자재명 포함)", () => {
    const rows: BulkNewInputRow[] = [
      {
        mdg_code: "  NEWCODE  ",
        part_no: "  P1  ",
        manufacturer: "  M1  ",
        material_name: "  트림자재명  ",
        size: "  10mm  ",
        unit: "  EA  ",
      },
    ];
    const result = buildBulkNewPreview(rows, []);
    expect(result[0]).toEqual({
      status: "new",
      mdg_code: "NEWCODE",
      part_no: "P1",
      manufacturer: "M1",
      resolvedName: "트림자재명",
      resolvedSize: "10mm",
      resolvedUnit: "EA",
    });
  });

  it("파일에 자재명이 있으면 그 값이 resolvedName이 된다", () => {
    const rows: BulkNewInputRow[] = [
      {
        mdg_code: "AAA111",
        part_no: "P1",
        manufacturer: "M1",
        material_name: "파일 자재명",
        size: "규격A",
      },
    ];
    const result = buildBulkNewPreview(rows, []);
    expect(result[0].status).toBe("new");
    if (result[0].status === "new") {
      expect(result[0].resolvedName).toBe("파일 자재명");
      expect(result[0].resolvedSize).toBe("규격A");
    }
  });

  it("파일에 자재명이 없고 같은 MDG코드 기존 행이 있으면 상속된다", () => {
    const existing: BulkNewMaterialInfo[] = [
      {
        id: 3,
        mdg_code: "BBB222",
        part_no: "OLD-3",
        manufacturer: "M9",
        material_name: "상속될 이름",
        size: "상속될 규격",
        unit: "상속될 단위",
      },
    ];
    const rows: BulkNewInputRow[] = [
      { mdg_code: "BBB222", part_no: "NEW-3", manufacturer: "M9" },
    ];
    const result = buildBulkNewPreview(rows, existing);
    expect(result[0].status).toBe("new");
    if (result[0].status === "new") {
      expect(result[0].resolvedName).toBe("상속될 이름");
      expect(result[0].resolvedSize).toBe("상속될 규격");
      expect(result[0].resolvedUnit).toBe("상속될 단위");
    }
  });

  it("자재명이 파일에도 없고 상속할 기존 행도 없으면 invalid (자재명 관련 사유)", () => {
    const rows: BulkNewInputRow[] = [
      { mdg_code: "CCC333", part_no: "P1", manufacturer: "M1" },
    ];
    const result = buildBulkNewPreview(rows, []);
    expect(result).toEqual([
      {
        status: "invalid",
        mdg_code: "CCC333",
        part_no: "P1",
        manufacturer: "M1",
        reason:
          "자재명이 없습니다. 엑셀에 자재명 열을 넣거나, 같은 MDG코드로 등록된 기존 자재가 있어야 합니다.",
      },
    ]);
  });

  it("파일 자재명이 기존 상속값보다 우선한다", () => {
    const existing: BulkNewMaterialInfo[] = [
      {
        id: 4,
        mdg_code: "DDD444",
        part_no: "OLD-4",
        manufacturer: "M8",
        material_name: "기존 이름(상속 후보)",
        size: "기존 규격",
        unit: "기존 단위",
      },
    ];
    const rows: BulkNewInputRow[] = [
      {
        mdg_code: "DDD444",
        part_no: "NEW-4",
        manufacturer: "M8",
        material_name: "파일 우선 이름",
        size: "파일 우선 규격",
        unit: "파일 우선 단위",
      },
    ];
    const result = buildBulkNewPreview(rows, existing);
    expect(result[0].status).toBe("new");
    if (result[0].status === "new") {
      expect(result[0].resolvedName).toBe("파일 우선 이름");
      expect(result[0].resolvedSize).toBe("파일 우선 규격");
      expect(result[0].resolvedUnit).toBe("파일 우선 단위");
    }
  });

  it("자재명이 없어도 already_registered가 먼저 걸리면 invalid가 아니라 already_registered", () => {
    const existing: BulkNewMaterialInfo[] = [
      {
        id: 7,
        mdg_code: "EEE555",
        part_no: "P1",
        manufacturer: "M1",
        material_name: "이미 등록된 이름",
        size: "규격",
        unit: "EA",
      },
    ];
    const rows: BulkNewInputRow[] = [
      { mdg_code: "EEE555", part_no: "P1", manufacturer: "M1" },
    ];
    const result = buildBulkNewPreview(rows, existing);
    expect(result[0].status).toBe("already_registered");
  });

  it("자재명이 없어도 duplicate_in_file이 먼저 걸리면 invalid가 아니라 duplicate_in_file", () => {
    const rows: BulkNewInputRow[] = [
      { mdg_code: "FFF666", part_no: "P1", manufacturer: "M1" },
      { mdg_code: "FFF666", part_no: "P1", manufacturer: "M1" },
    ];
    const result = buildBulkNewPreview(rows, []);
    expect(result[0].status).toBe("duplicate_in_file");
    expect(result[1].status).toBe("duplicate_in_file");
  });

  // --- fill_spec: 빈 규격·단위만 채우고 기존 값은 절대 덮어쓰지 않는다 ---

  describe("fill_spec (기존 조합 매칭 시 빈 규격·단위 채우기)", () => {
    it("기존 규격·단위가 둘 다 비어 있고 파일에 둘 다 있으면 fill_spec으로 둘 다 채운다", () => {
      const existing: BulkNewMaterialInfo[] = [
        {
          id: 100,
          mdg_code: "AAA000",
          part_no: "P1",
          manufacturer: "M1",
          material_name: "자재A",
          size: null,
          unit: null,
        },
      ];
      const rows: BulkNewInputRow[] = [
        {
          mdg_code: "AAA000",
          part_no: "P1",
          manufacturer: "M1",
          size: "10mm",
          unit: "EA",
        },
      ];
      const result = buildBulkNewPreview(rows, existing);
      expect(result).toEqual([
        {
          status: "fill_spec",
          mdg_code: "AAA000",
          part_no: "P1",
          manufacturer: "M1",
          targetId: 100,
          materialName: "자재A",
          prevSize: null,
          newSize: "10mm",
          prevUnit: null,
          newUnit: "EA",
        },
      ]);
    });

    it("기존 규격만 비어 있고 단위는 이미 있으면 규격만 채우고 단위는 건드리지 않는다", () => {
      const existing: BulkNewMaterialInfo[] = [
        {
          id: 101,
          mdg_code: "AAA001",
          part_no: "P1",
          manufacturer: "M1",
          material_name: "자재B",
          size: null,
          unit: "EA",
        },
      ];
      const rows: BulkNewInputRow[] = [
        {
          mdg_code: "AAA001",
          part_no: "P1",
          manufacturer: "M1",
          size: "10mm",
          unit: "BOX",
        },
      ];
      const result = buildBulkNewPreview(rows, existing);
      expect(result).toEqual([
        {
          status: "fill_spec",
          mdg_code: "AAA001",
          part_no: "P1",
          manufacturer: "M1",
          targetId: 101,
          materialName: "자재B",
          prevSize: null,
          newSize: "10mm",
          prevUnit: "EA",
          newUnit: null,
        },
      ]);
    });

    it("기존 규격·단위가 이미 채워져 있으면 파일 값과 달라도 절대 덮어쓰지 않고 already_registered", () => {
      const existing: BulkNewMaterialInfo[] = [
        {
          id: 102,
          mdg_code: "AAA002",
          part_no: "P1",
          manufacturer: "M1",
          material_name: "자재C",
          size: "기존규격",
          unit: "기존단위",
        },
      ];
      const rows: BulkNewInputRow[] = [
        {
          mdg_code: "AAA002",
          part_no: "P1",
          manufacturer: "M1",
          size: "다른규격",
          unit: "다른단위",
        },
      ];
      const result = buildBulkNewPreview(rows, existing);
      expect(result).toEqual([
        {
          status: "already_registered",
          mdg_code: "AAA002",
          part_no: "P1",
          manufacturer: "M1",
          existingId: 102,
        },
      ]);
    });

    it("기존 규격·단위가 비어 있어도 파일에도 값이 없으면 already_registered", () => {
      const existing: BulkNewMaterialInfo[] = [
        {
          id: 103,
          mdg_code: "AAA003",
          part_no: "P1",
          manufacturer: "M1",
          material_name: "자재D",
          size: null,
          unit: null,
        },
      ];
      const rows: BulkNewInputRow[] = [
        { mdg_code: "AAA003", part_no: "P1", manufacturer: "M1" },
      ];
      const result = buildBulkNewPreview(rows, existing);
      expect(result).toEqual([
        {
          status: "already_registered",
          mdg_code: "AAA003",
          part_no: "P1",
          manufacturer: "M1",
          existingId: 103,
        },
      ]);
    });

    it("기존 규격이 빈 문자열(공백)이어도 비어있는 것으로 취급해 채운다", () => {
      const existing: BulkNewMaterialInfo[] = [
        {
          id: 104,
          mdg_code: "AAA004",
          part_no: "P1",
          manufacturer: "M1",
          material_name: "자재E",
          size: "   ",
          unit: "",
        },
      ];
      const rows: BulkNewInputRow[] = [
        {
          mdg_code: "AAA004",
          part_no: "P1",
          manufacturer: "M1",
          size: "새규격",
          unit: "새단위",
        },
      ];
      const result = buildBulkNewPreview(rows, existing);
      expect(result[0].status).toBe("fill_spec");
      if (result[0].status === "fill_spec") {
        expect(result[0].newSize).toBe("새규격");
        expect(result[0].newUnit).toBe("새단위");
      }
    });

    it("파일 규격·단위 값도 trim하여 채운다", () => {
      const existing: BulkNewMaterialInfo[] = [
        {
          id: 105,
          mdg_code: "AAA005",
          part_no: "P1",
          manufacturer: "M1",
          material_name: "자재F",
          size: null,
          unit: null,
        },
      ];
      const rows: BulkNewInputRow[] = [
        {
          mdg_code: "AAA005",
          part_no: "P1",
          manufacturer: "M1",
          size: "  10mm  ",
          unit: "  EA  ",
        },
      ];
      const result = buildBulkNewPreview(rows, existing);
      expect(result[0].status).toBe("fill_spec");
      if (result[0].status === "fill_spec") {
        expect(result[0].newSize).toBe("10mm");
        expect(result[0].newUnit).toBe("EA");
      }
    });
  });
});

describe("summarizeBulkNewPreview", () => {
  it("모든 status 키를 0을 포함해 반환한다", () => {
    const summary = summarizeBulkNewPreview([]);
    expect(summary).toEqual({
      new: 0,
      fill_existing: 0,
      fill_ambiguous: 0,
      fill_spec: 0,
      already_registered: 0,
      duplicate_in_file: 0,
      invalid: 0,
    });
  });

  it("각 status의 개수를 집계한다", () => {
    const rows = buildBulkNewPreview(
      [
        { mdg_code: "", part_no: "P1", manufacturer: "M1" },
        { mdg_code: "AAA", part_no: "P2", manufacturer: "M2" },
        { mdg_code: "AAA", part_no: "P2", manufacturer: "M2" },
      ],
      []
    );
    const summary = summarizeBulkNewPreview(rows);
    expect(summary.invalid).toBe(1);
    expect(summary.duplicate_in_file).toBe(2);
    expect(summary.new).toBe(0);
    expect(summary.fill_existing).toBe(0);
    expect(summary.fill_ambiguous).toBe(0);
    expect(summary.fill_spec).toBe(0);
    expect(summary.already_registered).toBe(0);
  });

  it("fill_spec 건수를 집계한다", () => {
    const existing: BulkNewMaterialInfo[] = [
      {
        id: 200,
        mdg_code: "ZZZ000",
        part_no: "P1",
        manufacturer: "M1",
        material_name: "자재Z",
        size: null,
        unit: null,
      },
    ];
    const rows = buildBulkNewPreview(
      [{ mdg_code: "ZZZ000", part_no: "P1", manufacturer: "M1", size: "10mm" }],
      existing
    );
    const summary = summarizeBulkNewPreview(rows);
    expect(summary.fill_spec).toBe(1);
  });
});
