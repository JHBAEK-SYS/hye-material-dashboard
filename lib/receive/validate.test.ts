import { describe, expect, it } from "vitest";

import { validateReceiveInput } from "@/lib/receive/validate";

const validInput = {
  id: 1,
  received_date: "2026-07-24",
  received_qty: "10",
};

describe("validateReceiveInput", () => {
  it("정상 입력이면 null을 반환한다", () => {
    expect(validateReceiveInput(validInput)).toBeNull();
  });

  // id
  it("id가 0이면 에러를 반환한다", () => {
    const result = validateReceiveInput({ ...validInput, id: 0 });
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("id가 음수이면 에러를 반환한다", () => {
    const result = validateReceiveInput({ ...validInput, id: -5 });
    expect(result).not.toBeNull();
  });

  it("id가 NaN이면 에러를 반환한다", () => {
    const result = validateReceiveInput({ ...validInput, id: NaN });
    expect(result).not.toBeNull();
  });

  it("id가 무한대이면 에러를 반환한다", () => {
    const result = validateReceiveInput({ ...validInput, id: Infinity });
    expect(result).not.toBeNull();
  });

  it("id가 소수이면 에러를 반환한다", () => {
    const result = validateReceiveInput({ ...validInput, id: 1.5 });
    expect(result).not.toBeNull();
  });

  // received_date
  it("received_date가 없으면 에러를 반환한다", () => {
    const result = validateReceiveInput({ ...validInput, received_date: "" });
    expect(result).not.toBeNull();
  });

  it("received_date가 공백뿐이면 에러를 반환한다", () => {
    const result = validateReceiveInput({
      ...validInput,
      received_date: "   ",
    });
    expect(result).not.toBeNull();
  });

  it("received_date 형식이 YYYY-M-D처럼 자리수가 부족하면 에러를 반환한다", () => {
    const result = validateReceiveInput({
      ...validInput,
      received_date: "2026-7-4",
    });
    expect(result).not.toBeNull();
  });

  it("received_date에 구분자(-)가 없으면 에러를 반환한다", () => {
    const result = validateReceiveInput({
      ...validInput,
      received_date: "20260704",
    });
    expect(result).not.toBeNull();
  });

  it("received_date가 존재하지 않는 날짜(2026-02-30)이면 에러를 반환한다", () => {
    const result = validateReceiveInput({
      ...validInput,
      received_date: "2026-02-30",
    });
    expect(result).not.toBeNull();
  });

  it("received_date의 월이 13이면 에러를 반환한다", () => {
    const result = validateReceiveInput({
      ...validInput,
      received_date: "2026-13-01",
    });
    expect(result).not.toBeNull();
  });

  it("received_date가 유효한 윤년 날짜이면 null을 반환한다", () => {
    const result = validateReceiveInput({
      ...validInput,
      received_date: "2024-02-29",
    });
    expect(result).toBeNull();
  });

  // received_qty
  it("received_qty가 없으면 에러를 반환한다", () => {
    const result = validateReceiveInput({ ...validInput, received_qty: "" });
    expect(result).not.toBeNull();
  });

  it("received_qty가 0이면 에러를 반환한다", () => {
    const result = validateReceiveInput({ ...validInput, received_qty: "0" });
    expect(result).not.toBeNull();
  });

  it("received_qty가 음수이면 에러를 반환한다", () => {
    const result = validateReceiveInput({
      ...validInput,
      received_qty: "-5",
    });
    expect(result).not.toBeNull();
  });

  it("received_qty가 숫자가 아니면 에러를 반환한다", () => {
    const result = validateReceiveInput({
      ...validInput,
      received_qty: "abc",
    });
    expect(result).not.toBeNull();
  });

  it("received_qty가 소수여도 통과한다", () => {
    const result = validateReceiveInput({
      ...validInput,
      received_qty: "1.5",
    });
    expect(result).toBeNull();
  });
});
