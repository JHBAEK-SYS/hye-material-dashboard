"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { AuthState } from "@/app/login/auth-state";
import { classifySignUpResult } from "@/lib/auth/signup-result";

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
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return { error: error.message, message: null };
    }

    const result = classifySignUpResult(data);

    if (result === "signed-in") {
      revalidatePath("/", "layout");
      redirect("/dashboard");
    }

    if (result === "already-registered") {
      return {
        error: null,
        message: "이미 가입된 이메일입니다. 비밀번호를 입력하고 로그인해 주세요.",
      };
    }

    return {
      error: null,
      message:
        "입력하신 주소로 인증 메일을 보냈습니다. 메일의 링크를 눌러 인증을 완료한 뒤 로그인해 주세요. 메일이 보이지 않으면 스팸함도 확인해 주세요.\n\n" +
        "인증 완료 후에는 우선 조회만 가능하며, 데이터 등록/수정 권한은 관리자 승인이 필요합니다.",
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
