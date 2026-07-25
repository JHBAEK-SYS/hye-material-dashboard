/**
 * 실사(재고조사) 결과로 재고를 조정하기 위한 순수 함수 모음.
 * DB 접근 없이 숫자/문자열 입력만 다룬다.
 *
 * 배경: 현재고(current_stock) = 기초재고(opening_stock) + 입고누계(in_total) - 출고누계(out_total)
 * 는 v_stock_status 뷰에서 계산되며, opening_stock 만 materials 테이블의 실제 컬럼이다.
 * 사용자는 "기초재고를 얼마나 더할지"가 아니라 "실사 결과 현재고가 얼마인지"를 알고
 * 있으므로, 입력받은 target(원하는 현재고)을 기준으로 새 기초재고를 역산한다.
 */

/**
 * 실사 수량(target = 원하는 현재고)으로부터 새 기초재고를 역산한다.
 * 새 기초재고 = target - 입고누계 + 출고누계
 *
 * inTotal/outTotal 이 null 일 수 있는 호출부(v_stock_status 의 집계 컬럼)는
 * 호출 시 `?? 0` 으로 넘기도록 하고, 이 함수 자체는 number 만 받는다.
 */
export function computeOpeningStockForTarget({
  target,
  inTotal,
  outTotal,
}: {
  target: number;
  inTotal: number;
  outTotal: number;
}): number {
  return target - inTotal + outTotal;
}

/**
 * 재고 조정 폼 입력 검증.
 * 유효하면 null, 문제가 있으면 사용자에게 보여줄 한국어 에러 메시지를 반환한다.
 *
 * lib/materials/validate.ts, lib/issues/validate.ts 와 동일한 관례:
 * 유한한 숫자가 아니거나 음수면 거부. 소수 허용 여부는 기존 재고 수치
 * (opening_stock/safety_stock)와 동일하게 정수 강제를 두지 않는다.
 */
export function validateStockAdjustment(input: { target: string }): string | null {
  const target = input.target.trim();
  if (target === "") {
    return "실사 수량을 입력하세요.";
  }

  const n = Number(target);
  if (!Number.isFinite(n) || n < 0) {
    return "실사 수량은 0 이상의 숫자여야 합니다.";
  }

  return null;
}
