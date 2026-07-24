import { describe, expect, it } from "vitest";

import {
  isOutstanding,
  receiptStatus,
  remainingQty,
  validateReceiveInput,
} from "@/lib/receive/validate";

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

describe("receiptStatus", () => {
  it("receivedQty가 null이면 미입고를 반환한다", () => {
    expect(receiptStatus(30, null)).toBe("미입고");
  });

  it("receivedQty가 0이면 미입고를 반환한다", () => {
    expect(receiptStatus(30, 0)).toBe("미입고");
  });

  it("receivedQty가 음수이면 미입고를 반환한다", () => {
    expect(receiptStatus(30, -5)).toBe("미입고");
  });

  it("0 < receivedQty < orderQty 이면 부분입고를 반환한다 (20/30)", () => {
    expect(receiptStatus(30, 20)).toBe("부분입고");
  });

  it("receivedQty === orderQty 이면 입고완료를 반환한다 (30/30)", () => {
    expect(receiptStatus(30, 30)).toBe("입고완료");
  });

  it("receivedQty > orderQty(초과입고) 이면 입고완료를 반환한다 (35/30)", () => {
    expect(receiptStatus(30, 35)).toBe("입고완료");
  });

  it("소수 수량도 올바르게 판정한다 (부분입고)", () => {
    expect(receiptStatus(30.5, 20.25)).toBe("부분입고");
  });

  it("소수 수량이 정확히 일치하면 입고완료를 반환한다", () => {
    expect(receiptStatus(30.5, 30.5)).toBe("입고완료");
  });

  it("orderQty가 0이어도 죽지 않고 처리한다 (receivedQty 0 -> 미입고)", () => {
    expect(receiptStatus(0, 0)).toBe("미입고");
  });

  it("orderQty가 0이고 receivedQty가 양수이면 입고완료를 반환한다", () => {
    expect(receiptStatus(0, 5)).toBe("입고완료");
  });

  it("orderQty가 음수이어도 죽지 않는다", () => {
    expect(() => receiptStatus(-10, 5)).not.toThrow();
  });
});

describe("remainingQty", () => {
  it("receivedQty가 null이면 orderQty 전체를 반환한다", () => {
    expect(remainingQty(30, null)).toBe(30);
  });

  it("receivedQty가 0이면 orderQty 전체를 반환한다", () => {
    expect(remainingQty(30, 0)).toBe(30);
  });

  it("부분입고(20/30)이면 남은 수량 10을 반환한다", () => {
    expect(remainingQty(30, 20)).toBe(10);
  });

  it("전량입고(30/30)이면 남은 수량 0을 반환한다", () => {
    expect(remainingQty(30, 30)).toBe(0);
  });

  it("초과입고(35/30)이어도 남은 수량은 0으로 하한한다", () => {
    expect(remainingQty(30, 35)).toBe(0);
  });

  it("소수 수량의 남은 수량을 정확히 계산한다", () => {
    expect(remainingQty(30.5, 20.25)).toBeCloseTo(10.25);
  });

  it("orderQty가 0이면 음수가 되지 않도록 0을 반환한다", () => {
    expect(remainingQty(0, 0)).toBe(0);
  });

  it("orderQty가 0이고 receivedQty가 양수여도 남은 수량은 0이다", () => {
    expect(remainingQty(0, 5)).toBe(0);
  });

  it("orderQty가 음수이어도 남은 수량은 0으로 하한한다", () => {
    expect(remainingQty(-10, 0)).toBe(0);
  });
});

describe("isOutstanding", () => {
  it("receivedQty가 null이면(미입고) true를 반환한다", () => {
    expect(isOutstanding(30, null)).toBe(true);
  });

  it("receivedQty가 0이면(미입고) true를 반환한다", () => {
    expect(isOutstanding(30, 0)).toBe(true);
  });

  it("부분입고(20/30)이면 true를 반환한다", () => {
    expect(isOutstanding(30, 20)).toBe(true);
  });

  it("정확히 전량입고(30/30)이면 false를 반환한다", () => {
    expect(isOutstanding(30, 30)).toBe(false);
  });

  it("초과입고(35/30)이면 false를 반환한다", () => {
    expect(isOutstanding(30, 35)).toBe(false);
  });

  it("orderQty가 0이어도 죽지 않고 처리한다 (receivedQty 0 -> true)", () => {
    expect(isOutstanding(0, 0)).toBe(true);
  });

  it("orderQty가 0이고 receivedQty가 양수이면 false를 반환한다", () => {
    expect(isOutstanding(0, 5)).toBe(false);
  });

  it("orderQty가 음수이어도 죽지 않는다", () => {
    expect(() => isOutstanding(-10, 5)).not.toThrow();
  });
});
