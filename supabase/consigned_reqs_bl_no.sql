-- 이미 적용 완료(2026-07-24). Supabase SQL Editor에서 사용자가 직접 실행 완료,
-- 이 서브에이전트는 실행하지 않음 (기록용 보관 파일).
--
-- 사급청구(consigned_reqs)에 B/L(선하증권) 번호 컬럼 추가.
-- 사급청구번호(sg_no) 한 건에 여러 품목(행)이 딸려 있고, B/L NO는 품목(행)마다
-- 개별로 붙는다. 등록 시점엔 선적 전이라 B/L NO를 모를 수 있어 NOT NULL 제약은 두지 않는다.

alter table consigned_reqs add column bl_no text;
