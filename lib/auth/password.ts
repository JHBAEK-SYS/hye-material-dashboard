// 새 비밀번호 입력 화면의 검증 로직. Supabase Auth의 기본 최소 길이(6자)를 따른다.
// 순수 함수로 분리해 UI/Server Action과 독립적으로 테스트한다.
export const MIN_PASSWORD_LENGTH = 6;

/**
 * 새 비밀번호와 확인 입력을 검증한다.
 * 문제가 있으면 사용자에게 보여줄 에러 메시지를, 문제가 없으면 null을 반환한다.
 *
 * 우선순위: 길이 부족을 먼저 확인한 뒤 일치 여부를 확인한다.
 * (길이 미달인 값을 그대로 확인란에 다시 입력해도 "일치하지 않음"이 아니라
 * "너무 짧음"으로 안내하는 것이 사용자에게 더 정확한 정보이기 때문이다.)
 */
export function validateNewPassword(
  password: string,
  confirmPassword: string
): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
  }

  if (password !== confirmPassword) {
    return "비밀번호가 일치하지 않습니다.";
  }

  return null;
}
