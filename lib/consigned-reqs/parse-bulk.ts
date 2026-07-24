/**
 * 사급청구 등록 폼의 엑셀/텍스트 붙여넣기 파싱. 순수 함수 — DOM/클립보드에 의존하지 않는다.
 * 한 줄당 "MDG코드 · 수량 · B/L NO(선택)" 3열.
 *
 * 열 구분자는 탭을 우선 인식한다: B/L NO 값에 공백이 섞여 있을 수 있어(예: "BL 2026 001"),
 * 탭이 있는 줄은 탭으로만 분리해 공백을 값의 일부로 보존한다. 탭이 없는 줄은 기존처럼
 * 공백/쉼표로 분리한다(간단히 "MDG코드 수량"만 붙여넣는 기존 사용 방식과의 호환).
 */
export function parseBulk(
  text: string
): { mdg_code: string; qty: string; bl_no: string }[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l) => {
      // 탭이 있으면 탭으로만 분리(각 열은 개별 trim) — 공백이 포함된 B/L NO를 보존한다.
      // 탭이 없으면 기존처럼 줄 전체를 trim한 뒤 공백/쉼표로 분리한다.
      const parts = l.includes("\t")
        ? l.split("\t").map((p) => p.trim())
        : l.trim().split(/[\s,]+/).filter(Boolean);
      return {
        mdg_code: parts[0] ?? "",
        qty: parts[1] ?? "",
        bl_no: parts[2] ?? "",
      };
    })
    .filter((p) => p.mdg_code);
}
