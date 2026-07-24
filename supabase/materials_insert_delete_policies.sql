-- Supabase SQL Editor에서 수동 실행 필요, 이 서브에이전트는 실행하지 않음.
--
-- materials 테이블은 현재 SELECT/UPDATE 정책만 적용되어 있어
-- 신규 등록(INSERT)/삭제(DELETE)가 모두 RLS 로 차단됩니다.
-- 아래 정책을 Supabase 대시보드 > SQL Editor 에서 실행해야
-- /materials 화면의 신규 등록·삭제 기능이 정상 동작합니다.
--
-- 주의: purchase_orders.material_id / issues.material_id / consigned_reqs.material_id
-- 가 materials.id 를 ON DELETE RESTRICT 로 참조하고 있습니다.
-- 즉 아래 DELETE 정책을 적용해도, 이미 전표(발주/출고/사급청구)가 참조 중인 자재는
-- DB가 삭제를 거부합니다(foreign_key_violation, 23503). 이 경우 애플리케이션은
-- "삭제할 수 없습니다" 안내와 함께 편집 화면에서 '활성 자재'를 꺼서
-- 비활성 처리하도록 유도합니다. 자재를 완전히 지우려면 참조 전표를 먼저
-- 정리(삭제/이관)해야 합니다.

create policy "authenticated insert" on materials for insert to authenticated with check (true);
create policy "authenticated delete" on materials for delete to authenticated using (true);
