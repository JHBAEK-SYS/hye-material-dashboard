"use server";

import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/form-state";
import { validateNewPassword } from "@/lib/auth/password";

/**
 * 비밀번호 재설정 링크를 통해 발급된 세션으로 새 비밀번호를 저장하는 Server Action.
 * (updateUser는 현재 세션이 있어야 동작한다. 세션이 없으면 - 즉 재설정 링크를
 * 거치지 않고 이 화면에 직접 접근한 경우 - Supabase가 에러를 반환한다.)
 */
export async function updatePassword(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const validationError = validateNewPassword(password, confirmPassword);
  if (validationError) {
    return { error: validationError, message: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return {
      error:
        "비밀번호를 변경하지 못했습니다. 재설정 링크가 만료되었을 수 있습니다. 다시 요청해 주세요.",
      message: null,
    };
  }

  return {
    error: null,
    message: "비밀번호가 변경되었습니다. 이제 새 비밀번호로 이용하실 수 있습니다.",
  };
}
