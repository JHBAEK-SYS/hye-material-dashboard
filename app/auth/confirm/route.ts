import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Supabase 비밀번호 재설정 메일 링크의 도착지.
//
// resetPasswordForEmail()에 넘긴 redirectTo(`${siteUrl}/auth/confirm`)로
// Supabase가 인증 코드를 `?code=` 쿼리에 담아 리다이렉트해 준다(PKCE 플로우:
// @supabase/ssr의 createServerClient/createBrowserClient는 flowType: "pkce"가
// 기본값이다 - node_modules/@supabase/ssr/dist/main/createServerClient.js 참고).
// 여기서 exchangeCodeForSession()으로 코드를 세션으로 교환한 뒤,
// 새 비밀번호 입력 화면으로 리다이렉트한다.
//
// 이 라우트는 /login 하위가 아니라 /auth 하위에 두었다: 코드 교환에 성공하면
// 사용자는 "로그인된 상태"가 되는데, proxy(구 middleware, lib/supabase/middleware.ts)는
// 이미 로그인한 사용자가 "/login"으로 시작하는 경로에 오면 "/dashboard"로
// 리다이렉트해 버린다. "/auth" 경로는 그 규칙의 대상이 아니므로 이 문제를
// 피할 수 있다.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/auth/update-password";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      redirect(`${origin}${next}`);
    }
  }

  // 코드가 없거나 교환에 실패한 경우(만료·재사용된 링크 등):
  // 계정 존재 여부를 다시 요청하게 하고, 왜 실패했는지 알려준다.
  redirect(`${origin}/login/forgot-password?error=link-invalid`);
}
