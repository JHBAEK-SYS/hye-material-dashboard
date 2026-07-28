import Link from "next/link";

import { BulkNewForm } from "@/app/(app)/materials/bulk-new/bulk-new-form";
import { buttonVariants } from "@/components/ui/button";
import { getCanEdit } from "@/lib/auth/editor";

export default async function MaterialsBulkNewPage() {
  const canEdit = await getCanEdit();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            자재 신규 일괄 등록
          </h1>
          <p className="text-sm text-muted-foreground">
            자재 목록 엑셀(필수: Manufacturer / MDG Code / Part Number, 선택:
            Material Name / Size 열 포함)을 업로드하면 신규 자재와 기존
            행(Part No만 있고 MDG코드가 비어 있는 행) 채우기 대상을 구분해
            미리보기로 보여줍니다. 자재명이 파일에도 없고 같은 MDG코드의
            기존 자재도 없는 행은 오류로 표시되어 등록되지 않습니다. 반영
            전 미리보기에서 결과를 확인하세요.
          </p>
        </div>
        <Link
          href="/materials"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          ← 목록
        </Link>
      </div>

      <BulkNewForm canEdit={canEdit} />
    </div>
  );
}
