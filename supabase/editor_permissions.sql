-- Supabase SQL Editor에서 수동 실행 필요, 이 서브에이전트는 실행하지 않음.
--
-- ⚠️⚠️⚠️ 반드시 아래 순서(1→2→3→4)대로 실행하세요 ⚠️⚠️⚠️
-- 순서를 지키지 않고 4단계(쓰기 정책 교체)를 2단계(본인 이메일 등록)보다
-- 먼저 실행하면, app_editors 테이블에 아무도 없는 상태에서 모든 쓰기 정책이
-- "편집자만 허용"으로 바뀌어 버려 그 누구도(본인 포함) 더 이상 수정/삭제를
-- 할 수 없게 됩니다(자기 자신을 잠그는 상황). 이 경우 복구하려면 다시
-- Supabase 대시보드(service role)에서 app_editors 에 직접 행을 넣어야 합니다.
--
-- 요약: "특정 아이디로만 수정 가능, 나머지는 조회만"을 DB(RLS) 레벨에서 강제합니다.
-- 편집자 명단은 app_editors 테이블로 관리하며, 이메일은 깃 저장소에 남기지 않고
-- Supabase 대시보드에서 행을 추가/삭제하는 것만으로 재배포 없이 반영됩니다.

-- =========================================================
-- 1단계: 편집 권한자 테이블 생성
-- =========================================================
create table if not exists app_editors (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);

alter table app_editors enable row level security;

-- 로그인 사용자는 목록을 읽을 수 있다(앱이 "내가 편집자인가"를 판단하는 데 필요).
-- 쓰기 정책은 일부러 만들지 않는다 → 편집자 추가/삭제는 Supabase 대시보드(service role)에서만 가능.
create policy "authenticated read" on app_editors for select to authenticated using (true);

-- =========================================================
-- 2단계: ★ 반드시 여기서 본인 이메일을 먼저 넣어라 ★
--        (3~4단계를 먼저 실행하면 아무도 수정할 수 없게 되어 스스로 잠긴다)
-- =========================================================
insert into app_editors (email, note) values ('본인이메일@example.com', '관리자')
  on conflict (email) do nothing;

-- =========================================================
-- 3단계: 현재 로그인 사용자가 편집자인지 판정하는 함수
-- =========================================================
create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_editors
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- =========================================================
-- 4단계: 기존 쓰기 정책을 편집자 전용으로 교체
-- (SELECT 정책은 건드리지 않는다 — 조회는 로그인한 전원 허용 유지)
-- =========================================================

-- materials
drop policy if exists "authenticated update" on materials;
drop policy if exists "authenticated insert" on materials;
drop policy if exists "authenticated delete" on materials;

create policy "editors insert" on materials for insert to authenticated with check (public.is_editor());
create policy "editors update" on materials for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors delete" on materials for delete to authenticated using (public.is_editor());

-- purchase_orders
drop policy if exists "authenticated insert" on purchase_orders;
drop policy if exists "authenticated update" on purchase_orders;
drop policy if exists "authenticated delete" on purchase_orders;

create policy "editors insert" on purchase_orders for insert to authenticated with check (public.is_editor());
create policy "editors update" on purchase_orders for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors delete" on purchase_orders for delete to authenticated using (public.is_editor());

-- consigned_reqs
drop policy if exists "authenticated insert" on consigned_reqs;
drop policy if exists "authenticated update" on consigned_reqs;
drop policy if exists "authenticated delete" on consigned_reqs;

create policy "editors insert" on consigned_reqs for insert to authenticated with check (public.is_editor());
create policy "editors update" on consigned_reqs for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "editors delete" on consigned_reqs for delete to authenticated using (public.is_editor());

-- issues
-- (issues 의 DELETE 정책은 supabase/issues_delete_policy.sql 로 별도 제공되었으나
--  사용자가 실행했는지 불확실하므로 drop policy if exists 로 안전하게 처리합니다.
--  insert/delete 모두 이번에 편집자 전용으로 통일합니다.)
drop policy if exists "authenticated insert" on issues;
drop policy if exists "authenticated delete" on issues;

create policy "editors insert" on issues for insert to authenticated with check (public.is_editor());
create policy "editors delete" on issues for delete to authenticated using (public.is_editor());

-- =========================================================
-- 편집자 추가/삭제 방법 (Supabase 대시보드 > SQL Editor 또는 Table Editor)
-- =========================================================
-- 편집자 추가:  insert into app_editors (email, note) values ('someone@corp.com', '구매팀 홍길동');
-- 편집자 삭제:  delete from app_editors where email = 'someone@corp.com';
