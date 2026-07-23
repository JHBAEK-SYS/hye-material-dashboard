"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { AuthState } from "@/app/login/auth-state";

/**
 * 로그인 폼의 단일 Server Action.
 * intent 값("login" | "signup")에 따라 분기합니다.
 */
export async function authenticate(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const intent = String(formData.get("intent") ?? "login");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 모두 입력하세요.", message: null };
  }

  const supabase = await createClient();

  if (intent === "signup") {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return { error: error.message, message: null };
    }
    return {
      error: null,
      message:
        "가입 요청이 접수되었습니다. 이메일 확인이 필요할 수 있습니다. (또는 Supabase 대시보드에서 사용자를 승인하세요.)",
    };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다.", message: null };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
