import { describe, expect, it } from "vitest";

import {
  validateBlNoUpdate,
  validateConsignedReqHeader,
  validateConsignedReqLines,
} from "@/lib/consigned-reqs/validate";

const validHeader = {
  sg_no: "SG-2026-0001",
  request_date: "2026-07-24",
};

const validLines = [
  { mdg_code: "536691", qty: "10" },
  { mdg_code: "537161", qty: "5" },
];

describe("validateConsignedReqHeader", () => {
  it("정상 입력이면 null을 반환한다", () => {
    expect(validateConsignedReqHeader(validHeader)).toBeNull();
  });

  it("사급청구번호(sg_no)가 없으면 에러를 반환한다", () => {
    const result = validateConsignedReqHeader({ ...validHeader, sg_no: "" });
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("사급청구번호가 공백뿐이면 에러를 반환한다", () => {
    const result = validateConsignedReqHeader({
      ...validHeader,
      sg_no: "   ",
    });
    expect(result).not.toBeNull();
  });

  it("요청일(request_date)이 없으면 에러를 반환한다", () => {
    const result = validateConsignedReqHeader({
      ...validHeader,
      request_date: "",
    });
    expect(result).not.toBeNull();
  });
});

describe("validateConsignedReqLines", () => {
  it("정상 입력이면 null을 반환한다", () => {
    expect(validateConsignedReqLines(validLines)).toBeNull();
  });

  it("빈 배열이면 에러를 반환한다", () => {
    const result = validateConsignedReqLines([]);
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("어떤 줄의 MDG코드가 없으면 에러를 반환한다", () => {
    const result = validateConsignedReqLines([
      { mdg_code: "", qty: "10" },
    ]);
    expect(result).not.toBeNull();
  });

  it("어떤 줄의 수량이 없으면 에러를 반환하고 해당 MDG코드를 포함한다", () => {
    const result = validateConsignedReqLines([
      { mdg_code: "536691", qty: "" },
    ]);
    expect(result).not.toBeNull();
    expect(result).toContain("536691");
  });

  it("어떤 줄의 수량이 숫자가 아니면 에러를 반환하고 해당 MDG코드를 포함한다", () => {
    const result = validateConsignedReqLines([
      { mdg_code: "536691", qty: "abc" },
    ]);
    expect(result).not.toBeNull();
    expect(result).toContain("536691");
  });

  it("어떤 줄의 수량이 0이면 에러를 반환한다", () => {
    const result = validateConsignedReqLines([
      { mdg_code: "536691", qty: "0" },
    ]);
    expect(result).not.toBeNull();
  });

  it("어떤 줄의 수량이 음수이면 에러를 반환한다", () => {
    const result = validateConsignedReqLines([
      { mdg_code: "536691", qty: "-5" },
    ]);
    expect(result).not.toBeNull();
  });

  it("어떤 줄의 수량이 NaN이면 에러를 반환한다", () => {
    const result = validateConsignedReqLines([
      { mdg_code: "536691", qty: "NaN" },
    ]);
    expect(result).not.toBeNull();
  });

  it("같은 배열 내 MDG코드가 중복되면 에러를 반환한다", () => {
    const result = validateConsignedReqLines([
      { mdg_code: "536691", qty: "10" },
      { mdg_code: "536691", qty: "5" },
    ]);
    expect(result).not.toBeNull();
    expect(result).toContain("536691");
  });

  it("여러 줄이 모두 정상이면 null을 반환한다", () => {
    expect(
      validateConsignedReqLines([
        { mdg_code: "536691", qty: "10" },
        { mdg_code: "537161", qty: "5" },
        { mdg_code: "538000", qty: "1.5" },
      ])
    ).toBeNull();
  });

  it("bl_no가 없어도(undefined) 에러가 아니다 — 선택 입력", () => {
    expect(
      validateConsignedReqLines([{ mdg_code: "536691", qty: "10" }])
    ).toBeNull();
  });

  it("bl_no가 빈 문자열이어도 에러가 아니다", () => {
    expect(
      validateConsignedReqLines([
        { mdg_code: "536691", qty: "10", bl_no: "" },
      ])
    ).toBeNull();
  });

  it("bl_no가 값이 있어도 정상 처리된다", () => {
    expect(
      validateConsignedReqLines([
        { mdg_code: "536691", qty: "10", bl_no: "BL-2026-001" },
      ])
    ).toBeNull();
  });

  it("bl_no가 달라도 같은 mdg_code가 중복이면 여전히 에러를 반환한다", () => {
    const result = validateConsignedReqLines([
      { mdg_code: "536691", qty: "10", bl_no: "BL-001" },
      { mdg_code: "536691", qty: "5", bl_no: "BL-002" },
    ]);
    expect(result).not.toBeNull();
    expect(result).toContain("536691");
  });
});

describe("validateBlNoUpdate", () => {
  it("정상 입력이면 null을 반환한다", () => {
    expect(validateBlNoUpdate({ id: 1, bl_no: "BL-2026-001" })).toBeNull();
  });

  it("bl_no가 빈 문자열이면 허용된다 (지우기 용도)", () => {
    expect(validateBlNoUpdate({ id: 1, bl_no: "" })).toBeNull();
  });

  it("id가 정수가 아니면 에러를 반환한다", () => {
    expect(validateBlNoUpdate({ id: 1.5, bl_no: "BL-001" })).not.toBeNull();
  });

  it("id가 0 이하이면 에러를 반환한다", () => {
    expect(validateBlNoUpdate({ id: 0, bl_no: "BL-001" })).not.toBeNull();
    expect(validateBlNoUpdate({ id: -1, bl_no: "BL-001" })).not.toBeNull();
  });

  it("id가 NaN/Infinity이면 에러를 반환한다", () => {
    expect(validateBlNoUpdate({ id: NaN, bl_no: "BL-001" })).not.toBeNull();
    expect(validateBlNoUpdate({ id: Infinity, bl_no: "BL-001" })).not.toBeNull();
  });

  it("bl_no가 100자를 초과하면 에러를 반환한다", () => {
    const long = "A".repeat(101);
    expect(validateBlNoUpdate({ id: 1, bl_no: long })).not.toBeNull();
  });

  it("bl_no가 정확히 100자이면 허용된다", () => {
    const exact = "A".repeat(100);
    expect(validateBlNoUpdate({ id: 1, bl_no: exact })).toBeNull();
  });
});
