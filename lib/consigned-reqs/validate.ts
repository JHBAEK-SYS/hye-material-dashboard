/**
 * 사급청구(consigned_reqs) 신규 등록 입력 검증.
 * 순수 함수 — DB 접근 없이 폼 입력값만 검사한다.
 * 유효하면 null, 문제가 있으면 사용자에게 보여줄 에러 메시지 문자열을 반환한다.
 *
 * 하나의 사급청구번호(sg_no)에 여러 품목(MDG코드)을 동시 등록하는 구조이므로
 * 헤더(사급청구번호·요청일)와 품목 줄(MDG코드·수량)을 분리해 검증한다.
 */
export function validateConsignedReqHeader(input: {
  sg_no: string;
  request_date: string;
}): string | null {
  const sg_no = input.sg_no.trim();
  const request_date = input.request_date.trim();

  if (!sg_no || !request_date) {
    return "사급청구번호·요청일은 필수입니다.";
  }

  return null;
}

export function validateConsignedReqLines(
  lines: { mdg_code: string; qty: string; bl_no?: string }[]
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

    // bl_no(B/L NO)는 선택 입력 — 선적 시점에 나오므로 청구 등록 시점엔 없을 수 있다.
    // 값이 있든 없든 여기서는 검증하지 않는다(별도 길이 검증은 validateBlNoUpdate 참고).

    if (seen.has(mdg_code)) {
      return `같은 사급청구에 중복된 품목: ${mdg_code}`;
    }
    seen.add(mdg_code);
  }

  return null;
}

const BL_NO_MAX_LENGTH = 100;

/**
 * B/L NO 수정(목록 인라인 폼) 입력 검증.
 * id는 유한한 양의 정수여야 하고, bl_no는 빈 값(=지우기)을 허용하되 길이 상한만 둔다.
 */
export function validateBlNoUpdate(input: {
  id: number;
  bl_no: string;
}): string | null {
  if (
    !Number.isFinite(input.id) ||
    !Number.isInteger(input.id) ||
    input.id <= 0
  ) {
    return "잘못된 ID 입니다.";
  }

  if (input.bl_no.trim().length > BL_NO_MAX_LENGTH) {
    return `B/L NO는 ${BL_NO_MAX_LENGTH}자를 초과할 수 없습니다.`;
  }

  return null;
}
