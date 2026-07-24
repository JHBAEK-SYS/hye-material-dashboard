import { describe, expect, it } from "vitest";

import {
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
});
