import { describe, expect, it } from "vitest";

import { validateNewMaterial } from "@/lib/materials/validate";

const validInput = {
  mdg_code: "536691",
  safety_stock: "10",
  opening_stock: "100",
};

describe("validateNewMaterial", () => {
  it("정상 입력이면 null을 반환한다", () => {
    expect(validateNewMaterial(validInput)).toBeNull();
  });

  it("MDG코드가 없으면 에러를 반환한다", () => {
    const result = validateNewMaterial({ ...validInput, mdg_code: "" });
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("MDG코드가 공백뿐이면 에러를 반환한다", () => {
    const result = validateNewMaterial({ ...validInput, mdg_code: "   " });
    expect(result).not.toBeNull();
  });

  it("안전재고가 빈 문자열이면 허용한다(0 취급)", () => {
    expect(
      validateNewMaterial({ ...validInput, safety_stock: "" })
    ).toBeNull();
  });

  it("안전재고가 숫자가 아니면 에러를 반환한다", () => {
    const result = validateNewMaterial({ ...validInput, safety_stock: "abc" });
    expect(result).not.toBeNull();
  });

  it("안전재고가 음수이면 에러를 반환한다", () => {
    const result = validateNewMaterial({ ...validInput, safety_stock: "-1" });
    expect(result).not.toBeNull();
  });

  it("안전재고가 무한대이면 에러를 반환한다", () => {
    const result = validateNewMaterial({
      ...validInput,
      safety_stock: "Infinity",
    });
    expect(result).not.toBeNull();
  });

  it("기초재고가 빈 문자열이면 허용한다(0 취급)", () => {
    expect(
      validateNewMaterial({ ...validInput, opening_stock: "" })
    ).toBeNull();
  });

  it("기초재고가 숫자가 아니면 에러를 반환한다", () => {
    const result = validateNewMaterial({
      ...validInput,
      opening_stock: "abc",
    });
    expect(result).not.toBeNull();
  });

  it("기초재고가 음수이면 에러를 반환한다", () => {
    const result = validateNewMaterial({
      ...validInput,
      opening_stock: "-5",
    });
    expect(result).not.toBeNull();
  });

  it("기초재고가 무한대이면 에러를 반환한다", () => {
    const result = validateNewMaterial({
      ...validInput,
      opening_stock: "Infinity",
    });
    expect(result).not.toBeNull();
  });

  it("모두 0이어도 정상 처리된다", () => {
    expect(
      validateNewMaterial({
        mdg_code: "536691",
        safety_stock: "0",
        opening_stock: "0",
      })
    ).toBeNull();
  });
});
