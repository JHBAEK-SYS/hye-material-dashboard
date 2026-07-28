import { describe, expect, it } from "vitest";

import {
  validateDeleteId,
  validateIssueHeader,
  validateIssueLines,
} from "@/lib/issues/validate";

const validHeader = {
  req_no: "REQ-2026-0001",
  issue_date: "2026-07-24",
};

const validLines = [
  { mdg_code: "536691", qty: "10" },
  { mdg_code: "537161", qty: "5" },
];

describe("validateIssueHeader", () => {
  it("정상 입력이면 null을 반환한다", () => {
    expect(validateIssueHeader(validHeader)).toBeNull();
  });

  it("청구번호(req_no)가 없으면 에러를 반환한다", () => {
    const result = validateIssueHeader({ ...validHeader, req_no: "" });
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("청구번호가 공백뿐이면 에러를 반환한다", () => {
    const result = validateIssueHeader({ ...validHeader, req_no: "   " });
    expect(result).not.toBeNull();
  });

  it("출고일(issue_date)이 없으면 에러를 반환한다", () => {
    const result = validateIssueHeader({ ...validHeader, issue_date: "" });
    expect(result).not.toBeNull();
  });
});

describe("validateIssueLines", () => {
  it("정상 입력이면 null을 반환한다", () => {
    expect(validateIssueLines(validLines)).toBeNull();
  });

  it("빈 배열이면 에러를 반환한다", () => {
    const result = validateIssueLines([]);
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("어떤 줄의 MDG코드가 없으면 에러를 반환한다", () => {
    const result = validateIssueLines([{ mdg_code: "", qty: "10" }]);
    expect(result).not.toBeNull();
  });

  it("어떤 줄의 수량이 없으면 에러를 반환하고 해당 MDG코드를 포함한다", () => {
    const result = validateIssueLines([{ mdg_code: "536691", qty: "" }]);
    expect(result).not.toBeNull();
    expect(result).toContain("536691");
  });

  it("어떤 줄의 수량이 숫자가 아니면 에러를 반환하고 해당 MDG코드를 포함한다", () => {
    const result = validateIssueLines([{ mdg_code: "536691", qty: "abc" }]);
    expect(result).not.toBeNull();
    expect(result).toContain("536691");
  });

  it("어떤 줄의 수량이 0이면 에러를 반환한다", () => {
    const result = validateIssueLines([{ mdg_code: "536691", qty: "0" }]);
    expect(result).not.toBeNull();
  });

  it("어떤 줄의 수량이 음수이면 에러를 반환한다", () => {
    const result = validateIssueLines([{ mdg_code: "536691", qty: "-5" }]);
    expect(result).not.toBeNull();
  });

  it("어떤 줄의 수량이 NaN이면 에러를 반환한다", () => {
    const result = validateIssueLines([{ mdg_code: "536691", qty: "NaN" }]);
    expect(result).not.toBeNull();
  });

  it("같은 배열 내 MDG코드가 중복되면 에러를 반환한다", () => {
    const result = validateIssueLines([
      { mdg_code: "536691", qty: "10" },
      { mdg_code: "536691", qty: "5" },
    ]);
    expect(result).not.toBeNull();
    expect(result).toContain("536691");
  });

  it("여러 줄이 모두 정상이면 null을 반환한다", () => {
    expect(
      validateIssueLines([
        { mdg_code: "536691", qty: "10" },
        { mdg_code: "537161", qty: "5" },
        { mdg_code: "538000", qty: "1.5" },
      ])
    ).toBeNull();
  });

  it("같은 mdg_code라도 part_no가 다르면 중복이 아니다", () => {
    const result = validateIssueLines([
      { mdg_code: "528191", qty: "10", part_no: "38SL-1-304" },
      { mdg_code: "528191", qty: "5", part_no: "38SL-1.5-304" },
    ]);
    expect(result).toBeNull();
  });

  it("같은 mdg_code + 같은 part_no(대소문자만 다름)이면 중복 에러를 반환한다", () => {
    const result = validateIssueLines([
      { mdg_code: "528191", qty: "10", part_no: "abc-123" },
      { mdg_code: "528191", qty: "5", part_no: "ABC-123" },
    ]);
    expect(result).not.toBeNull();
    expect(result).toContain("528191");
    expect(result).toContain("ABC-123");
  });

  it("part_no에 공백이 섞여도 키가 충돌하지 않는다", () => {
    const result = validateIssueLines([
      { mdg_code: "A", qty: "10", part_no: "X Y" },
      { mdg_code: "A", qty: "5", part_no: "X" },
    ]);
    expect(result).toBeNull();
  });
});

describe("validateDeleteId", () => {
  it("양의 정수이면 null을 반환한다", () => {
    expect(validateDeleteId(1)).toBeNull();
    expect(validateDeleteId(42)).toBeNull();
  });

  it("0이면 에러를 반환한다", () => {
    const result = validateDeleteId(0);
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("음수이면 에러를 반환한다", () => {
    const result = validateDeleteId(-5);
    expect(result).not.toBeNull();
  });

  it("소수이면 에러를 반환한다", () => {
    const result = validateDeleteId(1.5);
    expect(result).not.toBeNull();
  });

  it("NaN이면 에러를 반환한다", () => {
    const result = validateDeleteId(NaN);
    expect(result).not.toBeNull();
  });

  it("무한대이면 에러를 반환한다", () => {
    const result = validateDeleteId(Infinity);
    expect(result).not.toBeNull();
  });
});
