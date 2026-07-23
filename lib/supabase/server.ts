import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버(Server Component, Server Action, Route Handler)에서 사용하는 Supabase 클라이언트.
 * Next.js 15+ 에서 cookies() 는 비동기이므로 반드시 await 로 호출합니다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component 에서 호출된 경우 set 이 불가능할 수 있습니다.
            // 세션 갱신은 middleware 에서 처리하므로 무시해도 안전합니다.
          }
        },
      },
    }
  );
}
