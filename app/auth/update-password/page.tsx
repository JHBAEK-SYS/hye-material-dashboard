import Link from "next/link";

import { UpdatePasswordForm } from "@/app/auth/update-password/update-password-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

// 비밀번호 재설정 링크(/auth/confirm)를 거쳐야만 유효한 세션이 생긴다.
// 세션 없이 이 주소로 바로 접근한 경우 폼 대신 안내를 보여준다.
//
// 이 페이지는 /login 하위가 아니라 /auth 하위에 둔다: 재설정 링크를 타면
// 사용자는 로그인된 상태가 되는데, proxy(lib/supabase/middleware.ts)는
// 로그인한 사용자가 "/login" 으로 시작하는 경로에 오면 "/dashboard"로
// 돌려보낸다. "/auth" 경로는 그 대상이 아니므로 이 화면이 튕기지 않는다.
export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">링크가 유효하지 않습니다</CardTitle>
            <CardDescription>
              비밀번호 재설정 링크가 만료되었거나 이미 사용되었습니다. 다시
              요청해 주세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/login/forgot-password"
              className={buttonVariants({ className: "w-full" })}
            >
              재설정 메일 다시 받기
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 p-6">
      <UpdatePasswordForm />
    </main>
  );
}
