import { describe, expect, it } from "vitest";

import { parseBulk } from "@/lib/consigned-reqs/parse-bulk";

describe("parseBulk", () => {
  it("탭 구분 3열(MDG코드·수량·B/L NO)을 파싱한다", () => {
    const result = parseBulk("536691\t10\tBL-2026-001");
    expect(result).toEqual([
      { mdg_code: "536691", qty: "10", bl_no: "BL-2026-001" },
    ]);
  });

  it("탭 구분 2열만 있으면 bl_no는 빈 문자열이다", () => {
    const result = parseBulk("536691\t10");
    expect(result).toEqual([{ mdg_code: "536691", qty: "10", bl_no: "" }]);
  });

  it("공백이 포함된 B/L NO도 탭 구분이면 그대로 보존한다", () => {
    const result = parseBulk("536691\t10\tBL 2026 001");
    expect(result).toEqual([
      { mdg_code: "536691", qty: "10", bl_no: "BL 2026 001" },
    ]);
  });

  it("탭이 없는 줄은 공백/쉼표로 분리한다 (기존 동작 유지)", () => {
    const result = parseBulk("536691 10");
    expect(result).toEqual([{ mdg_code: "536691", qty: "10", bl_no: "" }]);
  });

  it("탭이 없는 줄에서 쉼표 구분도 지원한다", () => {
    const result = parseBulk("536691,10");
    expect(result).toEqual([{ mdg_code: "536691", qty: "10", bl_no: "" }]);
  });

  it("여러 줄을 각각 파싱한다", () => {
    const result = parseBulk("536691\t10\tBL-001\n537161\t5\tBL-002");
    expect(result).toEqual([
      { mdg_code: "536691", qty: "10", bl_no: "BL-001" },
      { mdg_code: "537161", qty: "5", bl_no: "BL-002" },
    ]);
  });

  it("빈 줄은 건너뛴다", () => {
    const result = parseBulk("536691\t10\tBL-001\n\n\n537161\t5\tBL-002");
    expect(result).toHaveLength(2);
  });

  it("mdg_code가 없는 줄은 결과에서 제외된다", () => {
    const result = parseBulk("\t10\tBL-001");
    expect(result).toEqual([]);
  });

  it("각 열의 앞뒤 공백을 trim한다", () => {
    const result = parseBulk("  536691 \t 10 \t BL-001  ");
    expect(result).toEqual([
      { mdg_code: "536691", qty: "10", bl_no: "BL-001" },
    ]);
  });

  it("빈 문자열 입력이면 빈 배열을 반환한다", () => {
    expect(parseBulk("")).toEqual([]);
  });

  it("qty가 없는 줄도 처리된다 (빈 문자열)", () => {
    const result = parseBulk("536691");
    expect(result).toEqual([{ mdg_code: "536691", qty: "", bl_no: "" }]);
  });
});
