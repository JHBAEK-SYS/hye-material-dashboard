"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateConsignedReqBlNo } from "@/app/(app)/consigned-reqs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/form-state";

function Btn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "…" : "저장"}
    </Button>
  );
}

/**
 * 표 행 안의 소형 B/L NO 수정 폼. 등록 시점엔 비워둘 수 있고(선적 전),
 * 목록에서 언제든 채우거나 고쳐 쓸 수 있도록 항상 입력칸을 노출한다.
 */
export function BlNoForm({
  id,
  defaultBlNo,
}: {
  id: number;
  defaultBlNo: string | null;
}) {
  const [state, formAction] = useActionState(
    updateConsignedReqBlNo,
    initialFormState
  );
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <Input
        name="bl_no"
        type="text"
        defaultValue={defaultBlNo ?? ""}
        placeholder="B/L NO"
        className="h-8 w-32"
        aria-label="B/L NO"
      />
      <Btn />
      {state.error ? (
        <span className="text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
