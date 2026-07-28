/**
 * 자재 목록 '활성만' 필터의 쿼리스트링 판정. 순수 함수.
 *
 * 이 필터는 기본값이 **켜짐**이다. 그런데 HTML 체크박스는 해제 상태에서
 * 아무 값도 전송하지 않으므로, 파라미터가 없다는 사실만으로는
 * "처음 접속(=기본값을 원함)"과 "사용자가 일부러 해제함"을 구분할 수 없다.
 *
 * 그래서 폼에서 체크박스 바로 앞에 hidden `active=0` 을 함께 둔다. 그러면
 * 전송되는 값은 다음 셋 중 하나가 된다:
 *   - 없음        → 첫 접속 또는 '초기화' 링크 → 기본값 true
 *   - "0"         → 체크 해제 → false
 *   - ["0", "1"]  → 체크됨(hidden + checkbox 둘 다 전송) → 마지막 값 "1" → true
 *
 * 마지막 값을 읽는 이유가 여기 있다 — hidden 이 항상 먼저 오기 때문이다.
 */
export function parseActiveOnly(raw: string | string[] | undefined): boolean {
  if (raw === undefined) return true;
  const last = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  return last === "1";
}

/**
 * 페이지 이동·엑셀 다운로드 링크에 넣을 값. 기본값이 켜짐이라 꺼진 상태를
 * 링크에 유지하려면 생략하지 말고 "0" 을 명시해야 한다.
 */
export function activeOnlyParam(activeOnly: boolean): string {
  return activeOnly ? "1" : "0";
}
