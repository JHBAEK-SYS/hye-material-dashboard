-- Supabase SQL Editor에서 수동 실행 필요, 이 서브에이전트는 실행하지 않음.
--
-- issues 테이블은 현재 select/insert 정책만 있어 삭제(DELETE)가 RLS 로 차단됩니다.
-- 아래 정책을 Supabase 대시보드 > SQL Editor 에서 실행해야
-- /issues 화면의 삭제 버튼이 정상 동작합니다.

create policy "authenticated delete" on issues for delete to authenticated using (true);
