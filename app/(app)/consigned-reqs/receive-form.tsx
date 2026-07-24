"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { receiveConsignedReq } from "@/app/(app)/consigned-reqs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/form-state";

function Btn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "…" : "입고"}
    </Button>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/** 표 행 안의 소형 입고처리 폼 */
export function ReceiveForm({
  id,
  defaultQty,
}: {
  id: number;
  defaultQty: number;
}) {
  const [state, formAction] = useActionState(
    receiveConsignedReq,
    initialFormState
  );
  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <Input
        name="received_qty"
        type="number"
        min={1}
        step="any"
        defaultValue={defaultQty}
        className="h-8 w-20"
        aria-label="입고수량"
      />
      <Input
        name="received_date"
        type="date"
        defaultValue={today()}
        className="h-8 w-36"
        aria-label="입고일"
      />
      <Btn />
      {state.error ? (
        <span className="text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
