import Link from "next/link";

import { BulkAdjustForm } from "@/app/(app)/materials/bulk-adjust/bulk-adjust-form";
import { buttonVariants } from "@/components/ui/button";
import { getCanEdit } from "@/lib/auth/editor";

export default async function MaterialsBulkAdjustPage() {
  const canEdit = await getCanEdit();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            재고 일괄 조정 (실사)
          </h1>
          <p className="text-sm text-muted-foreground">
            창고 실사 엑셀(MDG코드·실사수량)을 업로드하면 자재별로 기초재고를
            역산합니다. 반영 전 미리보기에서 결과를 확인하세요.
          </p>
        </div>
        <Link
          href="/materials"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          ← 목록
        </Link>
      </div>

      <BulkAdjustForm canEdit={canEdit} />
    </div>
  );
}
