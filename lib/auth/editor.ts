import { createClient } from "@/lib/supabase/server";

/**
 * 사용자 이메일이 편집자 목록에 있는지 (대소문자·공백 무시).
 * 순수 함수 — DB 접근 없음, 단위테스트 대상.
 */
export function isEditorEmail(
  email: string | null | undefined,
  editorEmails: string[]
): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return editorEmails.some((e) => e.trim().toLowerCase() === normalized);
}

/**
 * 현재 로그인 사용자가 편집 권한자(app_editors 테이블)인지 조회.
 * app_editors 테이블이 아직 없거나(마이그레이션 전) 쿼리가 실패하면
 * 안전하게 false를 반환한다 — 이 경우 "아무도 수정 불가"가 의도된 동작이다.
 * (실제 쓰기 차단은 RLS가 담당하며, 이 함수는 서버 액션/화면에서 사용자에게
 *  올바른 안내를 보여주기 위한 보조 판정이다.)
 */
export async function getCanEdit(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email;
    if (!email) return false;

    // ilike 로 조회하면 이메일 속 `_`/`%` 가 와일드카드로 해석되어
    // (예: 편집자 hong_gd@corp.com 이 hongXgd@corp.com 과도 매칭) 잘못 판정된다.
    // 편집자 명단은 몇 행 수준이므로 전량을 읽어 정확 비교한다.
    const { data, error } = await supabase.from("app_editors").select("email");

    if (error) return false;
    const editorEmails = ((data ?? []) as { email: string | null }[])
      .map((row) => row.email)
      .filter((e): e is string => e != null);
    return isEditorEmail(email, editorEmails);
  } catch {
    return false;
  }
}
