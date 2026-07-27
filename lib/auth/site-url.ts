// 이 프로젝트에는 사이트 URL 환경변수가 명시적으로 없다(NEXT_PUBLIC_SITE_URL 등 미설정).
// resetPasswordForEmail()의 redirectTo 등 절대 URL이 필요한 곳에서 쓸 사이트 주소를
// 다음 우선순위로 결정한다.
//   1. NEXT_PUBLIC_SITE_URL (명시적으로 설정된 경우)
//   2. VERCEL_PROJECT_PRODUCTION_URL (Vercel 배포 환경에서 자동 주입됨, https:// 를 붙여 사용)
//   3. http://localhost:3000 (로컬 개발 기본값)
//
// env를 인자로 받는 순수 함수로 설계해 process.env에 의존하지 않고 테스트할 수 있게 한다.
export type SiteUrlEnv = {
  NEXT_PUBLIC_SITE_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  // process.env(NodeJS.ProcessEnv)는 인덱스 시그니처를 가진 타입이라, 위 두
  // 필드만 선언하면 구조적 타이핑상 "공통 속성 없음"으로 거부된다. 인덱스
  // 시그니처를 맞춰줘 process.env를 그대로 넘길 수 있게 한다.
  [key: string]: string | undefined;
};

const LOCALHOST_FALLBACK = "http://localhost:3000";

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function getSiteUrl(env: SiteUrlEnv): string {
  if (env.NEXT_PUBLIC_SITE_URL) {
    return stripTrailingSlash(env.NEXT_PUBLIC_SITE_URL);
  }

  if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    return stripTrailingSlash(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  return LOCALHOST_FALLBACK;
}
