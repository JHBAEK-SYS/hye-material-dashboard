import type { Session, User } from "@supabase/supabase-js";

/**
 * supabase.auth.signUp() 응답이 어떤 상황을 의미하는지 판정한 결과.
 *
 * - "signed-in": session이 발급됨 → 이메일 확인이 꺼진 프로젝트 설정이라
 *   가입과 동시에 로그인 상태가 된다.
 * - "already-registered": 이미 가입(및 확인 완료)된 이메일로 다시 가입을
 *   시도한 경우. Supabase는 계정 존재 여부를 노출하지 않기 위해 에러 대신
 *   identities가 빈 배열인 "가짜" user 객체를 돌려준다
 *   (Confirm email과 Confirm phone이 모두 켜져 있을 때의 동작).
 * - "confirmation-sent": 정상적으로 신규 가입 요청이 접수되어 인증 메일이
 *   발송된 경우.
 */
export type SignUpResult =
  | "signed-in"
  | "already-registered"
  | "confirmation-sent";

export type SignUpResponseLike = {
  user: User | null;
  session: Session | null;
};

/**
 * supabase.auth.signUp()의 { data } (즉 { user, session })를 받아
 * 위 3가지 상황 중 하나로 분류하는 순수 함수.
 *
 * 판정 우선순위:
 * 1. session이 존재하면 무조건 "signed-in" (실제로 인증된 상태이므로 최우선).
 * 2. user가 있고 identities가 빈 배열([])이면 "already-registered".
 * 3. 그 외(= user가 없거나, identities가 있거나 undefined)는 "confirmation-sent".
 *
 * user가 null이거나 identities가 undefined인 경우는 signUp() 응답 스펙상
 * 정상적으로는 발생하지 않는 엣지케이스이지만, 이를 에러로 취급해 사용자를
 * 막지 않고 안전한 기본값("메일을 보냈다")으로 안내한다.
 */
export function classifySignUpResult({
  user,
  session,
}: SignUpResponseLike): SignUpResult {
  if (session) {
    return "signed-in";
  }

  if (user && Array.isArray(user.identities) && user.identities.length === 0) {
    return "already-registered";
  }

  return "confirmation-sent";
}
