/**
 * 출고기록(issues) 신규 등록 입력 검증.
 * 순수 함수 — DB 접근 없이 폼 입력값만 검사한다.
 * 유효하면 null, 문제가 있으면 사용자에게 보여줄 에러 메시지 문자열을 반환한다.
 *
 * 하나의 청구번호(req_no)에 여러 품목(MDG코드)을 동시 등록하는 구조이므로
 * 헤더(청구번호·출고일)와 품목 줄(MDG코드·수량)을 분리해 검증한다.
 */
export function validateIssueHeader(input: {
  req_no: string;
  issue_date: string;
}): string | null {
  const req_no = input.req_no.trim();
  const issue_date = input.issue_date.trim();

  if (!req_no || !issue_date) {
    return "청구번호·출고일은 필수입니다.";
  }

  return null;
}

/**
 * 출고기록 삭제 시 넘어온 id 검증.
 * 유한수이고 0보다 큰 정수여야 한다.
 */
export function validateDeleteId(id: number): string | null {
  if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
    return "잘못된 출고 ID.";
  }
  return null;
}

export function validateIssueLines(
  lines: { mdg_code: string; qty: string }[]
): string | null {
  if (lines.length === 0) {
    return "품목(MDG코드)을 1개 이상 입력하세요.";
  }

  const seen = new Set<string>();
  for (const line of lines) {
    const mdg_code = line.mdg_code.trim();
    const qty = line.qty.trim();

    if (!mdg_code) {
      return "MDG코드는 필수입니다.";
    }

    const qtyNum = Number(qty);
    if (!qty || !Number.isFinite(qtyNum) || qtyNum <= 0) {
      return `'${mdg_code}' 품목의 수량이 올바르지 않습니다.`;
    }

    if (seen.has(mdg_code)) {
      return `같은 출고에 중복된 품목: ${mdg_code}`;
    }
    seen.add(mdg_code);
  }

  return null;
}
