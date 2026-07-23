# 자재 대시보드 (반도체 구매팀)

반도체 구매팀 자재 재고·발주·출고 관리 대시보드.

## 스택

- **Next.js 16** (App Router) + **TypeScript** + **React 19**
- **Supabase** (DB · Auth · RLS) — `@supabase/ssr`
- **Tailwind CSS v4** + **shadcn/ui**
- 배포: **Vercel**

## 주요 기능

- 이메일/비밀번호 로그인 (Supabase Auth) · 라우트 가드 (`proxy.ts`)
- 대시보드: 재고 상태 KPI · 상태 분포 · 긴급 결품 목록 · 원장 건수
- 자재 마스터: 목록(검색·필터·페이지네이션) · 상세 · 편집(CRUD)

## 로컬 실행

```bash
npm install
cp .env.local.example .env.local   # 값 채우기
npm run dev                          # http://localhost:3000
```

## 환경 변수

`.env.local` (및 Vercel 프로젝트 환경변수)에 아래 두 값 필요:

| 키 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable(anon) 키 |

> `.env.local`은 커밋되지 않습니다. Vercel 배포 시에는 대시보드의 **Settings → Environment Variables**에 동일한 두 키를 등록하세요.

## 폴더 구조

```
app/            라우트 (login, (app)/dashboard, (app)/materials, auth)
components/      UI 컴포넌트 (ui/ = shadcn)
lib/supabase/    Supabase 클라이언트 및 쿼리 (client/server/middleware/queries)
types/           도메인 타입
proxy.ts         세션 갱신 + 인증 가드 (구 middleware)
```

## DB 접근 메모 (RLS)

- `authenticated` 역할에 `materials`·트랜잭션 테이블 SELECT, `materials` UPDATE 정책 필요.
- 트랜잭션 테이블(purchase_orders/consigned_reqs/issues/v_warehouse_movements)은
  데이터 입력 시 관련 KPI·화면이 자동 활성화됩니다.
