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
        inheritedName: "Lap Joint Flange Ring SS304",
        inheritedSize: "1",
      },
    ]);
  });

  it("완전히 동일한 조합이면 already_registered", () => {
    const existing: BulkNewMaterialInfo[] = [
      {
        id: 1,
        mdg_code: "528191",
        part_no: "38SL-1-304",
        manufacturer: "Steel O'Brien",
        material_name: "Lap Joint Flange Ring SS304",
        size: "1",
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
        size: null,
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
      },
      {
        id: 5,
        mdg_code: "",
        part_no: "SHARED-PART",
        manufacturer: null,
        material_name: "후보A",
        size: null,
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
      },
    ];
    const rows: BulkNewInputRow[] = [
      { mdg_code: "700000", part_no: "", manufacturer: "Any" },
    ];

    const result = buildBulkNewPreview(rows, existing);
    expect(result).toEqual([
      {
        status: "new",
        mdg_code: "700000",
        part_no: "",
        manufacturer: "Any",
        inheritedName: null,
        inheritedSize: null,
      },
    ]);
  });

  it("입력 순서를 유지한다", () => {
    const rows: BulkNewInputRow[] = [
      { mdg_code: "", part_no: "P1", manufacturer: "M1" },
      { mdg_code: "AAA", part_no: "P2", manufacturer: "M2" },
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
      },
      {
        id: 2,
        mdg_code: "528191",
        part_no: "OLD-2",
        manufacturer: "M2",
        material_name: "두번째 이름",
        size: "2",
      },
    ];
    const rows: BulkNewInputRow[] = [
      { mdg_code: "528191", part_no: "NEW-PART", manufacturer: "M3" },
    ];

    const result = buildBulkNewPreview(rows, existing);
    expect(result[0].status).toBe("new");
    if (result[0].status === "new") {
      expect(result[0].inheritedName).toBe("두번째 이름");
      expect(result[0].inheritedSize).toBe("2");
    }
  });

  it("상속할 기존 행이 없으면 inheritedName/inheritedSize는 null", () => {
    const rows: BulkNewInputRow[] = [
      { mdg_code: "NEWCODE", part_no: "P1", manufacturer: "M1" },
    ];
    const result = buildBulkNewPreview(rows, []);
    expect(result).toEqual([
      {
        status: "new",
        mdg_code: "NEWCODE",
        part_no: "P1",
        manufacturer: "M1",
        inheritedName: null,
        inheritedSize: null,
      },
    ]);
  });

  it("값 앞뒤 공백은 trim하여 출력한다", () => {
    const rows: BulkNewInputRow[] = [
      { mdg_code: "  NEWCODE  ", part_no: "  P1  ", manufacturer: "  M1  " },
    ];
    const result = buildBulkNewPreview(rows, []);
    expect(result[0]).toEqual({
      status: "new",
      mdg_code: "NEWCODE",
      part_no: "P1",
      manufacturer: "M1",
      inheritedName: null,
      inheritedSize: null,
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
    expect(summary.already_registered).toBe(0);
  });
});
