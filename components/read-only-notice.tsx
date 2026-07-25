import { Lock } from "lucide-react";

/**
 * 조회 전용 계정에게 수정 권한이 없음을 알리는 공통 안내 박스.
 * 안전재고 미달 등 기존 경고(앰버)와 의미가 겹치지 않도록 중립 톤만 사용한다.
 */
export function ReadOnlyNotice() {
  return (
    <div
      role="note"
      className="flex items-center gap-2 rounded-md border bg-muted px-4 py-3"
    >
      <Lock className="size-4 shrink-0 text-foreground" aria-hidden="true" />
      <p className="font-medium text-foreground">
        조회 전용 계정입니다. 수정 권한이 없습니다. 권한이 필요하면 관리자에게 문의하세요.
      </p>
    </div>
  );
}
