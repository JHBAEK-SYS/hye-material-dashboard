import { redirect } from "next/navigation";

export default function Home() {
  // 미인증이면 middleware 가 /login 으로 보냅니다.
  redirect("/dashboard");
}
