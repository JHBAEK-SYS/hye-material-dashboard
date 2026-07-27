import Link from "next/link";

import { ForgotPasswordForm } from "@/app/login/forgot-password/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 p-6">
      <ForgotPasswordForm />
      <Link
        href="/login"
        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        로그인 화면으로 돌아가기
      </Link>
    </main>
  );
}
