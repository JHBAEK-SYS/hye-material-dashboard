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
