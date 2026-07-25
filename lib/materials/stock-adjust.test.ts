import { describe, expect, it } from "vitest";

import {
  computeOpeningStockForTarget,
  validateStockAdjustment,
} from "@/lib/materials/stock-adjust";

describe("computeOpeningStockForTarget", () => {
  it("역산 공식대로 계산한다 (기초 100·입고 50·출고 30 → 현재고 120, target 125면 새 기초재고 105)", () => {
    // 기존 상태 확인용: 100 + 50 - 30 = 120 (현재고)
    // 새 target=125 → 새 기초재고 = 125 - 50 + 30 = 105
    expect(
      computeOpeningStockForTarget({ target: 125, inTotal: 50, outTotal: 30 })
    ).toBe(105);
  });

  it("입고/출고가 0이면 기초재고 = target", () => {
    expect(
      computeOpeningStockForTarget({ target: 10, inTotal: 0, outTotal: 0 })
    ).toBe(10);
  });

  it("target이 0이어도 계산된다", () => {
    expect(
      computeOpeningStockForTarget({ target: 0, inTotal: 20, outTotal: 5 })
    ).toBe(-15);
  });

  it("결과가 음수가 될 수 있다 (호출부에서 별도 경고 처리)", () => {
    expect(
      computeOpeningStockForTarget({ target: 5, inTotal: 100, outTotal: 0 })
    ).toBe(-95);
  });
});

describe("validateStockAdjustment", () => {
  it("빈 문자열이면 에러", () => {
    expect(validateStockAdjustment({ target: "" })).toBe(
      "실사 수량을 입력하세요."
    );
  });

  it("공백만 있으면 에러", () => {
    expect(validateStockAdjustment({ target: "   " })).toBe(
      "실사 수량을 입력하세요."
    );
  });

  it("숫자가 아니면 에러", () => {
    expect(validateStockAdjustment({ target: "abc" })).not.toBeNull();
  });

  it("NaN 문자열이면 에러", () => {
    expect(validateStockAdjustment({ target: "NaN" })).not.toBeNull();
  });

  it("Infinity면 에러", () => {
    expect(validateStockAdjustment({ target: "Infinity" })).not.toBeNull();
  });

  it("음수면 에러", () => {
    expect(validateStockAdjustment({ target: "-1" })).not.toBeNull();
  });

  it("0은 허용", () => {
    expect(validateStockAdjustment({ target: "0" })).toBeNull();
  });

  it("양의 정수는 허용", () => {
    expect(validateStockAdjustment({ target: "125" })).toBeNull();
  });
});
