import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middleware 에서 이미 보호하지만, 안전을 위해 서버에서도 재확인합니다.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground md:flex-row">
      <AppSidebar userEmail={user.email ?? null} />
      <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
