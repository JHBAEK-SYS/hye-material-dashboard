-- Supabase SQL Editor에서 수동 실행 필요, 이 서브에이전트는 실행하지 않음.
--
-- consigned_reqs 테이블은 현재 SELECT 정책만 적용되어 있어
-- 등록(INSERT)/입고처리(UPDATE)/삭제(DELETE)가 모두 RLS 로 차단됩니다.
-- 아래 정책을 Supabase 대시보드 > SQL Editor 에서 실행해야
-- /consigned-reqs 화면의 등록·입고처리·삭제 기능이 정상 동작합니다.

create policy "authenticated insert" on consigned_reqs for insert to authenticated with check (true);
create policy "authenticated update" on consigned_reqs for update to authenticated using (true) with check (true);
create policy "authenticated delete" on consigned_reqs for delete to authenticated using (true);
