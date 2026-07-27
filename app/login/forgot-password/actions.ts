"use server";

import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/auth/site-url";
import type { FormState } from "@/lib/form-state";

// 계정 존재 여부가 드러나지 않도록, 이메일이 실제로 가입되어 있든 아니든
// 항상 동일한 메시지를 보여준다.
const GENERIC_SUCCESS_MESSAGE =
  "입력하신 주소가 가입된 이메일이라면 비밀번호 재설정 메일을 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.";

const SYSTEM_ERROR_MESSAGE =
  "일시적인 오류로 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

/**
 * 비밀번호 재설정 메일 발송을 요청하는 Server Action.
 *
 * 보안상 계정 존재 여부를 노출하면 안 되므로, Supabase가 에러를 반환하더라도
 * (예: 존재하지 않는 이메일, 형식 오류 등 4xx대 클라이언트 오류) 사용자에게는
 * 항상 동일한 "메일을 보냈습니다" 메시지를 보여준다.
 * 다만 네트워크 실패나 5xx 등 진짜 시스템 오류는 계정 존재 여부와 무관하므로
 * 구분해서 별도 메시지를 보여준다.
 */
export async function requestPasswordReset(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "이메일을 입력하세요.", message: null };
  }

  const supabase = await createClient();
  const siteUrl = getSiteUrl(process.env);

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/confirm`,
    });

    if (error && (error.status === undefined || error.status >= 500)) {
      return { error: SYSTEM_ERROR_MESSAGE, message: null };
    }
  } catch {
    return { error: SYSTEM_ERROR_MESSAGE, message: null };
  }

  return { error: null, message: GENERIC_SUCCESS_MESSAGE };
}
