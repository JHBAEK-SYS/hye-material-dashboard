/**
 * 입고처리(orders/receive, consigned-reqs/receive) 공통 입력 검증.
 * 순수 함수 — DB 접근 없이 폼 입력값만 검사한다.
 * 유효하면 null, 문제가 있으면 사용자에게 보여줄 에러 메시지 문자열을 반환한다.
 */

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string): boolean {
  if (!DATE_FORMAT.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function validateReceiveInput(input: {
  id: number;
  received_date: string;
  received_qty: string;
}): string | null {
  if (
    !Number.isFinite(input.id) ||
    !Number.isInteger(input.id) ||
    input.id <= 0
  ) {
    return "잘못된 ID 입니다.";
  }

  const received_date = input.received_date.trim();
  if (!received_date) {
    return "입고일은 필수입니다.";
  }
  if (!isValidCalendarDate(received_date)) {
    return "입고일 형식이 올바르지 않습니다. (YYYY-MM-DD)";
  }

  const received_qty = input.received_qty.trim();
  const qtyNum = Number(received_qty);
  if (!received_qty || !Number.isFinite(qtyNum) || qtyNum <= 0) {
    return "입고수량은 0보다 커야 합니다.";
  }

  return null;
}

export type ReceiptStatus = "미입고" | "부분입고" | "입고완료";

/**
 * 발주/청구 수량(orderQty)과 누적 입고수량(receivedQty)으로 상태를 판정한다.
 * 초과 입고(receivedQty > orderQty)는 실무상 과납품으로 허용하며 "입고완료"로 취급한다.
 * orderQty가 0 이하이거나 비정상인 경우에도 죽지 않도록 방어적으로 처리한다.
 */
export function receiptStatus(
  orderQty: number,
  receivedQty: number | null
): ReceiptStatus {
  const safeOrderQty = Number.isFinite(orderQty) ? orderQty : 0;
  const safeReceivedQty =
    receivedQty != null && Number.isFinite(receivedQty) ? receivedQty : 0;

  if (safeReceivedQty <= 0) {
    return "미입고";
  }
  if (safeOrderQty <= 0) {
    return "입고완료";
  }
  if (safeReceivedQty >= safeOrderQty) {
    return "입고완료";
  }
  return "부분입고";
}

/**
 * 아직 전량 입고되지 않았는가 (미입고 + 부분입고 = true, 입고완료 = false).
 * receiptStatus 를 재사용해 판정 로직이 목록 배지 표시와 어긋나지 않도록 한다.
 */
export function isOutstanding(
  orderQty: number,
  receivedQty: number | null
): boolean {
  return receiptStatus(orderQty, receivedQty) !== "입고완료";
}

/**
 * 남은 수량 = orderQty - receivedQty. 음수가 되지 않도록 0으로 하한한다.
 * orderQty가 0 이하이거나 비정상인 경우에도 죽지 않도록 방어적으로 처리한다.
 */
export function remainingQty(
  orderQty: number,
  receivedQty: number | null
): number {
  const safeOrderQty = Number.isFinite(orderQty) ? orderQty : 0;
  const safeReceivedQty =
    receivedQty != null && Number.isFinite(receivedQty) ? receivedQty : 0;

  const remaining = safeOrderQty - safeReceivedQty;
  return remaining > 0 ? remaining : 0;
}
