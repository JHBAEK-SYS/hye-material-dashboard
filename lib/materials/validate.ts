/**
 * 자재 마스터(materials) 신규 등록 입력 검증.
 * 순수 함수 — DB 접근 없이 폼 입력값만 검사한다.
 * 유효하면 null, 문제가 있으면 사용자에게 보여줄 에러 메시지 문자열을 반환한다.
 */
export function validateNewMaterial(input: {
  mdg_code: string;
  safety_stock: string;
  opening_stock: string;
}): string | null {
  const mdg_code = input.mdg_code.trim();
  if (!mdg_code) {
    return "MDG코드는 필수입니다.";
  }

  const safety_stock = input.safety_stock.trim();
  if (safety_stock !== "") {
    const n = Number(safety_stock);
    if (!Number.isFinite(n) || n < 0) {
      return "안전재고는 0 이상의 숫자여야 합니다.";
    }
  }

  const opening_stock = input.opening_stock.trim();
  if (opening_stock !== "") {
    const n = Number(opening_stock);
    if (!Number.isFinite(n) || n < 0) {
      return "기초재고는 0 이상의 숫자여야 합니다.";
    }
  }

  return null;
}
