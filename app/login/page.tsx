import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 p-6">
      <LoginForm />
      <p className="text-xs text-muted-foreground">
        반도체 구매팀 자재 대시보드
      </p>
    </main>
  );
}
